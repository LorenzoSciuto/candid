from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.models import ApiKey, Config
from candid.schemas import ApiKeyUpsert, ConfigUpdate
from candid.services.crypto import CryptoService

_PROVIDERS = ("openai", "anthropic", "gemini", "groq")


class ConfigRouter:
    def __init__(self, db: Database, crypto: CryptoService) -> None:
        self._db = db
        self._crypto = crypto
        self.router = APIRouter(prefix="/config", tags=["config"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/")
        def get_config(session: Session = Depends(db.get_session)):
            return self._get(session)

        @self.router.put("/")
        def save_config(body: ConfigUpdate, session: Session = Depends(db.get_session)):
            return self._save(session, body)

        @self.router.get("/keys")
        def get_keys(session: Session = Depends(db.get_session)):
            return self._get_keys(session)

        @self.router.put("/keys")
        def upsert_key(body: ApiKeyUpsert, session: Session = Depends(db.get_session)):
            return self._upsert_key(session, body)

        @self.router.post("/test")
        def test_config(session: Session = Depends(db.get_session)):
            return self._test(session)

    # ── Implementations ────────────────────────────────────────────────────────

    def _get(self, session: Session) -> dict:
        cfg = session.get(Config, 1)
        if not cfg:
            return {"provider": "openai", "model_name": "gpt-4o", "api_key_masked": ""}
        masked = ""
        key_row = session.get(ApiKey, cfg.provider)
        if key_row and key_row.encrypted_key:
            try:
                masked = self._crypto.mask(self._crypto.decrypt(key_row.encrypted_key))
            except Exception:
                masked = "****"
        elif cfg.encrypted_api_key:
            try:
                masked = self._crypto.mask(self._crypto.decrypt(cfg.encrypted_api_key))
            except Exception:
                masked = "****"
        return {"provider": cfg.provider, "model_name": cfg.model_name, "api_key_masked": masked}

    def _save(self, session: Session, body: ConfigUpdate) -> dict:
        cfg = session.get(Config, 1)
        if not cfg:
            cfg = Config(id=1)
        cfg.provider = body.provider
        cfg.model_name = body.model_name
        # If an api_key was passed here, also upsert it to ApiKey table
        if body.api_key and not body.api_key.startswith("****"):
            self._upsert_key(session, ApiKeyUpsert(provider=body.provider, api_key=body.api_key))
        session.add(cfg)
        session.commit()
        return {"ok": True}

    def _get_keys(self, session: Session) -> dict:
        rows = session.exec(select(ApiKey)).all()
        result = {p: "" for p in _PROVIDERS}
        for row in rows:
            if row.encrypted_key:
                try:
                    result[row.provider] = self._crypto.mask(self._crypto.decrypt(row.encrypted_key))
                except Exception:
                    result[row.provider] = "****"
        return result

    def _upsert_key(self, session: Session, body: ApiKeyUpsert) -> dict:
        if body.provider not in _PROVIDERS:
            raise HTTPException(400, f"Unknown provider: {body.provider}")
        row = session.get(ApiKey, body.provider)
        if not row:
            row = ApiKey(provider=body.provider)
        row.encrypted_key = self._crypto.encrypt(body.api_key)
        session.add(row)
        session.commit()
        return {"ok": True}

    def _test(self, session: Session) -> dict:
        from candid.services.ai_engine import AIEngineFactory

        factory = AIEngineFactory(self._crypto)
        try:
            engine = factory.from_session(session)
            if not engine._api_key:
                raise ValueError("No API key configured.")
            engine._call('{"test": "ok"}')
            return {"ok": True, "provider": engine._provider, "model": engine._model}
        except Exception as exc:
            raise HTTPException(400, str(exc)) from exc
