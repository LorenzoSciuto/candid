<div align="center">

# Candid

### Hire on evidence, not on gut feeling.

**The open-source AI recruiting assistant that reads every CV, listens to every interview and keeps every organisation's data locked to its own rows.**

[![CI](https://github.com/LorenzoSciuto/candid/actions/workflows/release.yml/badge.svg)](https://github.com/LorenzoSciuto/candid/actions/workflows/release.yml)
[![Release](https://img.shields.io/github/v/release/LorenzoSciuto/candid?sort=semver)](https://github.com/LorenzoSciuto/candid/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-RLS-4169E1?logo=postgresql&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)

[Features](#what-it-does) · [Quick start](#quick-start) · [Architecture](#architecture) · [Roadmap](docs/ROADMAP.md) · [Contributing](CONTRIBUTING.md)

A project by **Wennovate**

</div>

---

## Why Candid?

Recruiting teams drown in CVs, take interview notes by hand and copy candidates between spreadsheets. Candid puts the whole pre-hire workflow in one place and lets AI do the reading, transcribing and drafting, while **people keep the decisions**.

- **Drop a CV, get a verdict.** Fit score, strengths, gaps and the questions worth asking, matched against every open position.
- **Interview without typing.** Live speech-to-text in the browser, then an AI summary attached to the candidate.
- **Interview while you sleep.** Send async video questions; candidates answer from any browser, no account needed.
- **Your AI, your keys.** OpenAI, Anthropic, Gemini or Groq, per organisation, with automatic fallback.
- **Multi-tenant for real.** Isolation enforced in the code *and* by PostgreSQL Row-Level Security, tested against a real database in CI.
- **Zero-build frontend.** Clone, run two scripts, start hiring. No `node_modules`.

## What it does

Candid covers the whole pre-hire workflow for an in-house recruiting team:

| | |
|---|---|
| **CV intake & AI analysis** | Upload a PDF/DOCX (or drop it on *Quick Add*): the CV is parsed, scored, matched against your open positions and summarised as strengths, gaps and interview questions. |
| **Hiring pipeline** | Drag-and-drop Kanban with stages each organisation configures, plus status history and an activity log per candidate. |
| **Live interview room** | Real-time speech-to-text in the browser. The transcript is cleaned, summarised and attached to the candidate. You can also upload a recording, which is transcribed with Whisper (OpenAI or Groq). |
| **Async video interviews** | Send a set of questions. The candidate records answers from any browser, with no account. Recruiters watch the answers in the candidate profile. |
| **Structured evaluation** | Human- and technical-skill scorecards, a final recommendation and AI-drafted rejection emails. |
| **Positions, roles & people** | Job descriptions and role definitions with AI rewriting, headcount per role, an employee directory and performance reviews. |
| **Public job portal** | Each organisation gets a branded careers page (`#portal/<slug>`) where candidates apply with their CV. |
| **Team & tenancy** | Google sign-in, organisations with owner/admin/member roles, email invitations and a notification inbox. |
| **Bring your own AI** | OpenAI, Anthropic, Gemini or Groq, switchable at runtime per organisation, with automatic fallback to the other configured providers. Keys are encrypted at rest. |
| **Reports** | Funnel by your own pipeline stages, exportable to CSV. |
| **Three languages** | The whole UI is available in English, Italian and German. |

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI["React 18 SPA<br/>(no build step)"]
        Portal["Public pages<br/>#portal · #video"]
    end

    subgraph API["FastAPI backend"]
        direction TB
        App["app.py<br/>composition root"]
        Routers["routers/<br/>one class per resource"]
        Services["services/<br/>AI · email · transcription · video"]
        Commons["commons/<br/>models · auth · tenancy · config"]
        App --> Routers --> Services --> Commons
        Routers --> Commons
    end

    DB[("PostgreSQL<br/>Row-Level Security")]
    LLM["LLM providers<br/>OpenAI · Anthropic · Gemini · Groq"]

    UI -- "JWT (Bearer)" --> Routers
    Portal -- "slug / invite token" --> Routers
    Commons --> DB
    Services --> LLM
```

### Layered, dependency-injected backend

- **`app.py`** is the only place that builds services and wires them into routers.
- **Routers** are classes. `__init__` receives exactly the services they need, and route closures delegate to small private methods. That makes every router testable in isolation with fakes.
- **Import rules are enforced by a test** (`tests/test_architecture.py`), so a violation fails CI:
  - `commons` imports only `commons`;
  - `services` import only `commons`;
  - routers never import other routers.

  Shared code lives in `commons/`, which keeps the components splittable later.
- **Frontend and backend share no code.** They talk only through the HTTP API and can be deployed, or split into separate repositories, independently.

### Tenant isolation in two layers

Every business table carries an `org_id`, and isolation is enforced twice:

1. **Application layer.** Every query filters by the caller's organisation. Every id that arrives in a request (path, query or body foreign key) is resolved through `get_in_org()`, so a guessed id from another organisation is a 404, never a link.
2. **Database layer.** PostgreSQL Row-Level Security policies sit on every tenant table. At the start of each transaction the app switches to an unprivileged role (`SET LOCAL ROLE candid_app`) and publishes the tenant as a transaction-local setting. RLS therefore applies even when the connection user owns the tables, and the context survives commits.
3. **Explicit cross-organisation access.** Endpoints that legitimately cross organisations (sign-in, public portal, candidate video links) opt out with a visible `rls_bypass` dependency. Everything else is *deny by default*: a forgotten filter returns nothing instead of another tenant's data.

This is verified against a real PostgreSQL in CI, as a superuser on purpose (`tests/test_rls_postgres.py`). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

### Security highlights

- Google ID tokens are verified for audience and verified email. Session JWTs are HS256 with a pinned algorithm and expiry, and the app refuses to start with a missing, short or placeholder secret.
- Every data request re-checks membership, so removed members lose access immediately. Settings changes (AI keys, SMTP, stages, branding) require an admin.
- Provider API keys and SMTP passwords are Fernet-encrypted at rest and only ever returned masked.
- Uploads have size caps, extension allowlists and server-generated file names.
- Public endpoints are rate-limited. Video-interview tokens are 128-bit and expire, and recordings can only be written to the token's own interview and become read-only once submitted.
- SMTP always verifies TLS certificates, and user-controlled values are HTML-escaped in emails.
- Provider errors are logged server-side and never echoed to clients.
- Lint includes `bandit`-style security rules (ruff `S`).

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLModel/SQLAlchemy, Alembic, uv |
| Database | PostgreSQL 16 with Row-Level Security |
| Frontend | React 18 (pinned CDN builds with SRI), JSX compiled in the browser, no bundler |
| Auth | Google Identity Services → app-issued JWT |
| AI | OpenAI, Anthropic, Google Gemini and Groq SDKs; Whisper for audio |
| Documents | PyMuPDF (PDF), python-docx (DOCX) |
| Quality | pytest (unit, API and real-Postgres RLS tests), ruff, GitHub Actions |

## Quick start

Requirements: [uv](https://docs.astral.sh/uv/), Docker (for PostgreSQL), Python 3, and `ffmpeg` if you want to transcribe video recordings.

```bash
git clone https://github.com/LorenzoSciuto/candid.git && cd candid

cp backend/.env.example backend/.env    # then fill FERNET_KEY, SESSION_SECRET, GOOGLE_CLIENT_ID

./scripts/server.sh    # starts PostgreSQL in Docker, applies migrations, API on http://localhost:8000 (/docs)
./scripts/client.sh    # frontend on http://localhost:8080
```

Sign in with Google, create your organisation in the setup wizard, then add an AI provider key in **Settings → AI**.

> **HTTPS for the Live Room.** The Web Speech API needs a secure context. Run `./scripts/gen-certs.sh` once (it uses [mkcert](https://github.com/FiloSottile/mkcert)); both scripts detect the certificates and switch to HTTPS.

### Configuration

All settings are environment variables (see [`backend/.env.example`](backend/.env.example)):

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

## Development

```bash
cd backend
uv run pytest                                   # full suite: SQLite, no services needed
uv run pytest tests/test_candidates.py -k Ownership
uv run --with ruff ruff check src tests alembic

# Row-Level Security tests against a real PostgreSQL
docker run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_USER=candid -e POSTGRES_PASSWORD=test postgres:16-alpine
CANDID_TEST_DATABASE_URL=postgresql://candid:test@127.0.0.1:55432/candid uv run pytest tests/test_rls_postgres.py

# Database migrations
uv run alembic revision --autogenerate -m "describe_change"
uv run alembic upgrade head

node ../frontend/tests/check.js                  # frontend: scripts exist and every i18n key is in EN/IT/DE
```

## Releases

Every push to `main` runs CI (lint, migrations-vs-models check, backend tests including RLS on PostgreSQL, frontend checks). If it passes and the new commits include a releasable [Conventional Commit](https://www.conventionalcommits.org/), the next [semantic version](https://semver.org/) is tagged `vX.Y.Z` and published as a GitHub Release with generated notes. `feat` bumps the minor version, `fix`/`perf` the patch version, and `BREAKING CHANGE` the major version. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Project layout

```
candid/
├── backend/            FastAPI application, Alembic migrations, tests
│   └── src/candid/
│       ├── app.py      composition root
│       ├── commons/    shared models, schemas, auth, tenancy, config
│       ├── services/   AI engine, email, transcription, video interviews, crypto, CV parsing
│       └── routers/    one class per REST resource
├── frontend/           React SPA served as static files (no build step)
├── scripts/            local dev: postgres.sh · server.sh · client.sh · gen-certs.sh · reset-db.sh
└── docs/               architecture notes
```

## Deployment notes

- **Database role.** On first start, migration `0002` creates the unprivileged `candid_app` role and grants it to the migrating user. That user therefore needs `CREATEROLE`, or a DBA can create `candid_app` (`NOLOGIN`) beforehand and `GRANT candid_app TO <app user>`. The app must run the code and migration versions together: rolling back migration `0002` alone leaves the app without table permissions.
- **Reverse proxy.** The public apply endpoint is rate-limited per client IP. Behind a proxy, start uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy ip>`, otherwise every applicant shares the proxy's limit.
- **Databases created before 1.0.** The migration history was squashed into a single baseline for the first public release. A development database from an earlier checkout must be recreated with `./scripts/reset-db.sh`, which destroys its data.

## Project status

Candid **1.x is feature-complete for a single recruiting team's pre-hire workflow** and runs in production-like setups. It is not yet a turnkey SaaS: there is no container image, sign-in is Google-only, and GDPR tooling (consent, retention, data export) is still on the roadmap. See [docs/ROADMAP.md](docs/ROADMAP.md) for what works, what is missing and what comes next.

> **Responsible use.** Candid scores and summarises candidates, but it never rejects anyone by itself: every stage change and rejection is a human action. AI-assisted hiring is regulated in many jurisdictions (for example as *high-risk* under the EU AI Act), so check your obligations before using it on real applicants.

## Known limitations

- **Rate limiter.** The public-endpoint rate limiter is in-memory, so each worker process counts separately. A multi-worker deployment needs a shared store such as Redis.
- **No frontend build step.** The frontend compiles JSX in the browser. That keeps the project dependency-free and trivial to run, but a production deployment would precompile it.
- **Session token in `localStorage`.** The session token is kept in `localStorage`, and the app has no HTML-injection sinks, all content rendering through React's escaping. Moving to httpOnly cookies would also require CSRF protection.

## License

[MIT](LICENSE) © Wennovate
