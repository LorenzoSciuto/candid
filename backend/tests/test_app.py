"""The composition root wires every router and refuses unsafe configuration."""
import importlib

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

_ENV = {
    "DATABASE_URL": "sqlite://",
    "SESSION_SECRET": "a" * 64,
    "FERNET_KEY": "Bx_RzRCOqO-3t6G3bXGF2eVZKHHZ7mfYF4oJwGrJ7Zg=",
}


@pytest.fixture
def app_module(monkeypatch: pytest.MonkeyPatch):
    for key, value in _ENV.items():
        monkeypatch.setenv(key, value)
    import candid.app
    return importlib.reload(candid.app)


def test_application_should_mount_all_routers(app_module) -> None:
    paths = set(app_module.app.openapi()["paths"])
    for expected in ("/auth/google", "/candidates", "/interviews", "/video-interviews",
                     "/public/organizations/{org_slug}/jobs", "/public/video/{token}", "/config/preferences"):
        assert expected in paths


def test_data_endpoints_should_require_a_token(app_module) -> None:
    client = TestClient(app_module.app)  # no lifespan: never touches the database
    assert client.get("/").status_code == 200
    assert client.get("/candidates").status_code in (401, 403)


@pytest.mark.parametrize("secret", ["", "short", "change-me-in-production-use-a-real-secret"])
def test_settings_should_reject_missing_short_or_placeholder_secret(monkeypatch: pytest.MonkeyPatch, secret: str) -> None:
    from candid.commons.config import Settings
    monkeypatch.setenv("SESSION_SECRET", secret)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
