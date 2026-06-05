from functools import lru_cache
from typing import Generator

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlmodel import Session

from candid.config import Settings
from candid.database import Database
from candid.services.auth_service import verify_token
from candid.services.rls_service import RlsService

_bearer = HTTPBearer(auto_error=True)


@lru_cache(maxsize=1)
def _get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def _get_database() -> Database:
    return Database(_get_settings().database_url)


def _get_session() -> Generator[Session, None, None]:
    yield from _get_database().get_session()


class UserCtx(BaseModel):
    user_id: str
    email: str
    name: str
    org_id: str


def require_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
    settings: Settings = Depends(_get_settings),
) -> UserCtx:
    try:
        payload = verify_token(credentials.credentials, settings.session_secret)
        return UserCtx(
            user_id=payload["sub"],
            email=payload.get("email", ""),
            name=payload.get("name", ""),
            org_id=payload.get("org_id", ""),
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_org(
    ctx: UserCtx = Depends(require_user),
    session: Session = Depends(_get_session),
) -> UserCtx:
    """Like require_user but rejects wizard/setup tokens that have no org_id.

    Also sets the PostgreSQL session variable app.current_org_id so that
    RLS policies automatically filter every query to the authenticated org.
    """
    if not ctx.org_id:
        raise HTTPException(
            status_code=403,
            detail="Organization context required — complete org setup first",
        )
    RlsService().set_org_context(session, ctx.org_id)
    return ctx
