from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.config import Settings
from candid.database import Database
from candid.models import Candidate
from candid.routers.public_applications import PublicApplicationsRouter
from candid.services.email_service import EmailService
from candid.services.otp_service import OtpService

_TEST_CANDIDATE_EMAIL = "applicant@example.com"
_TEST_JOB_TITLE = "Software Engineer"
_TEST_DB_URL = "sqlite://"
_TEST_ORG_ID = "org-2fa-test"


@pytest.fixture(scope="module")
def otp_service() -> OtpService:
    return OtpService()


@pytest.fixture(scope="module")
def email_service() -> EmailService:
    return EmailService(None, 587, None, None, "noreply@test.candid", "http://localhost:8080")


@pytest.fixture(scope="module")
def settings_2fa() -> Settings:
    return Settings(
        database_url=_TEST_DB_URL,
        fernet_key="Bx_RzRCOqO-3t6G3bXGF2eVZKHHZ7mfYF4oJwGrJ7Zg=",
        session_secret="test-session-secret-at-least-32-bytes!!",
    )


@pytest.fixture(scope="module")
def db_2fa() -> Database:
    engine = create_engine(
        _TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    database = Database.__new__(Database)
    database._engine = engine
    SQLModel.metadata.create_all(engine)
    return database


@pytest.fixture(scope="module")
def public_client(
    db_2fa: Database,
    otp_service: OtpService,
    email_service: EmailService,
    settings_2fa: Settings,
) -> TestClient:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield

    application = FastAPI(lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )
    application.include_router(
        PublicApplicationsRouter(db_2fa, otp_service, email_service, settings_2fa).router
    )
    return TestClient(application)


@pytest.fixture(autouse=True)
def clean_candidates(db_2fa: Database) -> None:
    with Session(db_2fa._engine) as session:
        for candidate_record in session.exec(__import__("sqlmodel").select(Candidate)).all():
            session.delete(candidate_record)
        session.commit()


@pytest.fixture
def seeded_candidate(db_2fa: Database) -> Candidate:
    candidate_record = Candidate(
        org_id=_TEST_ORG_ID,
        first_name="Alice",
        last_name="Smith",
        email=_TEST_CANDIDATE_EMAIL,
        status="pending_otp",
        job_title=_TEST_JOB_TITLE,
    )
    with Session(db_2fa._engine) as session:
        session.add(candidate_record)
        session.commit()
        session.refresh(candidate_record)
    return candidate_record


# ── /request-otp tests ────────────────────────────────────────────────────────

class TestRequestOtp:
    def test_requestOtp_shouldReturn200_whenEmailMatchesCandidate(
        self, public_client: TestClient, seeded_candidate: Candidate
    ) -> None:
        response = public_client.post(
            "/public/applications/request-otp",
            json={"candidate_id": seeded_candidate.id, "email": _TEST_CANDIDATE_EMAIL},
        )
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert response.json()["expires_in_minutes"] == 10

    def test_requestOtp_shouldStoreHashedOtp_whenCalled(
        self, public_client: TestClient, seeded_candidate: Candidate, db_2fa: Database
    ) -> None:
        public_client.post(
            "/public/applications/request-otp",
            json={"candidate_id": seeded_candidate.id, "email": _TEST_CANDIDATE_EMAIL},
        )
        with Session(db_2fa._engine) as session:
            refreshed = session.get(Candidate, seeded_candidate.id)
        assert refreshed.otp_hash is not None
        assert len(refreshed.otp_hash) == 64  # SHA-256 hex digest length
        assert refreshed.otp_expires_at is not None

    def test_requestOtp_shouldReturn400_whenEmailDoesNotMatch(
        self, public_client: TestClient, seeded_candidate: Candidate
    ) -> None:
        response = public_client.post(
            "/public/applications/request-otp",
            json={"candidate_id": seeded_candidate.id, "email": "wrong@example.com"},
        )
        assert response.status_code == 400

    def test_requestOtp_shouldReturn404_whenCandidateNotFound(
        self, public_client: TestClient
    ) -> None:
        response = public_client.post(
            "/public/applications/request-otp",
            json={"candidate_id": "c-nonexistent", "email": _TEST_CANDIDATE_EMAIL},
        )
        assert response.status_code == 404


# ── /verify-otp tests ─────────────────────────────────────────────────────────

class TestVerifyOtp:
    def _seed_with_otp(
        self,
        db_2fa: Database,
        candidate_id: str,
        otp_code: str,
        expiry_timestamp: str,
    ) -> None:
        service = OtpService()
        with Session(db_2fa._engine) as session:
            candidate_record = session.get(Candidate, candidate_id)
            candidate_record.otp_hash = service.hash_otp(otp_code)
            candidate_record.otp_expires_at = expiry_timestamp
            session.add(candidate_record)
            session.commit()

    def test_verifyOtp_shouldReturnToken_whenOtpIsCorrectAndNotExpired(
        self,
        public_client: TestClient,
        seeded_candidate: Candidate,
        db_2fa: Database,
    ) -> None:
        otp_code = "123456"
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        self._seed_with_otp(db_2fa, seeded_candidate.id, otp_code, future_expiry)

        response = public_client.post(
            "/public/applications/verify-otp",
            json={"candidate_id": seeded_candidate.id, "otp_code": otp_code},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "token" in data
        assert data["candidate_id"] == seeded_candidate.id

    def test_verifyOtp_shouldReturn401_whenOtpIsWrong(
        self,
        public_client: TestClient,
        seeded_candidate: Candidate,
        db_2fa: Database,
    ) -> None:
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        self._seed_with_otp(db_2fa, seeded_candidate.id, "123456", future_expiry)

        response = public_client.post(
            "/public/applications/verify-otp",
            json={"candidate_id": seeded_candidate.id, "otp_code": "000000"},
        )
        assert response.status_code == 401

    def test_verifyOtp_shouldReturn410_whenOtpIsExpired(
        self,
        public_client: TestClient,
        seeded_candidate: Candidate,
        db_2fa: Database,
    ) -> None:
        past_expiry = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        self._seed_with_otp(db_2fa, seeded_candidate.id, "123456", past_expiry)

        response = public_client.post(
            "/public/applications/verify-otp",
            json={"candidate_id": seeded_candidate.id, "otp_code": "123456"},
        )
        assert response.status_code == 410

    def test_verifyOtp_shouldReturn400_whenNoOtpSet(
        self, public_client: TestClient, seeded_candidate: Candidate
    ) -> None:
        response = public_client.post(
            "/public/applications/verify-otp",
            json={"candidate_id": seeded_candidate.id, "otp_code": "123456"},
        )
        assert response.status_code == 400

    def test_verifyOtp_shouldClearOtpFields_whenSuccessful(
        self,
        public_client: TestClient,
        seeded_candidate: Candidate,
        db_2fa: Database,
    ) -> None:
        otp_code = "654321"
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        self._seed_with_otp(db_2fa, seeded_candidate.id, otp_code, future_expiry)

        public_client.post(
            "/public/applications/verify-otp",
            json={"candidate_id": seeded_candidate.id, "otp_code": otp_code},
        )

        with Session(db_2fa._engine) as session:
            refreshed = session.get(Candidate, seeded_candidate.id)
        assert refreshed.otp_hash is None
        assert refreshed.otp_expires_at is None

    def test_verifyOtp_shouldUpdateStatusToNew_whenStatusWasPendingOtp(
        self,
        public_client: TestClient,
        seeded_candidate: Candidate,
        db_2fa: Database,
    ) -> None:
        otp_code = "111222"
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        self._seed_with_otp(db_2fa, seeded_candidate.id, otp_code, future_expiry)

        public_client.post(
            "/public/applications/verify-otp",
            json={"candidate_id": seeded_candidate.id, "otp_code": otp_code},
        )

        with Session(db_2fa._engine) as session:
            refreshed = session.get(Candidate, seeded_candidate.id)
        assert refreshed.status == "New"
