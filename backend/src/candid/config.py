from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://candid:password@localhost:5432/candid"
    fernet_key: Optional[str] = None
    session_secret: str = "dev-secret-change-in-production"
    google_client_id: Optional[str] = None
    cors_origins: str = "*"
    app_url: str = "http://localhost:8080"
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: str = "noreply@candid.app"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
