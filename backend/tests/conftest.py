from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.commons.config import Settings
from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org, require_user
from candid.services.ai_engine import AIEngineFactory
from candid.services.crypto import CryptoService
from candid.services.cv_extractor import CVExtractor
from candid.services.email_service import EmailServiceFactory
from candid.services.notification_service import NotificationService
from candid.services.transcription_service import TranscriptionService

TEST_ORG_ID = "org-test"
_TEST_USER = UserCtx(
    user_id="test-user",
    email="test@candid.test",
    name="Test User",
    org_id=TEST_ORG_ID,
    role="owner",
)
TEST_DB_URL = "sqlite://"


@pytest.fixture(scope="session")
def settings() -> Settings:
    return Settings(
        database_url=TEST_DB_URL,
        fernet_key="Bx_RzRCOqO-3t6G3bXGF2eVZKHHZ7mfYF4oJwGrJ7Zg=",
        session_secret="test-session-secret-at-least-32-bytes!!",
    )


@pytest.fixture(scope="session")
def db(settings: Settings) -> Database:
    engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    database = Database.__new__(Database)
    database._engine = engine
    SQLModel.metadata.create_all(engine)
    return database


@pytest.fixture(scope="session")
def crypto(settings: Settings) -> CryptoService:
    return CryptoService(settings.fernet_key)


@pytest.fixture(scope="session")
def ai_factory(crypto: CryptoService) -> AIEngineFactory:
    return AIEngineFactory(crypto)


@pytest.fixture(scope="session")
def extractor() -> CVExtractor:
    return CVExtractor()


@pytest.fixture(scope="session")
def email_factory(crypto: CryptoService, settings: Settings) -> EmailServiceFactory:
    return EmailServiceFactory(crypto, settings.app_url)


@pytest.fixture(scope="session")
def notification_service() -> NotificationService:
    return NotificationService()


@pytest.fixture(scope="session")
def transcription_service(tmp_path_factory: pytest.TempPathFactory, ai_factory: AIEngineFactory) -> TranscriptionService:
    upload_dir = tmp_path_factory.mktemp("uploads")
    return TranscriptionService(upload_dir=upload_dir, ai_engine_factory=ai_factory)


@pytest.fixture(scope="session")
def client(
    db: Database,
    settings: Settings,
    crypto: CryptoService,
    ai_factory: AIEngineFactory,
    extractor: CVExtractor,
    email_factory: EmailServiceFactory,
    notification_service: NotificationService,
    transcription_service: TranscriptionService,
) -> TestClient:
    from candid.routers.ai import AIRouter
    from candid.routers.analysis import AnalysisRouter
    from candid.routers.candidates import CandidatesRouter
    from candid.routers.config import ConfigRouter
    from candid.routers.emails import EmailsRouter
    from candid.routers.employees import EmployeesRouter
    from candid.routers.evaluations import EvaluationsRouter
    from candid.routers.interviews import InterviewsRouter
    from candid.routers.job_descriptions import JobDescriptionsRouter
    from candid.routers.notifications import NotificationsRouter
    from candid.routers.organizations import OrganizationsRouter
    from candid.routers.performance_reviews import PerformanceReviewsRouter
    from candid.routers.quick_add import QuickAddRouter
    from candid.routers.roles import RolesRouter

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield

    app = FastAPI(lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    # Bypass auth — return fixed test user with org_id
    app.dependency_overrides[require_user] = lambda: _TEST_USER
    app.dependency_overrides[require_org] = lambda: _TEST_USER

    for router in [
        CandidatesRouter(db, notification_service, ai_factory, email_factory).router,
        AnalysisRouter(db, ai_factory, extractor).router,
        InterviewsRouter(db, ai_factory, transcription_service).router,
        EvaluationsRouter(db).router,
        ConfigRouter(db, crypto).router,
        QuickAddRouter(db, ai_factory).router,
        RolesRouter(db, ai_factory).router,
        EmployeesRouter(db).router,
        PerformanceReviewsRouter(db, ai_factory).router,
        JobDescriptionsRouter(db, ai_factory).router,
        AIRouter(db, ai_factory).router,
        OrganizationsRouter(db, email_factory, settings).router,
        NotificationsRouter(db).router,
        EmailsRouter(db).router,
    ]:
        app.include_router(router)

    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_tables(db: Database) -> None:
    from sqlmodel import select

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
    )

    with Session(db._engine) as session:
        for model in (
            EmailLog, Notification,
            Invitation, Membership,
            Evaluation, Interview, PerformanceReview, JobDescription, Employee, Candidate,
            OrgApiKey, OrgConfig, Role, Organization, User,
        ):
            for row in session.exec(select(model)).all():
                session.delete(row)
        session.commit()
