from sqlalchemy import text
from sqlmodel import Session


class RlsService:
    """Sets PostgreSQL session variable app.current_org_id for RLS policy enforcement."""

    def is_supported(self, session: Session) -> bool:
        """True if connected to PostgreSQL (RLS not supported on SQLite)."""
        return session.get_bind().dialect.name == "postgresql"

    def set_org_context(self, session: Session, organization_id: str) -> None:
        """SET LOCAL app.current_org_id so RLS policies filter to this org."""
        if not self.is_supported(session):
            return
        self._execute_set_local(session, organization_id)

    def clear_org_context(self, session: Session) -> None:
        """Reset org context to empty string."""
        if not self.is_supported(session):
            return
        self._execute_clear_local(session)

    def _execute_set_local(self, session: Session, organization_id: str) -> None:
        session.execute(
            text("SET LOCAL app.current_org_id = :organization_id"),
            {"organization_id": organization_id},
        )

    def _execute_clear_local(self, session: Session) -> None:
        session.execute(text("SET LOCAL app.current_org_id = ''"))
