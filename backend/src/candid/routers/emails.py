import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Candidate, EmailLog

logger = logging.getLogger(__name__)


class LogReceivedEmailRequest(BaseModel):
    from_email: str
    subject: str
    body: str = ""
    candidate_id: Optional[str] = None


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

        @self.router.post("/received", status_code=201)
        def log_received(
            body: LogReceivedEmailRequest,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._log_received(session, user.org_id, body)

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

    def _log_received(
        self,
        session: Session,
        org_id: str,
        body: LogReceivedEmailRequest,
    ) -> dict:
        if body.candidate_id:
            candidate = session.get(Candidate, body.candidate_id)
            if not candidate or candidate.org_id != org_id:
                raise HTTPException(404, "Candidate not found")
        log_entry = EmailLog(
            org_id=org_id,
            direction="received",
            from_email=body.from_email,
            subject=body.subject,
            body=body.body,
            email_type="manual",
            candidate_id=body.candidate_id,
        )
        session.add(log_entry)
        session.commit()
        session.refresh(log_entry)
        return log_entry.model_dump()
