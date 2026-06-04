from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from candid.config import Settings
from candid.database import Database
from candid.models import Candidate
from candid.services.auth_service import create_token
from candid.services.email_service import EmailService
from candid.services.otp_service import OtpService

_TOKEN_TTL_HOURS = 24


class RequestOtpBody(BaseModel):
    candidate_id: str
    email: str


class VerifyOtpBody(BaseModel):
    candidate_id: str
    otp_code: str


class PublicApplicationsRouter:
    def __init__(
        self,
        database: Database,
        otp_service: OtpService,
        email_service: EmailService,
        settings: Settings,
    ) -> None:
        self._database = database
        self._otp_service = otp_service
        self._email_service = email_service
        self._settings = settings
        self.router = APIRouter(prefix="/public/applications", tags=["public-applications"])
        self._register()

    def _register(self) -> None:
        database = self._database

        @self.router.post("/request-otp")
        def request_otp(
            body: RequestOtpBody,
            session: Session = Depends(database.get_session),
        ):
            return self._request_otp(session, body.candidate_id, body.email)

        @self.router.post("/verify-otp")
        def verify_otp(
            body: VerifyOtpBody,
            session: Session = Depends(database.get_session),
        ):
            return self._verify_otp(session, body.candidate_id, body.otp_code)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _request_otp(self, session: Session, candidate_id: str, email: str) -> dict:
        candidate_record = self._fetch_candidate_or_404(session, candidate_id)
        self._assert_email_matches(candidate_record, email)
        otp_code = self._generate_and_store_otp(session, candidate_record)
        job_title = candidate_record.job_title or "the position"
        self._email_service.send_otp_email(email, otp_code, job_title)
        return {"ok": True, "expires_in_minutes": OtpService._OTP_TTL_MINUTES}

    def _verify_otp(self, session: Session, candidate_id: str, otp_code: str) -> dict:
        candidate_record = self._fetch_candidate_or_404(session, candidate_id)
        self._assert_otp_is_set(candidate_record)
        self._assert_otp_valid(otp_code, candidate_record)
        self._finalise_verification(session, candidate_record)
        token = self._issue_candidate_token(candidate_record)
        return {"ok": True, "token": token, "candidate_id": candidate_record.id}

    def _fetch_candidate_or_404(self, session: Session, candidate_id: str) -> Candidate:
        candidate_record = session.get(Candidate, candidate_id)
        if not candidate_record:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return candidate_record

    def _assert_email_matches(self, candidate_record: Candidate, email: str) -> None:
        if candidate_record.email != email:
            raise HTTPException(status_code=400, detail="Email does not match")

    def _generate_and_store_otp(self, session: Session, candidate_record: Candidate) -> str:
        otp_code = self._otp_service.generate_otp()
        candidate_record.otp_hash = self._otp_service.hash_otp(otp_code)
        candidate_record.otp_expires_at = self._otp_service.compute_expiry()
        session.add(candidate_record)
        session.commit()
        return otp_code

    def _assert_otp_is_set(self, candidate_record: Candidate) -> None:
        if not candidate_record.otp_hash or not candidate_record.otp_expires_at:
            raise HTTPException(status_code=400, detail="No OTP has been requested for this candidate")

    def _assert_otp_valid(self, otp_code: str, candidate_record: Candidate) -> None:
        if self._otp_service.is_expired(candidate_record.otp_expires_at):
            raise HTTPException(status_code=410, detail="OTP has expired")
        hashed_otp = self._otp_service.hash_otp(otp_code)
        if hashed_otp != candidate_record.otp_hash:
            raise HTTPException(status_code=401, detail="Invalid OTP code")

    def _finalise_verification(self, session: Session, candidate_record: Candidate) -> None:
        candidate_record.otp_hash = None
        candidate_record.otp_expires_at = None
        if candidate_record.status == "pending_otp":
            candidate_record.status = "New"
        session.add(candidate_record)
        session.commit()

    def _issue_candidate_token(self, candidate_record: Candidate) -> str:
        payload = {
            "sub": candidate_record.id,
            "email": candidate_record.email,
            "candidate": True,
        }
        return create_token(payload, self._settings.session_secret, ttl_hours=_TOKEN_TTL_HOURS)
