from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://candid:password@localhost:5432/candid"
    fernet_key: Optional[str] = None
    session_secret: str                         # required: no default, so it can never be guessed

    @field_validator("session_secret")
    @classmethod
    def _check_secret_length(cls, v: str) -> str:
        if "change-me" in v or "change-in-production" in v:
            raise ValueError("SESSION_SECRET still holds the example placeholder — generate a real one")
        if len(v.encode()) < 32:
            raise ValueError(
                f"SESSION_SECRET is {len(v.encode())} bytes — must be ≥32. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v
    google_client_id: Optional[str] = None
    cors_origins: str = "http://localhost:8080,https://localhost:8080"   # comma-separated; "*" allows any origin
    app_url: str = "http://localhost:8080"
    upload_dir: str = "uploads"                 # interview audio + candidate video answers (CVs live in the DB)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
