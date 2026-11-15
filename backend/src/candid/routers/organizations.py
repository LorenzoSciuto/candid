import logging
import shutil
import uuid
from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from candid.commons.config import Settings
from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, assert_admin, require_org, require_user
from candid.commons.models import (
    Candidate,
    EmailLog,
    Employee,
    Evaluation,
    Interview,
    Invitation,
    JobDescription,
    Membership,
    Notification,
    Organization,
    OrgApiKey,
    OrgConfig,
    PerformanceReview,
    Role,
    User,
    VideoInterview,
    VideoResponse,
)
from candid.commons.schemas import InviteRequest
from candid.services.email_service import EmailServiceFactory

logger = logging.getLogger(__name__)


# Ownership is tied to Organization.owner_id and cannot be granted via roles.
_ASSIGNABLE_ROLES = ("admin", "member")


class MemberRoleUpdate(BaseModel):
    role: str


class OrganizationsRouter:
    def __init__(
        self,
        db: Database,
        email_factory: EmailServiceFactory | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._db = db
        self._email_factory = email_factory
        self._settings = settings or Settings()
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
        assert_admin(ctx)
        if body.role not in _ASSIGNABLE_ROLES:
            raise HTTPException(400, "role must be admin or member")
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

        email_sent = False
        try:
            email_svc = self._email_factory.from_session(session, ctx.org_id) if self._email_factory else None
            if email_svc:
                email_svc.send_invitation(
                    to_email=body.email,
                    org_name=org.name,
                    inviter_name=inviter_name,
                    token=token,
                )
                email_sent = True
        except Exception:
            logger.exception("Failed to send invitation email")

        result = {"ok": True, "invitation_id": inv.id, "email_sent": email_sent}
        if not email_sent:
            # Without SMTP the admin shares the link manually (never written to server logs).
            result["invite_url"] = f"{self._settings.app_url}/index.html#accept-invite?token={token}"
        return result

    def _update_member_role(self, session: Session, ctx: UserCtx, user_id: str, role: str) -> dict:
        assert_admin(ctx)
        if role not in _ASSIGNABLE_ROLES:
            raise HTTPException(400, "role must be admin or member")
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
            raise HTTPException(400, "Cannot change the organization owner's role")
        mbr.role = role
        session.add(mbr)
        session.commit()
        return {"ok": True, "role": role}

    def _remove_member(self, session: Session, ctx: UserCtx, user_id: str) -> None:
        assert_admin(ctx)
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

    def _delete_org(self, session: Session, ctx: UserCtx) -> None:
        org = session.get(Organization, ctx.org_id)
        if not org:
            raise HTTPException(404, "Organization not found")
        if org.owner_id != ctx.user_id:
            raise HTTPException(403, "Only the organization owner can delete the organization")

        video_interviews = session.exec(select(VideoInterview).where(VideoInterview.org_id == ctx.org_id)).all()
        video_ids = [vi.id for vi in video_interviews]
        responses = session.exec(select(VideoResponse).where(VideoResponse.video_interview_id.in_(video_ids))).all() if video_ids else []
        interview_ids = [i.id for i in session.exec(select(Interview).where(Interview.org_id == ctx.org_id)).all()]

        # Delete in FK-safe order: dependents before parents
        for item in responses:
            session.delete(item)
        for stmt in [
            select(VideoInterview).where(VideoInterview.org_id == ctx.org_id),
            select(Notification).where(Notification.org_id == ctx.org_id),
            select(EmailLog).where(EmailLog.org_id == ctx.org_id),
            select(PerformanceReview).where(PerformanceReview.org_id == ctx.org_id),
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
        # Recordings are personal data: remove them from disk too.
        upload_dir = Path(self._settings.upload_dir)
        for path in [upload_dir / "video" / r.id for r in responses] + [upload_dir / "audio" / i for i in interview_ids]:
            shutil.rmtree(path, ignore_errors=True)
