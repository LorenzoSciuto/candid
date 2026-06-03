from unittest.mock import MagicMock, call, patch

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.services.rls_service import RlsService


def _make_sqlite_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _make_mock_postgresql_session() -> MagicMock:
    mock_session = MagicMock(spec=Session)
    mock_bind = MagicMock()
    mock_bind.dialect.name = "postgresql"
    mock_session.get_bind.return_value = mock_bind
    return mock_session


class TestRlsServiceIsSupported:
    def test_isSupported_shouldReturnFalse_whenSqlite(self) -> None:
        service = RlsService()
        sqlite_session = _make_sqlite_session()
        assert service.is_supported(sqlite_session) is False
        sqlite_session.close()

    def test_isSupported_shouldReturnTrue_whenPostgresql(self) -> None:
        service = RlsService()
        mock_session = _make_mock_postgresql_session()
        assert service.is_supported(mock_session) is True


class TestRlsServiceSetOrgContext:
    def test_setOrgContext_shouldExecuteSetLocal_whenPostgresql(self) -> None:
        service = RlsService()
        mock_session = _make_mock_postgresql_session()

        service.set_org_context(mock_session, "org-abc123")

        mock_session.execute.assert_called_once()
        call_args = mock_session.execute.call_args
        executed_sql = str(call_args[0][0])
        assert "SET LOCAL app.current_org_id" in executed_sql
        assert "org-abc123" in str(call_args)

    def test_setOrgContext_shouldSkip_whenSqlite(self) -> None:
        service = RlsService()
        sqlite_session = _make_sqlite_session()

        with patch.object(sqlite_session, "execute") as mock_execute:
            service.set_org_context(sqlite_session, "org-abc123")
            mock_execute.assert_not_called()

        sqlite_session.close()

    def test_setOrgContext_shouldPassOrgIdAsParameter_whenPostgresql(self) -> None:
        service = RlsService()
        mock_session = _make_mock_postgresql_session()
        organization_id = "org-specific-tenant"

        service.set_org_context(mock_session, organization_id)

        call_args = mock_session.execute.call_args
        parameters = call_args[0][1]
        assert parameters["organization_id"] == organization_id


class TestRlsServiceClearOrgContext:
    def test_clearOrgContext_shouldExecuteReset_whenPostgresql(self) -> None:
        service = RlsService()
        mock_session = _make_mock_postgresql_session()

        service.clear_org_context(mock_session)

        mock_session.execute.assert_called_once()
        call_args = mock_session.execute.call_args
        executed_sql = str(call_args[0][0])
        assert "SET LOCAL app.current_org_id" in executed_sql
        assert "''" in executed_sql

    def test_clearOrgContext_shouldSkip_whenSqlite(self) -> None:
        service = RlsService()
        sqlite_session = _make_sqlite_session()

        with patch.object(sqlite_session, "execute") as mock_execute:
            service.clear_org_context(sqlite_session)
            mock_execute.assert_not_called()

        sqlite_session.close()
