from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

_ALGORITHM = "HS256"
_TTL_HOURS = 48


def create_token(payload: dict[str, Any], secret: str) -> str:
    data = {
        **payload,
        "exp": datetime.now(timezone.utc) + timedelta(hours=_TTL_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(data, secret, algorithm=_ALGORITHM)


def verify_token(token: str, secret: str) -> dict[str, Any]:
    return jwt.decode(token, secret, algorithms=[_ALGORITHM])
