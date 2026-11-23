from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

_ALGORITHM = "HS256"
_DEFAULT_TTL_HOURS = 48


def create_token(payload: dict[str, Any], secret: str, ttl_hours: int = _DEFAULT_TTL_HOURS) -> str:
    data = {
        **payload,
        "exp": datetime.now(UTC) + timedelta(hours=ttl_hours),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(data, secret, algorithm=_ALGORITHM)


def verify_token(token: str, secret: str) -> dict[str, Any]:
    return jwt.decode(token, secret, algorithms=[_ALGORITHM])
