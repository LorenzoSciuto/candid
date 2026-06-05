from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://candid:password@localhost:5432/candid"
    fernet_key: Optional[str] = None
    session_secret: str = "dev-secret-change-in-production!!"

    @field_validator("session_secret")
    @classmethod
    def _check_secret_length(cls, v: str) -> str:
        if len(v.encode()) < 32:
            raise ValueError(
                f"SESSION_SECRET is {len(v.encode())} bytes — must be ≥32. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v
    google_client_id: Optional[str] = None
    cors_origins: str = "*"
    app_url: str = "http://localhost:8080"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
