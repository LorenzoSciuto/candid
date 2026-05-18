from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.schemas import QuickAddRequest
from candid.services.ai_engine import AIEngineFactory


class QuickAddRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory) -> None:
        self._db = db
        self._ai_factory = ai_factory
        self.router = APIRouter(tags=["quick-add"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.post("/quick-add")
        def quick_add(
            body: QuickAddRequest,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            try:
                engine = self._ai_factory.from_session(session, user.org_id)
                return engine.parse_quick_add(body.text)
            except Exception as exc:
                raise HTTPException(502, f"AI error: {exc}") from exc
