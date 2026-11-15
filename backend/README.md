# Candid — Backend

FastAPI + SQLModel + PostgreSQL, managed with [uv](https://docs.astral.sh/uv/). Python ≥ 3.11.
The design is described in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Run

```bash
cp .env.example .env            # fill FERNET_KEY, SESSION_SECRET, GOOGLE_CLIENT_ID
../scripts/server.sh            # starts PostgreSQL (Docker) if needed, migrates, serves :8000 with reload
# or, with your own database:
uv run uvicorn candid.app:app --reload
```

Interactive API documentation: `http://localhost:8000/docs`.
Migrations run automatically at startup (`alembic upgrade head`).

## Layout

```
src/candid/
├── app.py        composition root — the only module that wires services into routers
├── commons/      config, database, models, schemas, prompts, auth dependencies, JWT,
│                 tenancy (RLS), upload limits, rate limiter, pipeline helpers, error helpers
├── services/     ai_engine · crypto · cv_extractor · email_service · notification_service ·
│                 transcription_service · video_interview_service
└── routers/      one class per resource (auth, organizations, candidates, analysis, interviews,
                  evaluations, video_interviews, job_descriptions, roles, employees,
                  performance_reviews, config, branding, notifications, emails, ai,
                  quick_add, public_jobs)
```

Rules (checked by `tests/test_architecture.py`): `commons` → `commons` only; `services` → `commons` only;
routers → `commons` + `services`, never another router.

## Writing an endpoint

```python
@self.router.patch("/{candidate_id}")
def update_candidate(candidate_id: str, body: CandidateUpdate,
                     session: Session = Depends(db.get_session),
                     user: UserCtx = Depends(require_org)):        # require_admin for settings
    return self._update(session, user, candidate_id, body)
```

- Filter every query by `user.org_id`, and resolve every client-supplied id (including body foreign keys)
  with `get_in_org(session, Model, id, user.org_id)`.
- Endpoints that must work across organisations (public pages, sign-in) are mounted with
  `Depends(rls_bypass)` — and must then authorise access themselves.
- New tenant tables need an `org_id` column and a `tenant_isolation` policy in their migration.

## Tests & checks

```bash
uv run pytest                                  # SQLite + dependency overrides, no services needed
uv run pytest tests/test_video_interviews.py -k Isolation
uv run pytest --cov=candid
uv run --with ruff ruff check src tests alembic

# Row-Level Security against a real PostgreSQL (CI does this on every push)
CANDID_TEST_DATABASE_URL=postgresql://candid:test@127.0.0.1:55432/candid uv run pytest tests/test_rls_postgres.py
```

## Migrations

```bash
uv run alembic revision --autogenerate -m "describe_change"   # review the generated file
uv run alembic upgrade head
uv run alembic check                                          # fails if models and migrations differ
uv run alembic downgrade -1
```

`DATABASE_URL` overrides the URL in `alembic.ini`.
