import httpx
from fastapi import APIRouter, HTTPException

from candid.config import Settings
from candid.schemas import GoogleAuthRequest
from candid.services.auth_service import create_token


class AuthRouter:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self.router = APIRouter(prefix="/auth", tags=["auth"])
        self._register()

    def _register(self) -> None:
        settings = self._settings

        @self.router.get("/config")
        def auth_config():
            """Public — returns auth configuration for the frontend."""
            return {
                "google_client_id": settings.google_client_id or None,
                "demo_mode": settings.demo_mode,
            }

        @self.router.post("/google")
        async def google_auth(body: GoogleAuthRequest):
            if not settings.google_client_id:
                raise HTTPException(400, "Google SSO is not configured on this server")
            return await self._verify_google(body.token)

        @self.router.post("/demo")
        def demo_auth():
            if not settings.demo_mode:
                raise HTTPException(403, "Demo mode is disabled")
            user = {"id": "demo", "name": "Demo User", "email": "demo@candid.app", "picture": None}
            token = create_token(
                {"sub": user["id"], "email": user["email"], "name": user["name"]},
                settings.session_secret,
            )
            return {**user, "token": token}

    async def _verify_google(self, token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token},
            )
        if resp.status_code != 200:
            raise HTTPException(401, "Invalid Google token")
        data = resp.json()
        user = {
            "id": data.get("sub"),
            "name": data.get("name"),
            "email": data.get("email"),
            "picture": data.get("picture"),
        }
        jwt_token = create_token(
            {"sub": user["id"], "email": user["email"], "name": user["name"]},
            self._settings.session_secret,
        )
        return {**user, "token": jwt_token}
