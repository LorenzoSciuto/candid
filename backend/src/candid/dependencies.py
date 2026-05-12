from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from candid.config import Settings
from candid.services.auth_service import verify_token

_bearer = HTTPBearer(auto_error=True)


def _get_settings() -> Settings:
    return Settings()


def require_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
    settings: Settings = Depends(_get_settings),
) -> dict:
    try:
        return verify_token(credentials.credentials, settings.session_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
