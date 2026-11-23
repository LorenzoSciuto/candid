# Development

## Requirements

[uv](https://docs.astral.sh/uv/) (Python ≥ 3.11), Docker for PostgreSQL, Python 3 to serve the frontend, Node only to run the frontend check, `ffmpeg` to transcribe video recordings, and [mkcert](https://github.com/FiloSottile/mkcert) for HTTPS.

## Running locally

```bash
cp backend/.env.example backend/.env
./scripts/server.sh      # PostgreSQL in Docker (postgres.sh), migrations, API with reload on :8000
./scripts/client.sh      # static frontend on :8080
./scripts/gen-certs.sh   # once: HTTPS certificates, needed by the Live Room (Web Speech API)
./scripts/reset-db.sh    # drop and recreate the local database (destroys its data)
```

Both servers switch to HTTPS when the certificates exist. API reference: `http://localhost:8000/docs`. Migrations run at startup. To run the API against your own database: `cd backend && uv run uvicorn candid.app:app --reload`.

The frontend calls `localhost:8000` by default. To point it at another backend, define `window.CANDID_API_BASE` in an inline script before the `API_BASE` script in `frontend/index.html`.

## Configuration

Environment variables, read from `backend/.env` (see [`.env.example`](../backend/.env.example)):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL DSN |
| `FERNET_KEY` | yes | Encryption key for secrets at rest |
| `SESSION_SECRET` | yes | JWT signing secret (≥ 32 bytes) |
| `GOOGLE_CLIENT_ID` | yes | OAuth client used for sign-in |
| `CORS_ORIGINS` | no | Allowed frontend origins (default: localhost) |
| `APP_URL` | no | Public frontend URL used in invitation links |
| `UPLOAD_DIR` | no | Storage for interview audio and video answers |
| `ALLOW_SERVER_AI_KEYS` | no | Opt in to server-wide provider keys (`OPENAI_API_KEY`, …) |

## Checks

```bash
cd backend
uv run pytest                                      # SQLite, no services needed
uv run pytest tests/test_candidates.py -k Ownership
uv run ruff check src tests alembic

# Row-Level Security tests against a real PostgreSQL
docker run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_USER=candid -e POSTGRES_PASSWORD=test postgres:19-alpine
CANDID_TEST_DATABASE_URL=postgresql://candid:test@127.0.0.1:55432/candid uv run pytest tests/test_rls_postgres.py

node ../frontend/tests/check.js                    # scripts exist, every i18n key in EN/IT/DE
```

## Migrations

```bash
uv run alembic revision --autogenerate -m "describe_change"   # review the generated file
uv run alembic upgrade head
uv run alembic check                                          # fails if models and migrations differ (CI)
```

`DATABASE_URL` overrides the URL in `alembic.ini`. New tenant tables need an `org_id` column and a `tenant_isolation` policy (see [Architecture](ARCHITECTURE.md#3-multi-tenancy)).

## Writing an endpoint

```python
@self.router.patch("/{candidate_id}")
def update_candidate(candidate_id: str, body: CandidateUpdate,
                     session: Session = Depends(db.get_session),
                     user: UserCtx = Depends(require_org)):        # require_admin for settings
    return self._update(session, user, candidate_id, body)
```

- Filter every query by `user.org_id` and resolve every client-supplied id, including body foreign keys, with `get_in_org(session, Model, id, user.org_id)`.
- Endpoints that must work across organisations declare `Depends(rls_bypass)` and authorise access themselves.
- Return generic messages for provider failures (`commons.errors.ai_provider_error`) and cap uploads with `commons.uploads.read_limited`.
- Tests use in-memory SQLite with `app.dependency_overrides[require_org]` and are named `test_<method>_should_<behavior>_when_<condition>`.

## Frontend

React 18 and Babel Standalone load from unpkg with SRI hashes and compile JSX in the browser: no bundler, no npm. React stays on 18 because React 19 no longer ships the UMD builds this no-build setup depends on.

- Scripts load in a strict order (see [Architecture](ARCHITECTURE.md#7-frontend)). When you edit a file, bump its `?v=` query string in `index.html`.
- Every user-visible string goes through `window.useT()` and must exist in EN, IT and DE (`translations.jsx`). Values sent to the API stay English.
- New screen: create `screens/<name>.jsx` that assigns `window.<Name>Screen`, add its script tag after the other screens, add the route to `VALID_ROUTES` and the render switch in `app.jsx`, and add a `SIDE_NAV` entry in `ui.jsx` if it needs one.
- Styling lives in a single `styles.css` with CSS variables on `:root`.

## Releases

Every push to `main` runs CI (lint, migrations-vs-models check, backend tests including RLS on PostgreSQL, frontend checks). If CI passes and the new commits include a releasable [Conventional Commit](https://www.conventionalcommits.org/), the next semantic version is tagged and published as a GitHub Release with generated notes: `feat` bumps the minor version, `fix`/`perf` the patch version, and `BREAKING CHANGE` the major version.

## Deployment notes

- **Database role.** Migration `0002` creates the unprivileged `candid_app` role and grants it to the migrating user, which therefore needs `CREATEROLE`. Alternatively, a DBA creates `candid_app` (`NOLOGIN`) and runs `GRANT candid_app TO <app user>`. Deploy code and migrations together: rolling back `0002` alone leaves the app without table permissions.
- **Reverse proxy.** The public apply endpoint is rate-limited per client IP. Behind a proxy, start uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy ip>`, otherwise every applicant shares the proxy's limit.
- **Old local databases.** `postgres.sh` reuses an existing `candid-db` container with the PostgreSQL version it was created with. To move to the current image, run `docker rm -f candid-db` and start again. This destroys the local data.
