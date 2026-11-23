# AGENTS.md

Guidance for coding agents and contributors working in this repository.

**Candid** (by Wennovate) — AI recruiting assistant. `backend/` (FastAPI + SQLModel + PostgreSQL, uv) and `frontend/` (React 18 via CDN, no build) share no code: the HTTP API is the only contract. Design rationale: `docs/ARCHITECTURE.md`.

## Commands

```bash
./scripts/server.sh                     # Postgres (Docker) + migrations + API on :8000
./scripts/client.sh                     # frontend on :8080; ./scripts/gen-certs.sh once for HTTPS (Live Room)

cd backend
uv run pytest                           # SQLite, no services
uv run pytest tests/test_candidates.py -k Ownership
uv run ruff check src tests alembic
CANDID_TEST_DATABASE_URL=postgresql://... uv run pytest tests/test_rls_postgres.py   # real-Postgres RLS tests
uv run alembic revision --autogenerate -m "describe_change" && uv run alembic upgrade head
uv run alembic check                    # CI fails if migrations and models differ

node frontend/tests/check.js            # index.html scripts exist + every i18n key in EN/IT/DE
```

## Backend rules

- Layers under `src/candid/`: `commons/` (shared) ← `services/` ← `routers/`; `app.py` is the only composition root. `tests/test_architecture.py` enforces: commons→commons, services→commons, routers never import routers. Put anything shared in `commons/`.
- Routers are classes: `__init__` gets injected services, `_register()` defines closures that call `_method()`s.
- Auth deps (`commons/dependencies.py`): `require_user` (accepts wizard tokens, `/auth/*` only), `require_org` (async; re-checks membership, sets tenant context, fills `ctx.role`), `require_admin` (owner/admin, for settings endpoints).
- Tenancy is two-layer: filter by `org_id` **and** resolve every client-supplied id (incl. body FKs) with `commons.tenancy.get_in_org()`. PostgreSQL RLS (migration `0002`) runs each transaction as role `candid_app`; cross-org endpoints must declare `Depends(rls_bypass)` and authorise in code. New tenant tables need `org_id` + a `tenant_isolation` policy.
- Return generic messages for provider failures (`commons.errors.ai_provider_error`); cap uploads with `commons.uploads.read_limited`.
- Tests: in-memory SQLite + `app.dependency_overrides[require_org]` returning a `UserCtx` with `role="owner"`. Name tests `test_<method>_should_<behavior>_when_<condition>`.

## Frontend rules

- Strict script order in `index.html`: `data.jsx` → `translations.jsx` → `ui.jsx` → `screens/*.jsx` → `app.jsx`. Bump the `?v=` query string of every file you edit.
- All UI strings via `window.useT()`, added in EN, IT and DE. Values sent to the API stay English.
- `app.jsx` fetch interceptor adds the bearer token and logs out on 401. Hash routes `#portal/<slug>` and `#video/<token>` are public.
- Org-wide state: `window.CANDID_DATA.STATUS` (stages, `candid:stages` event), `window.CANDID_PREFS` (+ `getCurrency`/`getLocations`/`savePreferences`), `window.refreshCounts()`.

## Conventions

Code, comments and docs in English. Conventional Commits — pushes to `main` auto-release a semver tag (`feat` minor, `fix`/`perf` patch).
