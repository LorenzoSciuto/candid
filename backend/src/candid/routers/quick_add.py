from fastapi import APIRouter, Depends
from sqlmodel import Session

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org
from candid.commons.errors import ai_provider_error
from candid.commons.schemas import QuickAddRequest
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
                raise ai_provider_error(exc) from exc
