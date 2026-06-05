from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.dependencies import UserCtx, require_org, _get_database, _get_session
from candid.database import Database
from candid.services.rls_service import RlsService

_ORGANIZATION_ID = "org-rls-test"
_AUTHENTICATED_USER = UserCtx(
    user_id="user-rls-test",
    email="rls@candid.test",
    name="RLS Test User",
    org_id=_ORGANIZATION_ID,
)


def _build_test_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def _build_test_database() -> Database:
    engine = _build_test_engine()
    SQLModel.metadata.create_all(engine)
    database = Database.__new__(Database)
    database._engine = engine
    return database


class TestRequireOrgRlsIntegration:
    def test_requireOrg_shouldSetRlsContext_whenValidToken(self) -> None:
        database = _build_test_database()

        @asynccontextmanager
        async def lifespan(_: FastAPI):
            yield

        application = FastAPI(lifespan=lifespan)

        @application.get("/probe")
        def probe_endpoint(user: UserCtx = Depends(require_org)):
            return {"org_id": user.org_id}

        application.dependency_overrides[_get_database] = lambda: database

        with patch.object(RlsService, "set_org_context") as mock_set_context:
            from candid.dependencies import require_user
            application.dependency_overrides[require_user] = lambda: _AUTHENTICATED_USER

            test_client = TestClient(application)
            response = test_client.get("/probe")

        assert response.status_code == 200
        mock_set_context.assert_called_once()
        call_args = mock_set_context.call_args
        assert call_args[0][1] == _ORGANIZATION_ID

    def test_requireOrg_shouldReject403_whenNoOrgId(self) -> None:
        wizard_user = UserCtx(
            user_id="wizard-user",
            email="wizard@candid.test",
            name="Wizard User",
            org_id="",
        )
        database = _build_test_database()

        @asynccontextmanager
        async def lifespan(_: FastAPI):
            yield

        application = FastAPI(lifespan=lifespan)

        @application.get("/probe")
        def probe_endpoint(user: UserCtx = Depends(require_org)):
            return {"org_id": user.org_id}

        application.dependency_overrides[_get_database] = lambda: database

        from candid.dependencies import require_user
        application.dependency_overrides[require_user] = lambda: wizard_user

        test_client = TestClient(application)
        response = test_client.get("/probe")

        assert response.status_code == 403

    def test_requireOrg_shouldNotCallRlsService_whenOrgIdMissing(self) -> None:
        wizard_user = UserCtx(
            user_id="wizard-user-2",
            email="wizard2@candid.test",
            name="Wizard User 2",
            org_id="",
        )
        database = _build_test_database()

        @asynccontextmanager
        async def lifespan(_: FastAPI):
            yield

        application = FastAPI(lifespan=lifespan)

        @application.get("/probe")
        def probe_endpoint(user: UserCtx = Depends(require_org)):
            return {"org_id": user.org_id}

        application.dependency_overrides[_get_database] = lambda: database

        with patch.object(RlsService, "set_org_context") as mock_set_context:
            from candid.dependencies import require_user
            application.dependency_overrides[require_user] = lambda: wizard_user

            test_client = TestClient(application)
            test_client.get("/probe")

        mock_set_context.assert_not_called()
