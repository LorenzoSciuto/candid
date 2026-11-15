from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org
from candid.commons.models import Notification


class NotificationsRouter:
    def __init__(self, database: Database) -> None:
        self._database = database
        self.router = APIRouter(prefix="/notifications", tags=["notifications"])
        self._register()

    def _register(self) -> None:
        database = self._database

        @self.router.get("")
        def list_notifications(
            unread_only: bool = False,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._list(session, user.org_id, user.user_id, unread_only)

        @self.router.patch("/{notification_id}/read")
        def mark_read(
            notification_id: str,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._mark_read(session, user.org_id, user.user_id, notification_id)

        @self.router.post("/read-all")
        def mark_all_read(
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._mark_all_read(session, user.org_id, user.user_id)

    # ── Implementations ────────────────────────────────────────────────────────

    def _list(
        self,
        session: Session,
        organization_id: str,
        user_id: str,
        unread_only: bool,
    ) -> dict:
        query = select(Notification).where(
            Notification.org_id == organization_id,
            Notification.user_id == user_id,
        )
        notifications = session.exec(query).all()
        if unread_only:
            notifications = [n for n in notifications if not n.is_read]
        unread_count = sum(1 for n in notifications if not n.is_read)
        return {
            "notifications": [n.model_dump() for n in notifications],
            "unread_count": unread_count,
        }

    def _mark_read(
        self,
        session: Session,
        organization_id: str,
        user_id: str,
        notification_id: str,
    ) -> dict:
        notification = self._fetch(session, organization_id, user_id, notification_id)
        notification.is_read = True
        session.add(notification)
        session.commit()
        session.refresh(notification)
        return notification.model_dump()

    def _mark_all_read(
        self,
        session: Session,
        organization_id: str,
        user_id: str,
    ) -> dict:
        notifications = session.exec(
            select(Notification).where(
                Notification.org_id == organization_id,
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
        ).all()
        updated_count = self._apply_read_to_all(session, notifications)
        return {"ok": True, "updated_count": updated_count}

    def _apply_read_to_all(self, session: Session, notifications: list) -> int:
        for notification in notifications:
            notification.is_read = True
            session.add(notification)
        session.commit()
        return len(notifications)

    @staticmethod
    def _fetch(
        session: Session,
        organization_id: str,
        user_id: str,
        notification_id: str,
    ) -> Notification:
        notification = session.get(Notification, notification_id)
        if not notification or notification.org_id != organization_id or notification.user_id != user_id:
            raise HTTPException(404, "Notification not found")
        return notification
