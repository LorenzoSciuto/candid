import pytest
from contextlib import asynccontextmanager
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

from candid.config import Settings
from candid.database import Database
from candid.dependencies import UserCtx, require_user
from candid.models import Invitation, Membership, Organization, User
from candid.routers.auth import AuthRouter
from candid.services.auth_service import verify_token

_USER = UserCtx(
    user_id="test-user",
    email="test@candid.test",
    name="Test User",
    org_id="",
)

_FERNET_KEY = "Bx_RzRCOqO-3t6G3bXGF2eVZKHHZ7mfYF4oJwGrJ7Zg="
_SECRET = "test-session-secret-at-least-32-bytes!!"


def _build_auth_client(settings: Settings, db: Database) -> TestClient:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield

    app = FastAPI(lifespan=lifespan)
    app.dependency_overrides[require_user] = lambda: _USER
    app.include_router(AuthRouter(settings, db).router)
    return TestClient(app)


@pytest.fixture(scope="session")
def auth_client(db: Database) -> TestClient:
    settings = Settings(
        database_url="sqlite://",
        fernet_key=_FERNET_KEY,
        session_secret=_SECRET,
        google_client_id=None,
    )
    return _build_auth_client(settings, db)


@pytest.fixture(scope="session")
def auth_client_google(db: Database) -> TestClient:
    settings = Settings(
        database_url="sqlite://",
        fernet_key=_FERNET_KEY,
        session_secret=_SECRET,
        google_client_id="fake-client-id",
    )
    return _build_auth_client(settings, db)


def _seed_user(db: Database) -> User:
    with Session(db._engine) as s:
        user = User(id=_USER.user_id, email=_USER.email, name=_USER.name)
        s.add(user)
        s.commit()
        s.refresh(user)
        return user


def _seed_org_with_member(db: Database, role: str = "member") -> Organization:
    with Session(db._engine) as s:
        user = User(id=_USER.user_id, email=_USER.email, name=_USER.name)
        org = Organization(id="org-xyz", name="Test Corp", slug="test-corp", owner_id=_USER.user_id)
        mbr = Membership(org_id=org.id, user_id=_USER.user_id, role=role)
        s.add(user)
        s.add(org)
        s.flush()
        s.add(mbr)
        s.commit()
        s.refresh(org)
        return org


class TestAuthConfig:
    def test_returns_null_when_google_not_configured(self, auth_client: TestClient) -> None:
        resp = auth_client.get("/auth/config")
        assert resp.status_code == 200
        assert resp.json()["google_client_id"] is None

    def test_returns_client_id_when_configured(self, auth_client_google: TestClient) -> None:
        resp = auth_client_google.get("/auth/config")
        assert resp.status_code == 200
        assert resp.json()["google_client_id"] == "fake-client-id"


class TestGoogleAuth:
    def test_400_when_sso_not_configured(self, auth_client: TestClient) -> None:
        resp = auth_client.post("/auth/google", json={"token": "any"})
        assert resp.status_code == 400
        assert "not configured" in resp.json()["detail"]

    def test_401_when_google_rejects_token(self, auth_client_google: TestClient) -> None:
        mock_resp = MagicMock(status_code=400)
        with patch("candid.routers.auth.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                get=AsyncMock(return_value=mock_resp)
            ))
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            resp = auth_client_google.post("/auth/google", json={"token": "bad-token"})
        assert resp.status_code == 401
        assert "Invalid Google token" in resp.json()["detail"]

    def test_new_user_gets_wizard_response(self, auth_client_google: TestClient) -> None:
        google_payload = {
            "sub": "google-sub-99", "email": "newuser@example.com",
            "name": "New User", "picture": "https://example.com/pic.jpg",
        }
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = google_payload
        with patch("candid.routers.auth.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                get=AsyncMock(return_value=mock_resp)
            ))
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            resp = auth_client_google.post("/auth/google", json={"token": "valid-token"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["needs_org_setup"] is True
        assert data["email"] == "newuser@example.com"
        assert "token" in data

    def test_existing_user_with_org_gets_full_token(self, auth_client_google: TestClient, db: Database) -> None:
        with Session(db._engine) as s:
            user = User(id="google-sub-42", email="existing@example.com", name="Existing User")
            org = Organization(id="org-google", name="Google Org", slug="google-org", owner_id="google-sub-42")
            s.add(user)
            s.add(org)
            s.flush()
            s.add(Membership(org_id=org.id, user_id=user.id, role="owner"))
            s.commit()
        google_payload = {
            "sub": "google-sub-42", "email": "existing@example.com",
            "name": "Existing User", "picture": None,
        }
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = google_payload
        with patch("candid.routers.auth.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                get=AsyncMock(return_value=mock_resp)
            ))
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            resp = auth_client_google.post("/auth/google", json={"token": "valid-token"})
        assert resp.status_code == 200
        data = resp.json()
        assert "needs_org_setup" not in data or data.get("needs_org_setup") is False
        assert data["org_id"] == "org-google"


class TestSwitchOrg:
    def test_403_when_not_a_member(self, auth_client: TestClient) -> None:
        resp = auth_client.post("/auth/switch-org", json={"org_id": "org-nonexistent"})
        assert resp.status_code == 403

    def test_returns_token_when_member(self, auth_client: TestClient, db: Database) -> None:
        org = _seed_org_with_member(db, role="admin")
        resp = auth_client.post("/auth/switch-org", json={"org_id": org.id})
        assert resp.status_code == 200
        data = resp.json()
        assert data["org_id"] == org.id
        assert data["org_name"] == "Test Corp"
        assert "token" in data


class TestCreateOrg:
    def test_creates_org_and_returns_token(self, auth_client: TestClient, db: Database) -> None:
        _seed_user(db)
        resp = auth_client.post("/auth/organizations", json={"name": "New Org"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["org"]["name"] == "New Org"
        assert "token" in data

    def test_duplicate_name_gets_unique_slug(self, auth_client: TestClient, db: Database) -> None:
        _seed_user(db)
        r1 = auth_client.post("/auth/organizations", json={"name": "Acme"})
        r2 = auth_client.post("/auth/organizations", json={"name": "Acme"})
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["org"]["id"] != r2.json()["org"]["id"]


class TestAcceptInvite:
    def _make_invite(self, db: Database, *, email=None, accepted=False, expired=False) -> Invitation:
        with Session(db._engine) as s:
            org = Organization(id="org-inv", name="Inv Org", slug="inv-org", owner_id="owner-id")
            s.add(org)
            s.flush()
            expires = (date.today() - timedelta(days=1) if expired else date.today() + timedelta(days=7))
            inv = Invitation(
                org_id=org.id,
                email=email or _USER.email,
                token="inv-token-123",
                role="member",
                invited_by="owner-id",
                expires_at=expires.isoformat(),
                accepted_at=date.today().isoformat() if accepted else None,
            )
            s.add(inv)
            s.commit()
            s.refresh(inv)
            return inv

    def test_400_when_no_token_or_id(self, auth_client: TestClient) -> None:
        resp = auth_client.post("/auth/accept-invite", json={})
        assert resp.status_code == 400

    def test_404_when_token_not_found(self, auth_client: TestClient) -> None:
        resp = auth_client.post("/auth/accept-invite", json={"token": "ghost-token"})
        assert resp.status_code == 404

    def test_403_when_invitation_email_mismatch(self, auth_client: TestClient, db: Database) -> None:
        inv = self._make_invite(db, email="other@example.com")
        resp = auth_client.post("/auth/accept-invite", json={"invitation_id": inv.id})
        assert resp.status_code == 403

    def test_410_when_already_accepted(self, auth_client: TestClient, db: Database) -> None:
        inv = self._make_invite(db, accepted=True)
        resp = auth_client.post("/auth/accept-invite", json={"token": inv.token})
        assert resp.status_code == 410

    def test_410_when_expired(self, auth_client: TestClient, db: Database) -> None:
        inv = self._make_invite(db, expired=True)
        resp = auth_client.post("/auth/accept-invite", json={"token": inv.token})
        assert resp.status_code == 410

    def test_success_by_token(self, auth_client: TestClient, db: Database) -> None:
        _seed_user(db)
        inv = self._make_invite(db)
        resp = auth_client.post("/auth/accept-invite", json={"token": inv.token})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["org_id"] == "org-inv"
        assert "token" in data

    def test_success_by_invitation_id(self, auth_client: TestClient, db: Database) -> None:
        _seed_user(db)
        inv = self._make_invite(db)
        resp = auth_client.post("/auth/accept-invite", json={"invitation_id": inv.id})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


class TestUpdateMe:
    def test_404_when_user_not_in_db(self, auth_client: TestClient) -> None:
        resp = auth_client.patch("/auth/users/me", json={"name": "Ghost"})
        assert resp.status_code == 404

    def test_updates_name_and_title(self, auth_client: TestClient, db: Database) -> None:
        _seed_user(db)
        resp = auth_client.patch("/auth/users/me", json={"name": "Updated Name", "title": "CTO"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Name"
        assert data["title"] == "CTO"

    def test_partial_update_preserves_other_fields(self, auth_client: TestClient, db: Database) -> None:
        _seed_user(db)
        auth_client.patch("/auth/users/me", json={"title": "Engineer"})
        resp = auth_client.patch("/auth/users/me", json={"department": "Eng"})
        assert resp.status_code == 200
        assert resp.json()["department"] == "Eng"
