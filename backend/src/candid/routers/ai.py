import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org
from candid.commons.errors import ai_provider_error
from candid.commons.models import Candidate
from candid.commons.prompts import Prompts
from candid.commons.tenancy import get_in_org
from candid.services.ai_engine import AIEngineFactory
from candid.services.email_service import EmailServiceFactory

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
    candidate_id: Optional[str] = None


class AIRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory, email_factory: EmailServiceFactory | None = None) -> None:
        self.router = APIRouter(prefix="/ai", tags=["ai"])
        self._db = db
        self._ai_factory = ai_factory
        self._email_factory = email_factory
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
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._send_email(body, session, user.org_id)

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
            raise HTTPException(status_code=400, detail=str(e)) from e
        try:
            engine = self._ai_factory.from_session(session, org_id)
            result = engine.run_prompt(prompt)
            return {"result": result}
        except Exception as e:
            raise ai_provider_error(e) from e

    def _send_email(self, body: SendEmailRequest, session: Session, org_id: str) -> dict:
        if not body.to or not body.subject or not body.body:
            raise HTTPException(400, "to, subject, and body are required")
        if body.candidate_id:
            get_in_org(session, Candidate, body.candidate_id, org_id)
        email_svc = self._email_factory.from_session(session, org_id, candidate_id=body.candidate_id) if self._email_factory else None
        if not email_svc:
            raise HTTPException(503, "SMTP not configured — configure it in Settings → Email")
        try:
            email_svc.send_email(body.to, body.subject, body.body)
            return {"ok": True}
        except Exception as exc:
            logger.exception("Failed to send email to %s", body.to)
            raise HTTPException(502, "The email could not be sent — check the SMTP settings") from exc
