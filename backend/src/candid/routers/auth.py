import logging
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from candid.config import Settings
from candid.database import Database
from candid.dependencies import UserCtx, require_user
from candid.models import Invitation, Membership, Organization, User
from candid.schemas import GoogleAuthRequest, OrgCreate, SwitchOrgRequest
from datetime import date
from candid.services.auth_service import create_token


class UserUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    department: str | None = None
    picture: str | None = None


class AcceptInviteRequest(BaseModel):
    token: str = ""
    invitation_id: str = ""

logger = logging.getLogger(__name__)


class AuthRouter:
    def __init__(self, settings: Settings, db: Database) -> None:
        self._settings = settings
        self._db = db
        self.router = APIRouter(prefix="/auth", tags=["auth"])
        self._register()

    def _register(self) -> None:
        settings = self._settings
        db = self._db

        @self.router.get("/config")
        def auth_config():
            return {"google_client_id": settings.google_client_id or None}

        @self.router.post("/google")
        async def google_auth(
            body: GoogleAuthRequest,
            session: Session = Depends(db.get_session),
        ):
            if not settings.google_client_id:
                raise HTTPException(400, "Google SSO is not configured on this server")
            return await self._verify_google(body.token, session)

        @self.router.post("/switch-org")
        def switch_org(
            body: SwitchOrgRequest,
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_user),
        ):
            mbr = session.exec(
                select(Membership).where(
                    Membership.user_id == ctx.user_id,
                    Membership.org_id == body.org_id,
                )
            ).first()
            if not mbr:
                raise HTTPException(403, "Not a member of this organization")
            token = create_token(
                {"sub": ctx.user_id, "email": ctx.email, "name": ctx.name, "org_id": body.org_id},
                settings.session_secret,
            )
            org = session.get(Organization, body.org_id)
            return {"token": token, "org_id": body.org_id, "org_name": org.name if org else ""}

        @self.router.post("/organizations")
        def create_org(
            body: OrgCreate,
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_user),
        ):
            return self._create_org_response(session, ctx.user_id, body.name, settings.session_secret)

        @self.router.post("/accept-invite")
        def accept_invite_wizard(
            body: AcceptInviteRequest,
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_user),
        ):
            return self._accept_invite_wizard(
                session, ctx,
                token=body.token,
                invitation_id=body.invitation_id,
            )

        @self.router.patch("/users/me")
        def update_me(
            body: UserUpdate,
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_user),
        ):
            user = session.get(User, ctx.user_id)
            if not user:
                raise HTTPException(404, "User not found")
            if body.name:
                user.name = body.name
            if body.title is not None:
                user.title = body.title
            if body.department is not None:
                user.department = body.department
            if body.picture is not None:
                user.picture = body.picture
            session.add(user)
            session.commit()
            session.refresh(user)
            return {"ok": True, "name": user.name, "title": user.title, "department": user.department, "picture": user.picture}

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _verify_google(self, token: str, session: Session) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token},
            )
        if resp.status_code != 200:
            raise HTTPException(401, "Invalid Google token")
        data = resp.json()
        if data.get("aud") != self._settings.google_client_id:
            raise HTTPException(401, "Token audience mismatch — not issued for this application")
        user_id = data.get("sub")
        if not user_id:
            raise HTTPException(401, "Token missing subject claim")
        user = self._upsert_user(
            session, user_id=user_id,
            email=data.get("email", ""),
            name=data.get("name", ""),
            picture=data.get("picture"),
        )
        return self._build_login_response(session, user)

    def _upsert_user(self, session, user_id, email, name, picture) -> User:
        user = session.get(User, user_id)
        if not user:
            user = User(id=user_id, email=email, name=name, picture=picture)
        else:
            user.name = name
            user.picture = picture
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    def _build_login_response(self, session: Session, user: User) -> dict:
        memberships = session.exec(
            select(Membership).where(Membership.user_id == user.id)
        ).all()

        if not memberships:
            # New user — issue a setup token (no org_id) and signal the wizard
            setup_token = create_token(
                {"sub": user.id, "email": user.email, "name": user.name},
                self._settings.session_secret,
            )
            # Fetch pending invitations for this email so wizard can show them
            pending_invs = session.exec(
                select(Invitation).where(
                    Invitation.email == user.email,
                    Invitation.accepted_at == None,  # noqa: E711
                )
            ).all()
            pending = []
            for inv in pending_invs:
                if inv.expires_at >= date.today().isoformat():
                    org = session.get(Organization, inv.org_id)
                    pending.append({
                        "invitation_id": inv.id,
                        "org_id": inv.org_id,
                        "org_name": org.name if org else inv.org_id,
                        "role": inv.role,
                    })
            return {
                "id": user.id, "email": user.email, "name": user.name, "picture": user.picture,
                "title": user.title,
                "token": setup_token, "needs_org_setup": True,
                "pending_invitations": pending,
            }

        org_id = memberships[0].org_id
        orgs = []
        for mbr in memberships:
            org = session.get(Organization, mbr.org_id)
            if org:
                orgs.append({"id": org.id, "name": org.name, "role": mbr.role})

        token = create_token(
            {"sub": user.id, "email": user.email, "name": user.name, "org_id": org_id},
            self._settings.session_secret,
        )
        return {
            "id": user.id, "email": user.email, "name": user.name, "picture": user.picture,
            "title": user.title,
            "token": token, "org_id": org_id, "orgs": orgs,
        }

    def _create_org_response(self, session, user_id, name, secret) -> dict:
        org = self._create_org(session, user_id, name)
        user = session.get(User, user_id)
        token = create_token(
            {
                "sub": user_id,
                "email": user.email if user else "",
                "name": user.name if user else "",
                "org_id": org.id,
            },
            secret,
        )
        return {"ok": True, "org": {"id": org.id, "name": org.name}, "token": token}

    def _accept_invite_wizard(self, session: Session, ctx: UserCtx, token: str = "", invitation_id: str = "") -> dict:
        if not token and not invitation_id:
            raise HTTPException(400, "Invitation token or ID required")
        if invitation_id:
            inv = session.get(Invitation, invitation_id)
            if inv and inv.email != ctx.email:
                raise HTTPException(403, "This invitation is for a different email address")
        else:
            inv = session.exec(select(Invitation).where(Invitation.token == token)).first()
        if not inv:
            raise HTTPException(404, "Invalid or expired invitation")
        if inv.accepted_at:
            raise HTTPException(410, "Invitation already accepted")
        if inv.expires_at < date.today().isoformat():
            raise HTTPException(410, "Invitation has expired")
        existing = session.exec(
            select(Membership).where(
                Membership.org_id == inv.org_id,
                Membership.user_id == ctx.user_id,
            )
        ).first()
        if not existing:
            session.add(Membership(org_id=inv.org_id, user_id=ctx.user_id, role=inv.role))
        inv.accepted_at = date.today().isoformat()
        session.add(inv)
        session.commit()
        new_token = create_token(
            {
                "sub": ctx.user_id,
                "email": ctx.email,
                "name": ctx.name,
                "org_id": inv.org_id,
            },
            self._settings.session_secret,
        )
        org = session.get(Organization, inv.org_id)
        return {
            "ok": True,
            "org": {"id": inv.org_id, "name": org.name if org else ""},
            "token": new_token,
            "org_id": inv.org_id,
        }

    def _create_org(self, session: Session, owner_id: str, name: str) -> Organization:
        slug = re.sub(r"[\s_-]+", "-", re.sub(r"[^\w\s-]", "", name.lower().strip()))[:50]
        base = slug
        i = 2
        while session.exec(select(Organization).where(Organization.slug == slug)).first():
            slug = f"{base}-{i}"
            i += 1
        org = Organization(name=name, slug=slug, owner_id=owner_id)
        session.add(org)
        session.flush()
        session.add(Membership(org_id=org.id, user_id=owner_id, role="owner"))
        session.commit()
        session.refresh(org)
        return org
