from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from candid.database import Database
from candid.prompts import Prompts
from candid.services.ai_engine import AIEngineFactory


class RewriteRequest(BaseModel):
    action: str                      # e.g. "rewrite_email" | "rewrite_candidate_email"
    text: str                        # the body to rewrite
    to: str = ""                     # rewrite_email: recipient display name / email
    subject: str = ""                # rewrite_email: subject line for context
    candidate_name: str = ""         # rewrite_candidate_email
    role: str = ""                   # rewrite_candidate_email


class AIRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory) -> None:
        self.router = APIRouter(prefix="/ai", tags=["ai"])
        self._db = db
        self._ai_factory = ai_factory
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.post("/rewrite")
        def rewrite(body: RewriteRequest):
            with Session(db._engine) as session:
                return self._rewrite(body, session)

    def _rewrite(self, body: RewriteRequest, session: Session) -> dict:
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
            engine = self._ai_factory.from_session(session)
            result = engine.run_prompt(prompt)
            return {"result": result}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
