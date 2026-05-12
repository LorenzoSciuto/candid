from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://candid:password@localhost:5432/candid"
    fernet_key: Optional[str] = None       # required for API key encryption
    session_secret: str = "dev-secret-change-in-production"
    default_provider: str = "openai"
    default_model: str = "gpt-4o"
    # Auth
    google_client_id: Optional[str] = None  # enables Google SSO; set in .env
    demo_mode: bool = True                   # set False in production to disable /auth/demo
    # CORS — comma-separated list or "*"
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
