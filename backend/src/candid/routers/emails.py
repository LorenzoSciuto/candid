import logging
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org
from candid.commons.models import EmailLog

logger = logging.getLogger(__name__)



class EmailsRouter:
    def __init__(self, database: Database) -> None:
        self._database = database
        self.router = APIRouter(prefix="/emails", tags=["emails"])
        self._register()

    def _register(self) -> None:
        database = self._database

        @self.router.get("")
        def list_emails(
            direction: Optional[str] = None,
            candidate_id: Optional[str] = None,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._list(session, user.org_id, direction, candidate_id)

    # ── Implementations ────────────────────────────────────────────────────────

    def _list(
        self,
        session: Session,
        org_id: str,
        direction: Optional[str],
        candidate_id: Optional[str],
    ) -> dict:
        query = select(EmailLog).where(EmailLog.org_id == org_id)
        if direction in ("sent", "received"):
            query = query.where(EmailLog.direction == direction)
        if candidate_id:
            query = query.where(EmailLog.candidate_id == candidate_id)
        emails = session.exec(query.order_by(EmailLog.sent_at.desc())).all()
        return {
            "emails": [email.model_dump() for email in emails],
            "total": len(emails),
            "sent_count": sum(1 for email in emails if email.direction == "sent"),
            "received_count": sum(1 for email in emails if email.direction == "received"),
        }
