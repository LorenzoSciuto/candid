import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from candid.config import Settings
from candid.database import Database
from candid.routers.ai import AIRouter
from candid.routers.analysis import AnalysisRouter
from candid.routers.auth import AuthRouter
from candid.routers.candidates import CandidatesRouter
from candid.routers.config import ConfigRouter
from candid.routers.employees import EmployeesRouter
from candid.routers.evaluations import EvaluationsRouter
from candid.routers.interviews import InterviewsRouter
from candid.routers.job_descriptions import JobDescriptionsRouter
from candid.routers.quick_add import QuickAddRouter
from candid.routers.roles import RolesRouter
from candid.services.ai_engine import AIEngineFactory
from candid.services.crypto import CryptoService
from candid.services.cv_extractor import CVExtractor


class Application:
    def __init__(self) -> None:
        self._settings = Settings()
        self._db = Database(self._settings.database_url)
        self._crypto = CryptoService(self._settings.fernet_key)
        self._extractor = CVExtractor()
        self._ai_factory = AIEngineFactory(self._crypto)

    def create(self) -> FastAPI:
        @asynccontextmanager
        async def lifespan(_: FastAPI):
            self._wait_for_db()
            self._db.create_tables()
            yield

        fastapi_app = FastAPI(
            title="Candid API",
            version="1.0.0",
            description="AI-powered recruiting assistant",
            lifespan=lifespan,
        )

        fastapi_app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # tighten in production
            allow_methods=["*"],
            allow_headers=["*"],
        )

        self._mount_routers(fastapi_app)
        return fastapi_app

    def _wait_for_db(self, retries: int = 10, delay: float = 2.0) -> None:
        from sqlalchemy import text
        from sqlalchemy.exc import OperationalError

        engine = self._db._engine  # type: ignore[attr-defined]
        for attempt in range(retries):
            try:
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                return
            except OperationalError:
                if attempt == retries - 1:
                    raise
                print(f"DB not ready, retrying in {delay}s… ({attempt + 1}/{retries})")
                time.sleep(delay)

    def _mount_routers(self, fastapi_app: FastAPI) -> None:
        routers = [
            AIRouter(self._db, self._ai_factory).router,
            CandidatesRouter(self._db).router,
            AnalysisRouter(self._db, self._ai_factory, self._extractor).router,
            InterviewsRouter(self._db, self._ai_factory).router,
            EvaluationsRouter(self._db).router,
            ConfigRouter(self._db, self._crypto).router,
            QuickAddRouter(self._db, self._ai_factory).router,
            RolesRouter(self._db).router,
            JobDescriptionsRouter(self._db, self._ai_factory).router,
            EmployeesRouter(self._db).router,
            AuthRouter().router,
        ]
        for router in routers:
            fastapi_app.include_router(router)


# Module-level instance consumed by uvicorn: `uvicorn candid.app:app`
app = Application().create()
