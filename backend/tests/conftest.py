import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.app import Application
from candid.config import Settings
from candid.database import Database
from candid.dependencies import require_user
from candid.services.crypto import CryptoService
from candid.services.cv_extractor import CVExtractor
from candid.services.ai_engine import AIEngineFactory

_TEST_USER = {"sub": "test-user", "email": "test@candid.test", "name": "Test User"}


TEST_DB_URL = "sqlite://"  # in-memory SQLite


@pytest.fixture(scope="session")
def settings() -> Settings:
    return Settings(
        database_url=TEST_DB_URL,
        fernet_key="Bx_RzRCOqO-3t6G3bXGF2eVZKHHZ7mfYF4oJwGrJ7Zg=",  # test key
        default_provider="openai",
        default_model="gpt-4o",
    )


@pytest.fixture(scope="session")
def db(settings: Settings) -> Database:
    engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    db = Database.__new__(Database)
    db._engine = engine
    SQLModel.metadata.create_all(engine)
    return db


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
def client(db: Database, crypto: CryptoService, ai_factory: AIEngineFactory, extractor: CVExtractor) -> TestClient:
    from candid.routers.ai import AIRouter
    from candid.routers.analysis import AnalysisRouter
    from candid.routers.candidates import CandidatesRouter
    from candid.routers.config import ConfigRouter
    from candid.routers.employees import EmployeesRouter
    from candid.routers.evaluations import EvaluationsRouter
    from candid.routers.interviews import InterviewsRouter
    from candid.routers.job_descriptions import JobDescriptionsRouter
    from candid.routers.quick_add import QuickAddRouter
    from candid.routers.roles import RolesRouter
    from contextlib import asynccontextmanager
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield

    app = FastAPI(lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    # Bypass auth in tests
    app.dependency_overrides[require_user] = lambda: _TEST_USER

    for router in [
        CandidatesRouter(db).router,
        AnalysisRouter(db, ai_factory, extractor).router,
        InterviewsRouter(db, ai_factory).router,
        EvaluationsRouter(db).router,
        ConfigRouter(db, crypto).router,
        QuickAddRouter(db, ai_factory).router,
        RolesRouter(db).router,
        EmployeesRouter(db).router,
        JobDescriptionsRouter(db, ai_factory).router,
        AIRouter(db, ai_factory).router,
    ]:
        app.include_router(router)

    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_tables(db: Database) -> None:
    """Wipe all rows between tests."""
    from candid.models import Candidate, Config, Employee, Evaluation, Interview, JobDescription, Role
    from sqlmodel import select
    with Session(db._engine) as session:
        # deletion order respects FK constraints
        for model in (Evaluation, Interview, JobDescription, Employee, Candidate, Config, Role):
            for row in session.exec(select(model)).all():
                session.delete(row)
        session.commit()
