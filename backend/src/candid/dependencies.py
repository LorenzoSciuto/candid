from functools import lru_cache

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from candid.config import Settings
from candid.services.auth_service import verify_token

_bearer = HTTPBearer(auto_error=True)


@lru_cache(maxsize=1)
def _get_settings() -> Settings:
    return Settings()


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


def require_org(ctx: UserCtx = Depends(require_user)) -> UserCtx:
    """Like require_user but rejects wizard/setup tokens that have no org_id."""
    if not ctx.org_id:
        raise HTTPException(
            status_code=403,
            detail="Organization context required — complete org setup first",
        )
    return ctx
