from fastapi import Depends, HTTPException, Request, Security
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlmodel import select

from candid.commons import tenancy
from candid.commons.database import Database
from candid.commons.models import Membership
from candid.commons.tokens import verify_token

_bearer = HTTPBearer(auto_error=True)


class UserCtx(BaseModel):
    user_id: str
    email: str
    name: str
    org_id: str
    role: str = ""          # membership role, filled in by require_org


def require_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> UserCtx:
    """Validate the bearer JWT. Accepts wizard tokens (no org_id yet)."""
    try:
        payload = verify_token(credentials.credentials, request.app.state.settings.session_secret)
        return UserCtx(
            user_id=payload["sub"],
            email=payload.get("email", ""),
            name=payload.get("name", ""),
            org_id=payload.get("org_id", ""),
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None


def _member_role(db: Database, user_id: str, org_id: str) -> str | None:
    with db.get_session_direct() as session:
        return session.exec(
            select(Membership.role).where(Membership.user_id == user_id, Membership.org_id == org_id)
        ).first()


async def require_org(request: Request, ctx: UserCtx = Depends(require_user)) -> UserCtx:
    """Require a full token for an organisation the user still belongs to.

    Async on purpose: the tenant ContextVar set here must be visible to the
    (threadpool) endpoint, which only inherits context from the request task.
    """
    if not ctx.org_id:
        raise HTTPException(status_code=403, detail="Organization context required — complete org setup first")
    role = await run_in_threadpool(_member_role, request.app.state.db, ctx.user_id, ctx.org_id)
    if role is None:
        raise HTTPException(status_code=403, detail="You are no longer a member of this organization")
    tenancy.set_org(ctx.org_id)
    return ctx.model_copy(update={"role": role})


def assert_admin(ctx: UserCtx) -> None:
    if ctx.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")


async def require_admin(ctx: UserCtx = Depends(require_org)) -> UserCtx:
    """require_org + owner/admin role. Use on endpoints that change org settings."""
    assert_admin(ctx)
    return ctx
