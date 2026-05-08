import httpx
from fastapi import APIRouter, HTTPException

from candid.schemas import GoogleAuthRequest


class AuthRouter:
    def __init__(self) -> None:
        self.router = APIRouter(prefix="/auth", tags=["auth"])
        self._register()

    def _register(self) -> None:
        @self.router.post("/google")
        async def google_auth(body: GoogleAuthRequest):
            return await self._verify(body.token)

    async def _verify(self, token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token},
            )
        if resp.status_code != 200:
            raise HTTPException(401, "Invalid Google token")
        data = resp.json()
        return {
            "id": data.get("sub"),
            "name": data.get("name"),
            "email": data.get("email"),
            "picture": data.get("picture"),
        }
