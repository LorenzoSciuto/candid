# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Candid** — AI-powered recruiting assistant (pre-interview analysis, live STT, candidate pipeline, multi-tenant).

```
candid/
├── backend/          FastAPI + SQLModel + PostgreSQL
├── frontend/         React 18 (CDN) — no build step
├── scripts/          postgres.sh · server.sh · client.sh
└── README.md
```

## Running

```bash
./scripts/server.sh           # starts Postgres if needed, then backend on :8000
./scripts/client.sh           # frontend on :8080/index.html
```

First run: copy `backend/.env.example` → `backend/.env`, fill `FERNET_KEY` and `SESSION_SECRET`. API keys can be set via Settings UI.

## Backend architecture

```
backend/src/candid/
├── app.py            Application — DI root, mounts all routers
├── config.py         Settings (pydantic-settings, reads .env)
├── database.py       Database — engine + get_session() + migrate() (Alembic)
├── dependencies.py   require_user / require_org FastAPI deps
├── models.py         SQLModel tables (all multi-tenant with org_id)
├── schemas.py        Pydantic I/O models
├── prompts.py        All LLM prompt templates
├── services/
│   ├── ai_engine.py      AIEngine + AIEngineFactory
│   ├── auth_service.py   JWT create/verify
│   ├── crypto.py         CryptoService — Fernet encrypt/decrypt/mask
│   ├── cv_extractor.py   CVExtractor — PDF (PyMuPDF) + DOCX
│   └── email_service.py  SMTP invitation emails
└── routers/
    ├── auth.py           /auth/* — login, org setup, invite accept
    ├── organizations.py  /organizations/* — CRUD + invitations + delete
    ├── candidates.py     /candidates — CRUD + CV download
    ├── analysis.py       /upload-cv, /analyze
    ├── interviews.py     /interviews — CRUD + /process + /summarize
    ├── evaluations.py    /evaluations — upsert + get
    ├── config.py         /config — AI provider + pipeline stages
    ├── roles.py          /roles — CRUD + AI description improve
    ├── job_descriptions.py /job-descriptions — CRUD + AI improve
    ├── employees.py      /employees — CRUD
    ├── performance_reviews.py /employees/{id}/reviews — CRUD + AI improve
    ├── quick_add.py      /quick-add — AI extraction
    ├── ai.py             /ai/rewrite — email rewrite
    ├── public.py         /public/jobs + /public/applications — unauthenticated
    ├── notifications.py  /notifications — inbox events
    └── branding.py       /branding — org white-labelling
```

### OO + DI pattern

Every router is a class. `__init__` receives only the services it needs. `_register()` defines route closures that delegate to `_method()` implementations.

### Auth dependencies

- `require_user` — validates JWT; accepts wizard tokens (no `org_id`). Used by `/auth/*` endpoints.
- `require_org` — wraps `require_user`; rejects tokens without `org_id`. Used by **all data endpoints**. Prevents wizard tokens from accessing org data.

New users complete an org setup wizard → get a full token with `org_id`.

### DB migrations (Alembic)

```bash
cd backend
uv run alembic revision --autogenerate -m "describe_change"
uv run alembic upgrade head
uv run alembic current / history / downgrade -1
```

`DATABASE_URL` env var overrides `alembic.ini`. `migrate()` in `Database` runs `upgrade head` at app startup.

### Running tests

```bash
cd backend
uv run pytest                              # all tests
uv run pytest tests/test_candidates.py    # single file
uv run pytest -k "TestCreate"             # filter
```

Tests use in-memory SQLite + `app.dependency_overrides[require_org]` — no Postgres needed.

Test naming: snake_case `test_method_should_behavior_when_condition`.

## Frontend architecture

No bundler. Script load order in `index.html` is strict (version query strings bust cache):

1. `data.jsx` → `window.CANDID_DATA` — STATUS (pipeline stages), HUMAN_SKILLS, TECH_SKILLS, SKILL_KEYS (EN→i18n map)
2. `translations.jsx` → `TRANSLATIONS` object + `window.useT()` hook (EN / IT / DE)
3. `ui.jsx` → shared primitives: `Icons`, `Btn`, `Badge`, `Avatar`, `Modal`, `Rating`, `Sidebar`, `Topbar`, `StatusBadge`, `useApiData`
4. `tweaks-panel.jsx` → runtime design knobs (`useTweaks`)
5. `screens/*.jsx` → one component per screen, exports to `window.*Screen`
6. `app.jsx` → `<App>` — routing, auth flow, org wizard, fetch interceptor

### Key patterns

- `window.useT()` — i18n hook, returns `(key) => string`. All UI strings must use this.
- `window.CANDID_DATA.STATUS` — pipeline stages array, overwritten from `/config/stages` on startup.
- Skill i18n: English name is the DB key. `SKILL_KEYS[englishName]` → i18n key → translated label.
- Fetch interceptor in `app.jsx` injects `Authorization: Bearer <token>` and auto-logs out on 401.
- `window.refreshCounts` — callable from any screen to refresh sidebar counters.
- `window.dispatchEvent(new CustomEvent("candid:stages", { detail: stages }))` — notifies screens of stage changes.

### Screens and what they own

| Screen | File | Notes |
|--------|------|-------|
| Pipeline | `screens/pipeline.jsx` | Kanban drag-drop; listens to `candid:stages` event |
| Candidates | `screens/candidates.jsx` | Table + filters; `ConfirmDialog` for delete |
| Candidate detail | `screens/candidate.jsx` | Tabs: Overview, CV Analysis, Interviews, Evaluation, Activity |
| Jobs (Positions) | `screens/jobs.jsx` | JD list + `JdViewModal` |
| Roles | `screens/roles.jsx` | Headcount bar + dept groups |
| Employees | `screens/employees.jsx` | People directory |
| Interviews | `screens/interviews.jsx` | List + week view + `ScheduleModal` |
| Settings | `screens/settings.jsx` | AI config, team, pipeline stages, danger zone |
| Quick Add | `screens/quickadd.jsx` | CV upload → AI parse → candidate create |
| Inbox | `screens/inbox.jsx` | Notification feed |
| Reports | `screens/reports.jsx` | Hiring funnel analytics |
| Live Room | `screens/liveroom.jsx` | Real-time interview transcription (Web Speech API, requires HTTPS) |
| Pre-interview | `screens/preinterview.jsx` | AI briefing before interview |
