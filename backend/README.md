# Candid — Backend

FastAPI application. Python ≥ 3.11, managed with [uv](https://github.com/astral-sh/uv).

---

## Running

```bash
cd backend
uv run uvicorn candid.app:app --host 0.0.0.0 --port 8000 --reload
# or use the root script:
../scripts/server.sh
```

Interactive API docs: `http://localhost:8000/docs`

---

## Configuration

Copy `.env.example` → `.env` and set:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | PostgreSQL DSN |
| `FERNET_KEY` | yes | Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `SESSION_SECRET` | yes | Any string ≥ 32 bytes |
| `GOOGLE_CLIENT_ID` | yes | OAuth 2.0 client ID from Google Cloud Console |
| `CORS_ORIGINS` | no | Comma-separated or `*` (default) |
| `APP_URL` | no | Used in invitation email links |
| `SMTP_*` | no | If absent, invite links are printed to the console |

API keys for AI providers (OpenAI, Anthropic, etc.) are stored in the database (Fernet-encrypted) and can be configured via the Settings UI after login.

---

## Architecture

```
src/candid/
├── app.py              Application — single DI root, mounts all routers
├── config.py           Settings (pydantic-settings, reads .env)
├── database.py         Database — SQLModel engine, session factory, startup migrations
├── dependencies.py     require_user / require_org FastAPI dependencies
├── models.py           SQLModel table definitions (all multi-tenant with org_id)
├── schemas.py          Pydantic request/response models
├── prompts.py          All LLM prompt templates
├── services/
│   ├── ai_engine.py    AIEngine abstraction + AIEngineFactory
│   ├── auth_service.py JWT create/verify (HS256, 48 h TTL)
│   ├── crypto.py       CryptoService — Fernet encrypt/decrypt/mask
│   ├── cv_extractor.py PDF (PyMuPDF) + DOCX text extraction
│   └── email_service.py SMTP for team invitations
└── routers/            One class per resource (see below)
```

### DI pattern

`Application` in `app.py` is the composition root. Every router is a class:

```python
class CandidatesRouter:
    def __init__(self, db: Database, crypto: CryptoService) -> None:
        self._db = db
        self.router = APIRouter(prefix="/candidates", tags=["candidates"])
        self._register()

    def _register(self) -> None:
        @self.router.get("")
        def list_candidates(...):
            return self._list(...)
```

`_register()` defines route closures; all logic lives in `_method()` implementations. No global state, no circular imports.

### Auth dependencies

| Dependency | Accepts | Used by |
|------------|---------|---------|
| `require_user` | Any valid JWT, incl. wizard tokens (no `org_id`) | `/auth/*` |
| `require_org` | JWT with `org_id` only | All data endpoints |

New users receive a "wizard token" (no `org_id`) and see the org setup wizard. After creating or joining an org, a full token is issued.

---

## Database migrations

Managed with [Alembic](https://alembic.sqlalchemy.org/). Migration files live in `alembic/versions/`. The app calls `alembic upgrade head` automatically at startup (`Database.migrate()`).

**To add a new migration after changing `models.py`:**

```bash
cd backend
uv run alembic revision --autogenerate -m "describe_the_change"
# review the generated file in alembic/versions/
uv run alembic upgrade head
```

**Other useful commands:**

```bash
uv run alembic current          # current DB revision
uv run alembic history          # migration history
uv run alembic downgrade -1     # roll back one step
```

`DATABASE_URL` is read from the `DATABASE_URL` env var (falls back to `alembic.ini`). Tests use in-memory SQLite with `SQLModel.metadata.create_all()` — Alembic is not involved in tests.

---

## Tests

```bash
cd backend
uv run pytest                              # all tests
uv run pytest tests/test_candidates.py    # single file
uv run pytest -k "TestCreate"             # filter by class/name
```

Tests use in-memory SQLite and `app.dependency_overrides[require_org]` — no Postgres or real auth needed. Each test gets a fresh database via the `client` fixture in `conftest.py`.

---

## Routers

| Router | Prefix | Key operations |
|--------|--------|---------------|
| `auth.py` | `/auth` | Google sign-in, org create, invite accept, org switch |
| `organizations.py` | `/organizations` | CRUD, member management, invitations, delete |
| `candidates.py` | `/candidates` | CRUD, CV download, stats |
| `analysis.py` | — | `POST /upload-cv`, `POST /analyze` |
| `interviews.py` | `/interviews` | CRUD, `/process` (LLM clean + summary), `/summarize` |
| `evaluations.py` | `/evaluations` | Upsert + get (one per candidate) |
| `roles.py` | `/roles` | CRUD, AI description improve |
| `job_descriptions.py` | `/job-descriptions` | CRUD, AI improve |
| `employees.py` | `/employees` | CRUD |
| `config.py` | `/config` | AI provider config, encrypted API keys, pipeline stages |
| `quick_add.py` | `/quick-add` | AI-extract candidate fields from free text |
| `ai.py` | `/ai` | Email rewrite, send email |
