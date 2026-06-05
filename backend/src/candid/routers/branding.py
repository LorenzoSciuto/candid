import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Organization
from candid.schemas import BrandingConfig, BrandingUpdate


class BrandingRouter:
    def __init__(self, database: Database) -> None:
        self._database = database
        self.router = APIRouter(tags=["branding"])
        self._register()

    def _register(self) -> None:
        database = self._database

        @self.router.get("/public/organizations/{org_slug}/branding")
        def get_public_branding(
            org_slug: str,
            session: Session = Depends(database.get_session),
        ):
            return self._get_public_branding(session, org_slug)

        @self.router.get("/organizations/current/branding")
        def get_current_branding(
            session: Session = Depends(database.get_session),
            ctx: UserCtx = Depends(require_org),
        ):
            return self._get_current_branding(session, ctx)

        @self.router.patch("/organizations/current/branding")
        def update_branding(
            body: BrandingUpdate,
            session: Session = Depends(database.get_session),
            ctx: UserCtx = Depends(require_org),
        ):
            return self._update_branding(session, ctx, body)

    # ── Implementations ────────────────────────────────────────────────────────

    def _get_public_branding(self, session: Session, org_slug: str) -> dict:
        organization_record = self._find_org_by_slug(session, org_slug)
        if not organization_record:
            raise HTTPException(404, "Organization not found")
        return self._build_branding_response(organization_record)

    def _get_current_branding(self, session: Session, ctx: UserCtx) -> dict:
        organization_record = session.get(Organization, ctx.org_id)
        if not organization_record:
            raise HTTPException(404, "Organization not found")
        return self._build_branding_response(organization_record)

    def _update_branding(self, session: Session, ctx: UserCtx, body: BrandingUpdate) -> dict:
        organization_record = session.get(Organization, ctx.org_id)
        if not organization_record:
            raise HTTPException(404, "Organization not found")
        merged_config = self._merge_branding(organization_record, body)
        organization_record.branding_config = json.dumps(merged_config)
        session.add(organization_record)
        session.commit()
        session.refresh(organization_record)
        return self._build_branding_response(organization_record)

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _find_org_by_slug(self, session: Session, org_slug: str):
        return session.exec(
            select(Organization).where(Organization.slug == org_slug)
        ).first()

    def _parse_branding_config(self, organization_record: Organization) -> dict:
        if not organization_record.branding_config:
            return {}
        try:
            return json.loads(organization_record.branding_config)
        except (json.JSONDecodeError, TypeError):
            return {}

    def _merge_branding(self, organization_record: Organization, body: BrandingUpdate) -> dict:
        existing_config = self._parse_branding_config(organization_record)
        merged = {**existing_config}
        for field_name, field_value in body.model_dump(exclude_unset=True).items():
            if field_value is None:
                merged.pop(field_name, None)
            else:
                merged[field_name] = field_value
        return merged

    def _build_branding_response(self, organization_record: Organization) -> dict:
        branding_configuration = self._parse_branding_config(organization_record)
        return {
            "org_id": organization_record.id,
            "org_name": organization_record.name,
            "primary_color": branding_configuration.get("primary_color"),
            "background_color": branding_configuration.get("background_color"),
            "font_family": branding_configuration.get("font_family"),
            "logo_url": branding_configuration.get("logo_url"),
        }
