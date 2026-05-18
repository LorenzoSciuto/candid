import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.prompts import Prompts
from candid.services.ai_engine import AIEngineFactory
from candid.services.email_service import EmailService

logger = logging.getLogger(__name__)


class RewriteRequest(BaseModel):
    action: str                      # e.g. "rewrite_email" | "rewrite_candidate_email"
    text: str                        # the body to rewrite
    to: str = ""                     # rewrite_email: recipient display name / email
    subject: str = ""                # rewrite_email: subject line for context
    candidate_name: str = ""         # rewrite_candidate_email
    role: str = ""                   # rewrite_candidate_email


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str


class AIRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory, email_service: EmailService | None = None) -> None:
        self.router = APIRouter(prefix="/ai", tags=["ai"])
        self._db = db
        self._ai_factory = ai_factory
        self._email = email_service
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.post("/rewrite")
        def rewrite(
            body: RewriteRequest,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._rewrite(body, session, user.org_id)

        @self.router.post("/send-email")
        def send_email(
            body: SendEmailRequest,
            user: UserCtx = Depends(require_org),
        ):
            return self._send_email(body)

    def _rewrite(self, body: RewriteRequest, session: Session, org_id: str) -> dict:
        if not body.text.strip():
            raise HTTPException(status_code=400, detail="text is required")
        try:
            prompt = Prompts.render_action(
                body.action,
                text=body.text,
                to_clause=f" to {body.to}" if body.to else "",
                subject_clause=f' with subject "{body.subject}"' if body.subject else "",
                candidate_name=body.candidate_name or "the candidate",
                role=body.role or "open",
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        try:
            engine = self._ai_factory.from_session(session, org_id)
            result = engine.run_prompt(prompt)
            return {"result": result}
        except Exception as e:
            logger.exception("AI rewrite failed")
            raise HTTPException(status_code=500, detail=str(e))

    def _send_email(self, body: SendEmailRequest) -> dict:
        if not body.to or not body.subject or not body.body:
            raise HTTPException(400, "to, subject, and body are required")
        if not self._email or not self._email.is_configured():
            raise HTTPException(503, "SMTP not configured — set SMTP_HOST in .env")
        try:
            self._email.send_email(body.to, body.subject, body.body)
            return {"ok": True}
        except Exception as exc:
            logger.exception("Failed to send email to %s", body.to)
            raise HTTPException(500, f"Send failed: {exc}") from exc
