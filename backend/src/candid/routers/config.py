import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_admin, require_org
from candid.commons.models import OrgApiKey, OrgConfig
from candid.commons.pipeline import DEFAULT_STAGES
from candid.commons.schemas import (
    CURRENCIES,
    DATE_FORMATS,
    DEFAULT_LOCATIONS,
    ApiKeyUpsert,
    ConfigUpdate,
    EmailConfigResponse,
    EmailConfigUpdate,
    PreferencesResponse,
    PreferencesUpdate,
)
from candid.services.crypto import CryptoService

logger = logging.getLogger(__name__)

_PROVIDERS = ("openai", "anthropic", "gemini", "groq")



class StagesUpdate(BaseModel):
    stages: list[dict]


class ConfigRouter:
    def __init__(self, db: Database, crypto: CryptoService) -> None:
        self._db = db
        self._crypto = crypto
        self.router = APIRouter(prefix="/config", tags=["config"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("")
        def get_config(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get(session, user.org_id)

        @self.router.put("")
        def save_config(
            body: ConfigUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_admin),
        ):
            return self._save(session, user.org_id, body)

        @self.router.get("/keys")
        def get_keys(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get_keys(session, user.org_id)

        @self.router.put("/keys")
        def upsert_key(
            body: ApiKeyUpsert,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_admin),
        ):
            return self._upsert_key(session, user.org_id, body)

        @self.router.delete("/keys/{provider}", status_code=204)
        def delete_key(
            provider: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_admin),
        ):
            self._delete_key(session, user.org_id, provider)

        @self.router.get("/email", response_model=EmailConfigResponse)
        def get_email_config(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get_email(session, user.org_id)

        @self.router.put("/email", response_model=EmailConfigResponse)
        def save_email_config(
            body: EmailConfigUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_admin),
        ):
            return self._save_email(session, user.org_id, body)

        @self.router.post("/test")
        def test_config(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_admin),
        ):
            return self._test(session, user.org_id)

        @self.router.get("/preferences", response_model=PreferencesResponse)
        def get_preferences(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get_preferences(session, user.org_id)

        @self.router.put("/preferences", response_model=PreferencesResponse)
        def save_preferences(
            body: PreferencesUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._save_preferences(session, user.org_id, body)

        @self.router.get("/stages")
        def get_stages(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get_stages(session, user.org_id)

        @self.router.put("/stages")
        def save_stages(
            body: StagesUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_admin),
        ):
            return self._save_stages(session, user.org_id, body.stages)

    # ── Implementations ────────────────────────────────────────────────────────

    def _get(self, session: Session, org_id: str) -> dict:
        cfg = session.get(OrgConfig, org_id)
        provider = cfg.provider if cfg else "openai"
        model_name = cfg.model_name if cfg else "gpt-4o"
        masked = ""
        key_row = session.exec(
            select(OrgApiKey).where(OrgApiKey.org_id == org_id, OrgApiKey.provider == provider)
        ).first()
        if key_row and key_row.encrypted_key:
            try:
                masked = self._crypto.mask(self._crypto.decrypt(key_row.encrypted_key))
            except Exception:
                masked = "****"
        return {"provider": provider, "model_name": model_name, "api_key_masked": masked}

    def _save(self, session: Session, org_id: str, body: ConfigUpdate) -> dict:
        cfg = session.get(OrgConfig, org_id)
        if not cfg:
            cfg = OrgConfig(org_id=org_id)
        cfg.provider = body.provider
        cfg.model_name = body.model_name
        if body.api_key and not body.api_key.startswith("****"):
            self._upsert_key(session, org_id, ApiKeyUpsert(provider=body.provider, api_key=body.api_key))
        session.add(cfg)
        session.commit()
        return {"ok": True}

    def _get_keys(self, session: Session, org_id: str) -> dict:
        rows = session.exec(select(OrgApiKey).where(OrgApiKey.org_id == org_id)).all()
        result = {p: "" for p in _PROVIDERS}
        for row in rows:
            if row.encrypted_key:
                try:
                    result[row.provider] = self._crypto.mask(self._crypto.decrypt(row.encrypted_key))
                except Exception:
                    result[row.provider] = "****"
        return result

    def _upsert_key(self, session: Session, org_id: str, body: ApiKeyUpsert) -> dict:
        if body.provider not in _PROVIDERS:
            raise HTTPException(400, f"Unknown provider: {body.provider}")
        try:
            row = session.exec(
                select(OrgApiKey).where(OrgApiKey.org_id == org_id, OrgApiKey.provider == body.provider)
            ).first()
            if not row:
                row = OrgApiKey(org_id=org_id, provider=body.provider)
            row.encrypted_key = self._crypto.encrypt(body.api_key)
            session.add(row)
            session.commit()
        except RuntimeError as e:
            raise HTTPException(500, str(e)) from e
        except Exception:
            logger.exception("Failed to save API key")
            raise HTTPException(500, "Failed to save key") from None
        return {"ok": True}

    def _delete_key(self, session: Session, org_id: str, provider: str) -> None:
        if provider not in _PROVIDERS:
            raise HTTPException(400, f"Unknown provider: {provider}")
        row = session.exec(
            select(OrgApiKey).where(OrgApiKey.org_id == org_id, OrgApiKey.provider == provider)
        ).first()
        if row:
            session.delete(row)
            session.commit()

    def _get_stages(self, session: Session, org_id: str) -> list:
        cfg = session.get(OrgConfig, org_id)
        if cfg and cfg.stages_json:
            try:
                return json.loads(cfg.stages_json)
            except ValueError:
                logger.warning("Invalid stages_json for org %s; using defaults", org_id)
        return DEFAULT_STAGES

    def _save_stages(self, session: Session, org_id: str, stages: list) -> dict:
        for stage in stages:
            if not stage.get("id") or not stage.get("label"):
                raise HTTPException(400, "Each stage needs 'id' and 'label'")
        cfg = session.get(OrgConfig, org_id)
        if not cfg:
            cfg = OrgConfig(org_id=org_id)
        cfg.stages_json = json.dumps(stages)
        session.add(cfg)
        session.commit()
        return {"ok": True, "stages": stages}

    def _get_preferences(self, session: Session, org_id: str) -> PreferencesResponse:
        cfg = session.get(OrgConfig, org_id)
        if not cfg:
            return PreferencesResponse()
        return PreferencesResponse(
            date_format=cfg.date_format,
            currency=cfg.currency,
            locations=json.loads(cfg.locations_json) if cfg.locations_json else list(DEFAULT_LOCATIONS),
        )

    def _save_preferences(self, session: Session, org_id: str, body: PreferencesUpdate) -> PreferencesResponse:
        if body.date_format is not None and body.date_format not in DATE_FORMATS:
            raise HTTPException(400, f"Unsupported date_format: {body.date_format}")
        if body.currency is not None and body.currency not in CURRENCIES:
            raise HTTPException(400, f"Unsupported currency: {body.currency}")
        cfg = session.get(OrgConfig, org_id) or OrgConfig(org_id=org_id)
        if body.date_format is not None:
            cfg.date_format = body.date_format
        if body.currency is not None:
            cfg.currency = body.currency
        if body.locations is not None:
            # Trim, drop blanks and duplicates while keeping the user's order.
            cleaned = list(dict.fromkeys(loc.strip()[:100] for loc in body.locations if loc.strip()))
            cfg.locations_json = json.dumps(cleaned)
        session.add(cfg)
        session.commit()
        return self._get_preferences(session, org_id)

    def _get_email(self, session: Session, org_id: str) -> EmailConfigResponse:
        cfg = session.get(OrgConfig, org_id)
        if not cfg:
            return EmailConfigResponse()
        return EmailConfigResponse(
            smtp_host=cfg.smtp_host,
            smtp_port=cfg.smtp_port,
            smtp_user=cfg.smtp_user,
            smtp_password_set=bool(cfg.smtp_password_encrypted),
            smtp_from=cfg.smtp_from,
        )

    def _save_email(self, session: Session, org_id: str, body: EmailConfigUpdate) -> EmailConfigResponse:
        cfg = session.get(OrgConfig, org_id)
        if not cfg:
            cfg = OrgConfig(org_id=org_id)
        cfg.smtp_host = body.smtp_host
        cfg.smtp_port = body.smtp_port
        cfg.smtp_user = body.smtp_user
        cfg.smtp_from = body.smtp_from
        if body.smtp_password is not None:
            cfg.smtp_password_encrypted = self._crypto.encrypt(body.smtp_password) if body.smtp_password else None
        session.add(cfg)
        session.commit()
        return EmailConfigResponse(
            smtp_host=cfg.smtp_host,
            smtp_port=cfg.smtp_port,
            smtp_user=cfg.smtp_user,
            smtp_password_set=bool(cfg.smtp_password_encrypted),
            smtp_from=cfg.smtp_from,
        )

    def _test(self, session: Session, org_id: str) -> dict:
        from candid.services.ai_engine import AIEngineFactory
        factory = AIEngineFactory(self._crypto)
        try:
            engine = factory.from_session(session, org_id)
            if not engine._api_key:
                raise ValueError("No API key configured.")
            engine._call('{"test": "ok"}')
            return {"ok": True, "provider": engine._provider, "model": engine._model}
        except Exception as exc:
            raise HTTPException(400, str(exc)) from exc
