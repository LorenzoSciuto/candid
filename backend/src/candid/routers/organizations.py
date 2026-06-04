import logging
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from candid.config import Settings
from candid.database import Database
from candid.dependencies import UserCtx, require_org, require_user
from candid.models import (
    Candidate,
    Employee,
    Evaluation,
    Interview,
    Invitation,
    JobDescription,
    Membership,
    OrgApiKey,
    OrgConfig,
    Organization,
    Role,
    User,
)
from candid.schemas import InviteRequest
from candid.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class MemberRoleUpdate(BaseModel):
    role: str


class OrganizationsRouter:
    def __init__(
        self,
        db: Database,
        email_service,
        settings: Settings | None = None,
        notification_service: NotificationService | None = None,
    ) -> None:
        self._db = db
        self._email = email_service
        self._settings = settings or Settings()
        self._notification_service = notification_service or NotificationService()
        self.router = APIRouter(prefix="/organizations", tags=["organizations"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("")
        def list_orgs(
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_user),
        ):
            return self._list_orgs(session, ctx)

        @self.router.get("/current")
        def get_current(
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_org),
        ):
            return self._get_current(session, ctx)

        @self.router.post("/current/invite", status_code=201)
        def invite(
            body: InviteRequest,
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_org),
        ):
            return self._invite(session, ctx, body)

        @self.router.patch("/current/members/{user_id}")
        def update_member_role(
            user_id: str,
            body: MemberRoleUpdate,
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_org),
        ):
            return self._update_member_role(session, ctx, user_id, body.role)

        @self.router.delete("/current/members/{user_id}", status_code=204)
        def remove_member(
            user_id: str,
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_org),
        ):
            self._remove_member(session, ctx, user_id)

        @self.router.delete("/current", status_code=204)
        def delete_org(
            session: Session = Depends(db.get_session),
            ctx: UserCtx = Depends(require_org),
        ):
            self._delete_org(session, ctx)

        # Public endpoint — no auth required
        @self.router.get("/invitations/accept", include_in_schema=True)
        def accept_invitation(
            token: str,
            session: Session = Depends(db.get_session),
        ):
            return self._accept_invitation(session, token)

    # ── Implementations ────────────────────────────────────────────────────────

    def _list_orgs(self, session: Session, ctx: UserCtx) -> list:
        memberships = session.exec(
            select(Membership).where(Membership.user_id == ctx.user_id)
        ).all()
        result = []
        for mbr in memberships:
            org = session.get(Organization, mbr.org_id)
            if org:
                result.append({"id": org.id, "name": org.name, "role": mbr.role})
        return result

    def _get_current(self, session: Session, ctx: UserCtx) -> dict:
        org = session.get(Organization, ctx.org_id)
        if not org:
            raise HTTPException(404, "Organization not found")
        memberships = session.exec(
            select(Membership).where(Membership.org_id == ctx.org_id)
        ).all()
        members = []
        for mbr in memberships:
            user = session.get(User, mbr.user_id)
            members.append({
                "user_id": mbr.user_id,
                "name": user.name if user else mbr.user_id,
                "email": user.email if user else "",
                "picture": user.picture if user else None,
                "role": mbr.role,
                "title": user.title if user else None,
                "department": user.department if user else None,
                "joined_at": mbr.joined_at,
            })
        # Pending invitations
        pending = session.exec(
            select(Invitation).where(
                Invitation.org_id == ctx.org_id,
                Invitation.accepted_at.is_(None),  # type: ignore[attr-defined]
            )
        ).all()
        invitations = [
            {"id": inv.id, "email": inv.email, "role": inv.role, "created_at": inv.created_at}
            for inv in pending
        ]
        return {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "owner_id": org.owner_id,
            "members": members,
            "pending_invitations": invitations,
        }

    def _invite(self, session: Session, ctx: UserCtx, body: InviteRequest) -> dict:
        self._require_admin(session, ctx)
        org = session.get(Organization, ctx.org_id)
        if not org:
            raise HTTPException(404, "Organization not found")
        inviter = session.get(User, ctx.user_id)
        inviter_name = inviter.name if inviter else ctx.name

        # Check if already a member
        existing_user = session.exec(
            select(User).where(User.email == body.email)
        ).first()
        if existing_user:
            existing_mbr = session.exec(
                select(Membership).where(
                    Membership.org_id == ctx.org_id,
                    Membership.user_id == existing_user.id,
                )
            ).first()
            if existing_mbr:
                raise HTTPException(409, "User is already a member of this organization")

        token = uuid.uuid4().hex
        expires = (date.today() + timedelta(days=7)).isoformat()
        inv = Invitation(
            org_id=ctx.org_id,
            email=body.email,
            token=token,
            role=body.role,
            invited_by=ctx.user_id,
            expires_at=expires,
        )
        session.add(inv)
        session.commit()

        try:
            self._email.send_invitation(
                to_email=body.email,
                org_name=org.name,
                inviter_name=inviter_name,
                token=token,
            )
        except Exception:
            logger.exception("Failed to send invitation email")

        return {"ok": True, "invitation_id": inv.id}

    def _update_member_role(self, session: Session, ctx: UserCtx, user_id: str, role: str) -> dict:
        self._require_admin(session, ctx)
        if role not in ("owner", "admin", "member"):
            raise HTTPException(400, "role must be owner, admin, or member")
        mbr = session.exec(
            select(Membership).where(
                Membership.org_id == ctx.org_id,
                Membership.user_id == user_id,
            )
        ).first()
        if not mbr:
            raise HTTPException(404, "Member not found")
        org = session.get(Organization, ctx.org_id)
        if org and org.owner_id == user_id and role != "owner":
            raise HTTPException(400, "Cannot demote the organization owner")
        mbr.role = role
        session.add(mbr)
        session.commit()
        return {"ok": True, "role": role}

    def _remove_member(self, session: Session, ctx: UserCtx, user_id: str) -> None:
        self._require_admin(session, ctx)
        if user_id == ctx.user_id:
            raise HTTPException(400, "Cannot remove yourself")
        mbr = session.exec(
            select(Membership).where(
                Membership.org_id == ctx.org_id,
                Membership.user_id == user_id,
            )
        ).first()
        if not mbr:
            raise HTTPException(404, "Member not found")
        org = session.get(Organization, ctx.org_id)
        if org and org.owner_id == user_id:
            raise HTTPException(400, "Cannot remove the organization owner")
        session.delete(mbr)
        session.commit()

    def _accept_invitation(self, session: Session, token: str):
        inv = session.exec(
            select(Invitation).where(Invitation.token == token)
        ).first()
        if not inv:
            raise HTTPException(404, "Invalid or expired invitation")
        if inv.accepted_at:
            raise HTTPException(410, "Invitation already accepted")
        if inv.expires_at < date.today().isoformat():
            raise HTTPException(410, "Invitation has expired")

        self._apply_membership(session, inv)

        inv.accepted_at = date.today().isoformat()
        session.add(inv)
        session.commit()

        self._notify_invitation_accepted(session, inv)

        redirect_url = f"{self._settings.app_url}/index.html#?invite_accepted=1&org_id={inv.org_id}"
        return RedirectResponse(url=redirect_url, status_code=302)

    def _apply_membership(self, session: Session, inv: Invitation) -> None:
        invitee = session.exec(select(User).where(User.email == inv.email)).first()
        if not invitee:
            return
        existing_membership = session.exec(
            select(Membership).where(
                Membership.org_id == inv.org_id,
                Membership.user_id == invitee.id,
            )
        ).first()
        if not existing_membership:
            session.add(Membership(org_id=inv.org_id, user_id=invitee.id, role=inv.role))

    def _notify_invitation_accepted(self, session: Session, inv: Invitation) -> None:
        org = session.get(Organization, inv.org_id)
        if not org:
            return
        self._notification_service.create_invitation_accepted_notification(
            session=session,
            org_id=inv.org_id,
            user_id=inv.invited_by,
            invitee_email=inv.email,
            org_name=org.name,
        )

    def _delete_org(self, session: Session, ctx: UserCtx) -> None:
        org = session.get(Organization, ctx.org_id)
        if not org:
            raise HTTPException(404, "Organization not found")
        if org.owner_id != ctx.user_id:
            raise HTTPException(403, "Only the organization owner can delete the organization")

        # Delete in FK-safe order: dependents before parents
        for stmt in [
            select(Evaluation).where(Evaluation.org_id == ctx.org_id),
            select(Interview).where(Interview.org_id == ctx.org_id),
            select(Employee).where(Employee.org_id == ctx.org_id),
            select(JobDescription).where(JobDescription.org_id == ctx.org_id),
            select(Candidate).where(Candidate.org_id == ctx.org_id),
            select(Role).where(Role.org_id == ctx.org_id),
            select(OrgApiKey).where(OrgApiKey.org_id == ctx.org_id),
            select(OrgConfig).where(OrgConfig.org_id == ctx.org_id),
            select(Invitation).where(Invitation.org_id == ctx.org_id),
            select(Membership).where(Membership.org_id == ctx.org_id),
        ]:
            for item in session.exec(stmt).all():
                session.delete(item)

        session.delete(org)
        session.commit()

    def _require_admin(self, session: Session, ctx: UserCtx) -> None:
        mbr = session.exec(
            select(Membership).where(
                Membership.org_id == ctx.org_id,
                Membership.user_id == ctx.user_id,
            )
        ).first()
        if not mbr or mbr.role not in ("owner", "admin"):
            raise HTTPException(403, "Admin access required")
