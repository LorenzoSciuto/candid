"""require_org / require_admin and tenant-context propagation (SQLite, no Postgres needed)."""
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.commons import tenancy
from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_admin, require_org, require_user
from candid.commons.models import Membership


def _app_with_user(user: UserCtx, role: str | None) -> TestClient:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    db = Database.__new__(Database)
    db._engine = engine
    if role:
        with Session(engine) as session:
            session.add(Membership(org_id="org-a", user_id=user.user_id, role=role))
            session.commit()

    app = FastAPI()
    app.state.db = db
    app.dependency_overrides[require_user] = lambda: user

    @app.get("/org")
    def org_endpoint(ctx: UserCtx = Depends(require_org)):  # sync on purpose: runs in the threadpool
        return {"ctx_org": ctx.org_id, "rls_org": tenancy.current_org_id(), "role": ctx.role}

    @app.get("/admin")
    def admin_endpoint(ctx: UserCtx = Depends(require_admin)):
        return {"ok": True}

    return TestClient(app)


_USER = UserCtx(user_id="u1", email="u1@candid.test", name="U1", org_id="org-a")


def test_require_org_should_publish_tenant_context_to_sync_endpoint_when_member() -> None:
    client = _app_with_user(_USER, role="member")
    assert client.get("/org").json() == {"ctx_org": "org-a", "rls_org": "org-a", "role": "member"}


def test_require_org_should_return_403_when_user_was_removed_from_org() -> None:
    client = _app_with_user(_USER, role=None)
    assert client.get("/org").status_code == 403


def test_require_org_should_return_403_when_token_has_no_org() -> None:
    client = _app_with_user(_USER.model_copy(update={"org_id": ""}), role="member")
    assert client.get("/org").status_code == 403


def test_require_admin_should_return_403_when_member() -> None:
    assert _app_with_user(_USER, role="member").get("/admin").status_code == 403


def test_require_admin_should_allow_admin_and_owner() -> None:
    assert _app_with_user(_USER, role="admin").get("/admin").status_code == 200
    assert _app_with_user(_USER, role="owner").get("/admin").status_code == 200
