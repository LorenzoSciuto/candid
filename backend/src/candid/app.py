import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from candid.config import Settings
from candid.database import Database
from candid.dependencies import require_user
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
            self._db.run_migrations()
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
        self._mount_root(fastapi_app)
        return fastapi_app

    def _wait_for_db(self, retries: int = 10, delay: float = 2.0) -> None:
        import sys
        from sqlalchemy import text
        from sqlalchemy.exc import OperationalError

        engine = self._db._engine  # type: ignore[attr-defined]
        for attempt in range(retries):
            try:
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                return
            except OperationalError as exc:
                if attempt == retries - 1:
                    url = self._settings.database_url
                    host = url.split("@")[-1].split("/")[0] if "@" in url else url
                    print(
                        f"\n❌  Cannot connect to Postgres at {host}\n"
                        f"    Run:  ./scripts/postgres.sh\n",
                        file=sys.stderr,
                    )
                    sys.exit(1)
                print(f"DB not ready, retrying in {delay}s… ({attempt + 1}/{retries})")
                time.sleep(delay)

    def _mount_root(self, fastapi_app: FastAPI) -> None:
        from fastapi.responses import HTMLResponse

        @fastapi_app.get("/", response_class=HTMLResponse, include_in_schema=False)
        def root():
            return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Candid API</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #0c0a09; color: #e7e5e4; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { text-align: center; padding: 48px 56px; background: #1c1917; border: 1px solid #292524; border-radius: 16px; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4ade80; margin-right: 8px; box-shadow: 0 0 8px #4ade80; }
    h1 { margin: 0 0 8px; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
    p { margin: 0 0 24px; color: #78716c; font-size: 14px; }
    a { color: #a8a29e; font-size: 13px; text-decoration: none; border: 1px solid #292524; border-radius: 8px; padding: 8px 16px; }
    a:hover { background: #292524; }
  </style>
</head>
<body>
  <div class="card">
    <p><span class="dot"></span>Server running</p>
    <h1>Candid API</h1>
    <p>AI-powered recruiting assistant · v1.0.0</p>
    <a href="/docs">API docs →</a>
  </div>
</body>
</html>"""

    def _mount_routers(self, fastapi_app: FastAPI) -> None:
        # Auth endpoints are public
        fastapi_app.include_router(AuthRouter(self._settings).router)

        # All other endpoints require a valid session token
        auth_dep = [Depends(require_user)]
        for router in [
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
        ]:
            fastapi_app.include_router(router, dependencies=auth_dep)


# Module-level instance consumed by uvicorn: `uvicorn candid.app:app`
app = Application().create()
