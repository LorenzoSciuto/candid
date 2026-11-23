# Candid — Architecture

This document explains *why* the code is shaped the way it is. For setup see [DEVELOPMENT.md](DEVELOPMENT.md); the live API reference is served by the backend at `/docs` (OpenAPI).

## 1. Components

```
frontend/  ──HTTP/JSON──▶  backend/  ──SQL──▶  PostgreSQL
(static SPA)               (FastAPI)            (RLS)
```

The frontend and backend share no code and no files: the only contract is the HTTP API. Either side can be deployed on its own or moved to a separate repository.

### Backend layers

```
src/candid/
├── app.py        composition root: builds every service once and injects it into the routers
├── commons/      shared by everyone: models, schemas, config, database, auth dependencies,
│                 JWT helpers, tenancy (RLS), upload limits, rate limiting, error helpers
├── services/     business capabilities with no HTTP knowledge: AI engine, email, CV parsing,
│                 transcription, video interviews, crypto, notifications
└── routers/      one class per REST resource; translates HTTP ⇄ services/commons
```

Dependency rules, enforced by `tests/test_architecture.py` (a violation fails CI):

| Layer | May import |
|---|---|
| `commons` | `commons` only |
| `services` | `commons` only (another service only under `TYPE_CHECKING`, for type hints) |
| `routers` | `commons` and `services`, **never another router** |
| `app.py` | everything (it is the wiring) |

**Routers as classes.** Each router receives its collaborators in `__init__`, registers closures in `_register()` and keeps the logic in small `_method()`s:

```python
class InterviewsRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory, transcription: TranscriptionService):
        ...
        self.router = APIRouter(prefix="/interviews", tags=["interviews"])
        self._register()
```

There is no global state, so tests can build a router with in-memory SQLite and fakes and exercise it over HTTP with `TestClient`.

## 2. Authentication

1. The browser obtains a Google ID token through Google Identity Services.
2. `POST /auth/google` verifies it with Google: the audience must equal `GOOGLE_CLIENT_ID` and the email must be verified. The user is upserted and the endpoint returns an app JWT (HS256, 48 h).
3. A user without an organisation receives a *wizard token* (no `org_id`), which can only reach `/auth/*` to create or join an organisation. Joining returns a full token.
4. Data endpoints depend on `require_org`, which:
   - rejects wizard tokens;
   - **re-checks membership on every request**, so a removed member is locked out immediately even though their token has not expired;
   - attaches the member's role to the request context. `require_admin` builds on it for settings endpoints.

## 3. Multi-tenancy

### Layer 1 — the application

Every tenant table has `org_id`. Routers filter by `ctx.org_id`. Every id taken from the client, including foreign keys inside request bodies, is resolved with:

```python
get_in_org(session, Candidate, body.candidate_id, org_id)   # 404 unless it belongs to org_id
```

Ids are full 128-bit UUIDs, so they cannot be enumerated.

### Layer 2 — PostgreSQL Row-Level Security

Migration `0002_row_level_security` enables `ENABLE` + `FORCE ROW LEVEL SECURITY` and adds a `tenant_isolation` policy on every tenant table:

```sql
USING      (org_id = current_setting('app.current_org_id', true)
            OR current_setting('app.rls_bypass', true) = 'on')
WITH CHECK (same expression)
```

`video_response` has no `org_id`: it is visible only through a `video_interview` row the caller can see, because the policy subquery is itself subject to RLS.

The context reaches PostgreSQL through `commons/tenancy.py`:

- `require_org` (an **async** dependency) stores the organisation in a `ContextVar`. It is async because a sync FastAPI endpoint runs in a worker thread and only inherits context variables set in the request task.
- A SQLAlchemy `after_begin` listener runs at the start of **every transaction**:
  ```sql
  SET LOCAL ROLE candid_app;                                  -- unprivileged: RLS always applies
  SELECT set_config('app.current_org_id', :org, true),
         set_config('app.rls_bypass', :bypass, true);
  ```
  Because this happens per transaction, the context survives `session.commit()`. `SET LOCAL ROLE` makes the policies apply even when the connection user owns the tables or is a superuser, as in local development.
- Endpoints that must cross organisations declare `Depends(rls_bypass)` explicitly: sign-in, the public job portal and candidate video links. These authorise access in code, by slug or unguessable token.
- Everything else is **deny by default**: with no context, tenant tables return no rows and reject writes.

`user`, `organization` and `membership` are identity tables. Sign-in and membership checks must query them across organisations, so they are not tenant-scoped.

`tests/test_rls_postgres.py` proves all of this against a real PostgreSQL in CI:
- queries without a `WHERE` clause still see only the current organisation;
- no context means no rows;
- cross-organisation inserts are rejected;
- the context survives a commit;
- video responses follow their interview.

## 4. AI

`AIEngineFactory.from_session(session, org_id)` builds an `AIEngine` from the organisation's configured provider and model. The decrypted key exists only in memory, for the duration of the request. `from_session_with_fallbacks` adds every other provider the organisation has a key for, and the engine retries transient errors and then falls through the list. All prompts live in `commons/prompts.py` and ask for JSON. Responses are parsed defensively.

Server-wide keys (`OPENAI_API_KEY`, …) are ignored unless `ALLOW_SERVER_AI_KEYS=true`. With open sign-up they would otherwise pay for every organisation and every anonymous portal application.

Provider failures are logged server-side, and clients receive a generic 502 that tells the user what to check, never the provider's internals.

## 5. Media

| Asset | Storage | Notes |
|---|---|---|
| CV files | database (`candidate.cv_file`) | ≤ 10 MB, PDF/DOCX parsed to text |
| Interview recordings | `UPLOAD_DIR/audio/<interview>/<uuid>.<ext>` | ≤ 200 MB, extension allowlist, server-generated name; video is converted to audio with `ffmpeg` before Whisper transcription |
| Video answers | `UPLOAD_DIR/video/<response>/chunk_<n>.webm` | streamed in 5-second chunks of ≤ 20 MB each, at most 360 per answer; concatenated on playback |

Deleting an organisation removes its rows and its media files.

## 6. Public surface

| Endpoint | Protection |
|---|---|
| `GET /auth/config`, `POST /auth/google` | Google token verification |
| `GET /public/organizations/{slug}/jobs`, `/branding` | read-only, active jobs only |
| `POST /public/organizations/{slug}/jobs/{id}/apply` | per-IP rate limit, CV size cap, unreadable files rejected |
| `/public/video/{token}/…` | 128-bit token, 7-day expiry, responses bound to the token's interview, immutable after submission |

## 7. Frontend

A static React 18 single-page app with no bundler. Scripts load in a fixed order; later files depend on earlier ones:

| Order | File | Exports |
|---|---|---|
| 1 | `data.jsx` | `window.CANDID_DATA`: pipeline stages, skills, the AI provider/model catalog |
| 2 | `translations.jsx` | `window.TRANSLATIONS`, `window.useT()` (EN/IT/DE) |
| 3 | `ui.jsx` | shared primitives (`Btn`, `Modal`, `Sidebar`, `useApiData`, …) |
| 4 | `screens/*.jsx` | one component per screen, as `window.<Name>Screen` |
| 5 | `app.jsx` | routing, auth flow, invitation links, `fetch` interceptor |

- The `fetch` interceptor is installed before React mounts. It adds the bearer token (`window._authToken`) to API requests and dispatches `candid:unauthorized` on 401, which logs the user out.
- Organisation-wide state: `window.CANDID_DATA.STATUS` (pipeline stages, loaded from `GET /config/stages`; changes broadcast the `candid:stages` event), `window.CANDID_PREFS` (date format, currency, locations; `getCurrency()`, `getLocations()`, `savePreferences()`), and `window.refreshCounts()` for the sidebar counters.
- Routing is hash-based. `#portal/<slug>` (careers portal) and `#video/<token>` (candidate video interview) render public pages before the auth flow, using the last saved locale or the browser language. `#accept-invite?token=…` keeps the invitation through sign-in.
- Everything user-visible is rendered as React text, and there is no `dangerouslySetInnerHTML`. The session token lives in `localStorage`. Moving it to an httpOnly cookie would also require CSRF protection.

## 8. Security summary

- Google ID tokens are verified for audience and verified email. Session JWTs use HS256 with a pinned algorithm and expiry, and the app refuses to start with a missing, short or placeholder secret.
- Membership is re-checked on every request. Settings changes (AI keys, SMTP, stages, branding) require an admin.
- Provider API keys and SMTP passwords are Fernet-encrypted at rest and only ever returned masked.
- Uploads have size caps, extension allowlists and server-generated file names. Public endpoints are rate-limited (in memory, per process).
- SMTP always verifies TLS certificates, and user-controlled values are HTML-escaped in emails.

## 9. Quality gates

- `uv run pytest`: unit, API and architecture tests on SQLite, plus RLS tests when `CANDID_TEST_DATABASE_URL` is set.
- `ruff check` with pycodestyle, pyflakes, isort, bugbear and bandit (`S`) rules.
- `alembic check` in CI keeps the migrations identical to the models.
- `node frontend/tests/check.js`: every script referenced by `index.html` exists, and every translation key exists in all three languages.
