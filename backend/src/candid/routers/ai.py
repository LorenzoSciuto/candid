from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from candid.database import Database
from candid.services.ai_engine import AIEngineFactory


class RewriteRequest(BaseModel):
    text: str
    instruction: str


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
            engine = self._ai_factory.from_session(session)
            result = engine.rewrite_text(body.text, body.instruction)
            return {"result": result}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
