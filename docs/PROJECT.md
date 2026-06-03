# Candid — Project Documentation

AI-powered recruiting assistant. Manages the full pre-hire lifecycle: CV parsing, AI analysis, live interview transcription, candidate pipeline, and team evaluation — all scoped to isolated organisations.

---

## Table of contents

1. [Product overview](#1-product-overview)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Auth & multi-tenancy](#4-auth--multi-tenancy)
5. [Backend — services](#5-backend--services)
6. [Backend — API reference](#6-backend--api-reference)
7. [Frontend — architecture](#7-frontend--architecture)
8. [Frontend — screens](#8-frontend--screens)
9. [Database schema](#9-database-schema)
10. [Development guide](#10-development-guide)
11. [Planned features](#11-planned-features)

---

## 1. Product overview

Candid is a multi-tenant SaaS recruiting tool built for internal HR teams. It covers:

- **CV intake** — upload PDF or DOCX, extract text, run AI analysis
- **Candidate pipeline** — configurable Kanban stages, status history, evaluations
- **Live interview room** — real-time speech-to-text transcription, speaker tracking, saved to record
- **Pre-interview briefing** — AI generates preparation notes from CV + job description
- **Job management** — job descriptions, roles, headcount, AI-improved JDs
- **Team** — multi-member orgs, invitation by email, role-based access (owner / admin / member)
- **Employee directory** — hired candidates tracked with salary, department, manager
- **Reports** — funnel analytics, pipeline breakdown by stage

Everything is scoped to an organisation (`org_id`). No data leaks between tenants.

---

## 2. Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 18 via CDN + Babel Standalone | No build step, no bundler, no npm |
| Fonts | Geist + Geist Mono (Google Fonts) | |
| Icons | lucide-react via CDN | |
| Styling | Custom CSS variables (`styles.css`) | No Tailwind |
| Backend | FastAPI · Python 3.11+ | Async where needed |
| ORM | SQLModel | Single schema for DB + Pydantic validation |
| Database | PostgreSQL (prod) · SQLite (tests) | |
| Migrations | Alembic | Auto-run at startup |
| Auth | JWT HS256 · 48 h TTL · Google OAuth 2.0 | |
| AI providers | OpenAI · Anthropic · Gemini · Groq | Switchable at runtime |
| CV parsing | PyMuPDF (PDF) · python-docx (DOCX) | |
| Encryption | Fernet (cryptography lib) | API keys encrypted at rest |
| Tests | pytest · 185 tests · ~85% coverage | In-memory SQLite, no external services |
| Package manager | uv | |
| HTTPS | Optional — auto-detected from `scripts/certs/` | Required for Web Speech API |

---

## 3. Architecture

### Monolith structure

```
candid/
├── backend/              FastAPI application
│   ├── src/candid/
│   │   ├── app.py        Application — DI root, mounts all routers
│   │   ├── config.py     Settings (pydantic-settings, reads .env)
│   │   ├── database.py   SQLModel engine + get_session() + migrate()
│   │   ├── dependencies.py  require_user / require_org
│   │   ├── models.py     SQLModel tables (all multi-tenant with org_id)
│   │   ├── schemas.py    Pydantic I/O models
│   │   ├── prompts.py    All LLM prompt templates
│   │   ├── services/     AIEngine · CryptoService · CVExtractor · EmailService · AuthService
│   │   └── routers/      One class per resource
│   └── tests/            pytest suite — 12 test files
├── frontend/             React app (CDN, no build)
│   ├── index.html        Entry point — strict script load order
│   ├── data.jsx          Global constants (pipeline stages, skills)
│   ├── translations.jsx  i18n — EN / IT / DE
│   ├── ui.jsx            Shared primitives
│   ├── tweaks-panel.jsx  Runtime design knobs
│   ├── app.jsx           Root component — routing, auth, fetch interceptor
│   ├── styles.css        CSS variables + global styles
│   └── screens/          One component per screen
└── scripts/
    ├── postgres.sh       Start / create Postgres Docker container
    ├── server.sh         Start backend (HTTPS if certs present)
    ├── client.sh         Start frontend (HTTPS if certs present)
    └── gen-certs.sh      Generate localhost TLS certs
```

### Backend DI pattern

`Application` in `app.py` is the composition root. Every router is a class injected with only the services it needs:

```python
class CandidatesRouter:
    def __init__(self, db: Database) -> None:
        self._db = db
        self.router = APIRouter(prefix="/candidates", tags=["candidates"])
        self._register()

    def _register(self) -> None:
        @self.router.get("")
        def list_candidates(...):
            return self._list(...)

    def _list(self, session, org_id, status, q) -> list:
        # implementation
```

`_register()` defines route closures that delegate to `_method()` implementations. No global state, no circular imports.

### Request flow

```
Browser
  → fetch interceptor (injects Authorization header)
  → FastAPI router
  → require_org dependency (validates JWT, extracts org_id)
  → router method (queries DB filtered by org_id)
  → JSON response
```

---

## 4. Auth & multi-tenancy

### Auth flow

1. User opens app → redirected to Google sign-in
2. Google returns an `id_token` → sent to `POST /auth/google`
3. Backend verifies token via Google's `tokeninfo` endpoint
4. User upserted in `User` table (Google `sub` as primary key)

**New user (no org):**
- A "wizard token" is issued — JWT with no `org_id`
- Frontend shows org setup wizard
- User creates a new org (`POST /auth/organizations`) or accepts an invite
- Full token issued with `org_id`

**Existing user:**
- Full JWT issued with first org's `org_id`
- If member of multiple orgs, `orgs` array is returned
- Switch org via `POST /auth/switch-org` (no re-login needed)

### JWT structure

```json
{
  "sub": "google-sub-id",
  "email": "user@example.com",
  "name": "Alice Smith",
  "org_id": "org-abc123",
  "exp": 1234567890,
  "iat": 1234500000
}
```

Wizard tokens omit `org_id`.

### FastAPI dependencies

| Dependency | JWT requirement | Used by |
|------------|----------------|---------|
| `require_user` | Any valid JWT | `/auth/*` endpoints |
| `require_org` | JWT with non-empty `org_id` | All data endpoints |

`require_org` wraps `require_user` and raises HTTP 403 if `org_id` is missing. This blocks wizard tokens from touching org data.

### Multi-tenancy enforcement

Every data table has `org_id`. Every query filters by it. There is no shared data between organisations. The `require_org` dependency injects the validated `org_id` from the JWT — a user cannot forge a different org's ID without a valid signed token for that org.

---

## 5. Backend — services

### AIEngine + AIEngineFactory

`AIEngineFactory` (in `services/ai_engine.py`) reads the org's configured provider and API key from the database (decrypted via `CryptoService`) and returns an `AIEngine` instance.

`AIEngine` exposes:
- `analyze_cv(cv_text, position_name, jd_text, notes, open_roles)` → structured analysis dict
- `parse_quick_add(raw_text)` → structured candidate fields
- `process_transcript(raw_content)` → cleaned transcript text
- `summarize_interview(transcript, candidate_name, job_title)` → summary dict
- `improve_role_description(name, department, description)` → improved text
- `improve_job_description(title, description, requirements)` → improved text
- `rewrite_email(text, action, candidate_name, job_title, notes)` → rewritten email text

Supported providers: `openai`, `anthropic`, `gemini`, `groq`. Provider and model are selected per org in Settings.

### CryptoService

Fernet symmetric encryption. Used exclusively for third-party API keys stored in `OrgApiKey`.

```python
svc.encrypt(plaintext)   # → ciphertext string
svc.decrypt(ciphertext)  # → plaintext string
svc.mask(plaintext)      # → "sk-12****cdef" (for display)
```

Raises `RuntimeError` if no `FERNET_KEY` is configured.

### CVExtractor

Extracts raw text from uploaded CV files.

- `.pdf` → PyMuPDF (`fitz.open`) — raises `ValueError` for image-only PDFs
- `.docx` → python-docx paragraph join
- Other extensions → `ValueError("Unsupported file type")`

### EmailService

SMTP email sender. Used for team invitations.

- `send_invitation(to_email, org_name, inviter_name, token)` — sends HTML + plain text invite email with accept link
- `send_email(to_email, subject, body)` — generic send
- `is_configured()` → `bool` — False when `SMTP_HOST` not set

When SMTP is not configured, `send_invitation` logs the accept URL to console instead of raising. `send_email` raises `RuntimeError`.

### AuthService

JWT operations:
- `create_token(payload, secret)` → signed JWT string (48 h TTL)
- `verify_token(token, secret)` → decoded payload dict (raises `jwt.PyJWTError` on invalid/expired)

---

## 6. Backend — API reference

All data endpoints require `Authorization: Bearer <token>` with a full (non-wizard) JWT.

### Auth — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/config` | None | Returns `google_client_id` (or null) |
| POST | `/auth/google` | None | Verify Google id_token, return JWT |
| POST | `/auth/organizations` | wizard token | Create org, return full JWT |
| POST | `/auth/switch-org` | any JWT | Switch active org, return new JWT |
| POST | `/auth/accept-invite` | wizard token | Accept invitation by token or ID |
| PATCH | `/auth/users/me` | any JWT | Update name / title / department |

### Candidates — `/candidates`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/candidates` | List candidates (filters: `status`, `q` search) |
| POST | `/candidates` | Create candidate |
| GET | `/candidates/stats` | Count by status |
| GET | `/candidates/{id}` | Get candidate with interviews + evaluation |
| PATCH | `/candidates/{id}` | Update candidate fields (triggers status history on status change) |
| DELETE | `/candidates/{id}` | Delete candidate |
| GET | `/candidates/{id}/cv` | Download raw CV file |

### Analysis

| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload-cv` | Upload CV file (PDF/DOCX), extract text, optionally attach to candidate |
| POST | `/analyze` | Run AI analysis on CV text against active job descriptions |

`/analyze` returns `overview`, `strengths`, `weaknesses`, `questions`, `extracted` (name, email, skills, years_exp, education), `career_history`, `role_fits`, `score`. Optionally stores result on a candidate.

### Interviews — `/interviews`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/interviews` | List (filter by `candidate_id`) |
| POST | `/interviews` | Create interview record |
| PATCH | `/interviews/{id}` | Update fields |
| POST | `/interviews/{id}/process` | AI cleanup of raw transcript → `cleaned_transcript` |
| POST | `/interviews/{id}/summarize` | AI summary → structured dict (key_points, strengths, areas_of_concern, recommendation) |

### Evaluations — `/evaluations`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/evaluations/{candidate_id}` | Get evaluation for candidate |
| PUT | `/evaluations/{candidate_id}` | Upsert evaluation |

Evaluation stores `human_skills` (JSON), `technical_skills` (JSON), `final_recommendation`, `notes`.

### Organisations — `/organizations`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/organizations/` | List all orgs current user belongs to |
| GET | `/organizations/current` | Current org details + members + pending invitations |
| POST | `/organizations/current/invite` | Invite member by email |
| PATCH | `/organizations/current/members/{user_id}` | Update member role |
| DELETE | `/organizations/current/members/{user_id}` | Remove member |
| POST | `/organizations/invitations/accept` | Accept invite (public, no auth) |
| DELETE | `/organizations/current` | Delete org and all its data (owner only) |

### Roles — `/roles`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/roles` | List all roles |
| POST | `/roles` | Create role |
| PATCH | `/roles/{id}` | Update role |
| DELETE | `/roles/{id}` | Delete role |
| POST | `/roles/{id}/improve-description` | AI rewrite of role description |

### Job descriptions — `/job-descriptions`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/job-descriptions` | List (filter by `role_id`, `status`) |
| POST | `/job-descriptions` | Create JD |
| PATCH | `/job-descriptions/{id}` | Update JD |
| DELETE | `/job-descriptions/{id}` | Delete JD |
| POST | `/job-descriptions/{id}/improve` | AI improve title + description + requirements |

### Employees — `/employees`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/employees` | List employees |
| POST | `/employees` | Create employee |
| PATCH | `/employees/{id}` | Update employee |
| DELETE | `/employees/{id}` | Delete employee |

### Config — `/config`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config` | Get AI provider + model config |
| POST | `/config` | Save AI provider + model |
| GET | `/config/keys` | List stored providers (masked key preview) |
| POST | `/config/keys` | Upsert encrypted API key |
| DELETE | `/config/keys/{provider}` | Delete API key |
| POST | `/config/test` | Test current AI config (send a ping prompt) |
| GET | `/config/stages` | Get pipeline stages array |
| POST | `/config/stages` | Save pipeline stages |

### AI utilities — `/ai`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/rewrite` | Rewrite email text (actions: `email`, `rejection`, `invitation`) |
| POST | `/ai/send-email` | Send email via SMTP |

### Quick Add — `/quick-add`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/quick-add` | Extract structured candidate fields from free text via AI, create candidate |

---

## 7. Frontend — architecture

### No-build setup

No npm, no webpack, no bundler. Dependencies load from CDN. Babel Standalone compiles JSX in the browser at runtime. This keeps deployment trivial — serve the `frontend/` directory with any static file server.

### Script load order

`index.html` loads scripts in strict dependency order. **Cache-bust by bumping `?v=N` on any changed file.**

| Order | File | Exports to `window` |
|-------|------|---------------------|
| 1 | `data.jsx` | `CANDID_DATA` — pipeline stages, skill lists, `SKILL_KEYS` EN→i18n map |
| 2 | `translations.jsx` | `TRANSLATIONS` · `useT()` — EN / IT / DE |
| 3 | `ui.jsx` | `Icons` · `Btn` · `Badge` · `Avatar` · `Modal` · `Rating` · `Sidebar` · `Topbar` · `StatusBadge` · `Tooltip` · `useApiData` |
| 4 | `tweaks-panel.jsx` | `useTweaks` — runtime design knobs (spacing, radius, font size) |
| 5 | `screens/*.jsx` | One component per screen → `window.*Screen` |
| 6 | `app.jsx` | `<App>` — routing, auth flow, org wizard, fetch interceptor |

### Fetch interceptor

`app.jsx` patches `window.fetch` at parse time (IIFE, before React mounts) so auth headers are injected even for effects that fire before `<App>` mounts:

```javascript
window.fetch = async (url, opts = {}) => {
  if (url.startsWith(window.API_BASE) && window._authToken) {
    opts.headers = { ...opts.headers, Authorization: `Bearer ${window._authToken}` };
  }
  const resp = await originalFetch(url, opts);
  if (resp.status === 401) window.dispatchEvent(new CustomEvent("candid:unauthorized"));
  return resp;
};
window._authToken = loadUser()?.token || null;
```

Update `window._authToken` whenever the token changes.

### i18n

```javascript
const t = window.useT();
t('candidate.name')   // returns translated string for active locale
```

All user-visible strings go through `useT()`. New keys must be added to all three locales (EN / IT / DE) in `translations.jsx`.

**Skill i18n:** English name is the DB key. `CANDID_DATA.SKILL_KEYS[englishName]` → i18n key → `t(key)`.

### Global events

| Event | Direction | Triggered by | Meaning |
|-------|-----------|--------------|---------|
| `candid:unauthorized` | fetch → App | Any 401 response | Auto-logout |
| `candid:stages` | Settings → Pipeline | Stage config saved | Pipeline re-renders columns |

### Global functions

| Function | Purpose |
|----------|---------|
| `window.refreshCounts()` | Refresh sidebar counters — call after any mutation |
| `window._authToken` | Current JWT — write this when token changes |
| `window.API_BASE` | Backend URL — set in `index.html`, mirrors page protocol |

### Pipeline stages reactivity

`window.CANDID_DATA.STATUS` is the live stages array. Overwritten from `GET /config/stages` at app startup. Settings dispatches `candid:stages` after saving; Pipeline listens and re-renders columns. Never hardcode stage names.

### `useApiData` hook

Shared data-fetching hook from `ui.jsx`. Handles loading state, error state, and refetch. Used across all screens for GET requests.

### Adding a new screen

1. Create `screens/mything.jsx` — define component, assign `window.MyThingScreen = MyThingScreen`
2. Add `<script src="screens/mything.jsx?v=1" type="text/babel"></script>` to `index.html` after other screens
3. Add nav entry in `app.jsx` Sidebar and a route case in the `App` render switch

---

## 8. Frontend — screens

| Screen | File | Key behaviour |
|--------|------|--------------|
| Pipeline | `screens/pipeline.jsx` | Kanban drag-drop between status columns; listens to `candid:stages` event; calls `refreshCounts` on move |
| Candidates | `screens/candidates.jsx` | Table with status + source + search filters; `ConfirmDialog` for delete |
| Candidate detail | `screens/candidate.jsx` | Tabs: Overview · CV Analysis · Interviews · Evaluation · Activity; AI analysis trigger |
| Jobs | `screens/jobs.jsx` | Job description list; `JdViewModal`; multi-owner select; location dropdown |
| Roles | `screens/roles.jsx` | Headcount bar + department grouping; JD linking |
| Employees | `screens/employees.jsx` | People directory; salary toggle (visible/hidden); CSV download |
| Interviews | `screens/interviews.jsx` | List view + week calendar; `ScheduleModal` |
| Live Room | `screens/liveroom.jsx` | Real-time interview: Web Speech API STT, speaker tracking, live transcript, save to backend |
| Pre-interview | `screens/preinterview.jsx` | Select candidate + JD → AI generates preparation brief |
| Settings | `screens/settings.jsx` | Tabs: AI providers · Pipeline stages · Locale · Profile · Locations · Team · Integrations |
| Quick Add | `screens/quickadd.jsx` | Upload CV or paste text → AI extracts candidate fields → create candidate |
| Reports | `screens/reports.jsx` | Funnel by pipeline stage; job description breakdown; hiring analytics |
| Inbox | `screens/inbox.jsx` | Activity feed — **stub**, hardcoded items, no API |

---

## 9. Database schema

All tables use `org_id` as a tenant discriminator. Test suite uses in-memory SQLite via `SQLModel.metadata.create_all()`. Production uses PostgreSQL with Alembic migrations.

```
User
  id           str  PK  (Google OAuth sub)
  email        str  unique · indexed
  name         str
  picture      str?
  title        str?
  department   str?
  created_at   str

Organization
  id           str  PK  (generated: "org-{hex8}")
  name         str
  slug         str  unique · indexed
  owner_id     str
  created_at   str

Membership
  id           str  PK
  org_id       str  indexed
  user_id      str  indexed
  role         str  ("owner" | "admin" | "member")
  joined_at    str

Invitation
  id           str  PK
  org_id       str  indexed
  email        str  indexed
  token        str  unique · indexed
  role         str
  invited_by   str
  created_at   str
  expires_at   str
  accepted_at  str?

OrgConfig
  org_id       str  PK
  provider     str  ("openai" | "anthropic" | "gemini" | "groq")
  model_name   str
  stages_json  str  (JSON array of stage strings)

OrgApiKey
  id           str  PK
  org_id       str  indexed
  provider     str
  encrypted_key str  (Fernet ciphertext)

Candidate
  id               str  PK
  org_id           str  indexed
  first_name       str
  last_name        str
  email            str
  phone            str?
  current_role     str?
  years_of_experience int?
  location         str?
  status           str  (pipeline stage name)
  source           str?  ("Referral" | "LinkedIn" | "Inbound" | ...)
  applied_at       str
  score            int?  (0–100, AI-assigned)
  cv_text          str?  (extracted text)
  cv_filename      str?
  cv_file          bytes?  (raw file stored in DB)
  job_title        str?
  job_description  str?
  ai_pre_analysis  str?  (JSON)
  career_history   str?  (JSON array)
  status_history   str?  (JSON array of {status, timestamp})
  extra_information str?

Interview
  id                  str  PK
  org_id              str  indexed
  candidate_id        str  indexed
  type                str  ("live" | "async" | "phone" | "technical" | ...)
  title               str
  interviewer         str
  date                str
  duration            int   (minutes)
  raw_content         str?  (raw transcript from Live Room)
  cleaned_transcript  str?  (AI-processed)
  ai_summary          str?  (JSON)
  extra_info          str?

Evaluation
  id                    str  PK
  org_id                str  indexed
  candidate_id          str  unique  (one per candidate)
  human_skills          str?  (JSON)
  technical_skills      str?  (JSON)
  final_recommendation  str?
  notes                 str?
  updated_at            str

Role
  id           str  PK
  org_id       str  indexed
  name         str
  department   str?
  description  str?
  headcount    int   (target headcount)

JobDescription
  id           str  PK
  org_id       str  indexed
  role_id      str?
  title        str
  description  str?
  requirements str?
  location     str?
  remote_ok    bool
  status       str  ("Draft" | "Active" | "Closed")
  openings     int
  owner        str?

Employee
  id           str  PK
  org_id       str  indexed
  first_name   str
  last_name    str
  email        str
  role_id      str?
  role_name    str?
  department   str?
  salary       float?
  currency     str?
  hire_date    str?
  location     str?
  manager      str?
  candidate_id str?  (FK to originating candidate)
```

---

## 10. Development guide

### Setup

```bash
# 1 — Generate localhost TLS certs (once — needed for Web Speech API)
./scripts/gen-certs.sh

# 2 — Copy and fill env
cp backend/.env.example backend/.env
# Set FERNET_KEY, SESSION_SECRET, GOOGLE_CLIENT_ID

# 3 — Start backend (auto-starts Postgres if needed)
./scripts/server.sh       # https://localhost:8000/docs

# 4 — Start frontend
./scripts/client.sh       # https://localhost:8080/index.html
```

### Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | PostgreSQL DSN |
| `FERNET_KEY` | yes | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `SESSION_SECRET` | yes | Any string ≥ 32 bytes |
| `GOOGLE_CLIENT_ID` | yes | OAuth 2.0 client ID from Google Cloud Console |
| `CORS_ORIGINS` | no | Comma-separated or `*` (default) |
| `APP_URL` | no | Used in invitation email links |
| `SMTP_HOST` | no | If absent, invite links print to console |
| `SMTP_PORT` | no | Default: 587 |
| `SMTP_USER` | no | |
| `SMTP_PASSWORD` | no | |
| `SMTP_FROM` | no | Default: `noreply@candid.app` |

### Database migrations

```bash
cd backend

# After changing models.py:
uv run alembic revision --autogenerate -m "describe_change"
# Review the generated file in alembic/versions/
uv run alembic upgrade head

# Other commands:
uv run alembic current      # current DB revision
uv run alembic history      # full migration history
uv run alembic downgrade -1 # roll back one step
```

Alembic runs `upgrade head` automatically at app startup via `Database.migrate()`. Tests bypass Alembic entirely and use `SQLModel.metadata.create_all()` on SQLite.

### Running tests

```bash
cd backend
uv run pytest                              # all 185 tests
uv run pytest tests/test_candidates.py    # single file
uv run pytest -k "TestCreate"             # filter by name
uv run pytest --cov=candid --cov-report=term-missing  # with coverage
```

Tests use in-memory SQLite and `app.dependency_overrides[require_org]` — no Postgres, no Google OAuth, no real AI calls needed. Each test gets a fresh DB via the `clean_tables` autouse fixture.

### Adding a new router

1. Create `backend/src/candid/routers/mything.py` — class inheriting the router pattern
2. Add to `Application._build_routers()` in `app.py`
3. Add to the test `client` fixture in `tests/conftest.py`
4. Write tests in `tests/test_mything.py`

---

## 11. Planned features

See [`README.md`](../README.md#roadmap) for the full checkbox list.

Major unimplemented areas:

**Async video interview portal** — the largest planned subsystem. Candidate-facing: one-time invite link, hardware pre-check, 3-minute timed per-question video recording (MediaRecorder), 5-second chunked upload, crash recovery with resume, single-attempt no-retake policy.

**Post-interview async pipeline** — audio extraction via ffmpeg, Whisper STT transcription, optional translation, LLM evaluation of answers. Triggered as FastAPI `BackgroundTask` after last answer submitted.

**2FA for candidates** — 6-digit OTP, SHA-256 hashed, 10-minute TTL. Replaces current Google OAuth for the public candidate application flow.

**AI-drafted rejection emails** — personalised gap analysis referencing specific JD requirements, editable rich-text before send.

**Employee performance reviews** — structured review cycles (self-eval, manager feedback, KPIs, next review date) stored as JSON history on the employee record.

**Org branding** — custom colours, fonts, and logo per org, served to unauthenticated visitors on the public job portal.

**Inbox notifications** — real backend model, event-driven (new applicant, analysis done, invite accepted), badge count in sidebar.

**PostgreSQL RLS** — row-level security as defence-in-depth below application-layer `org_id` filters.
