# Candid

AI-powered recruiting assistant. Manages the full pre-hire lifecycle: CV parsing, AI analysis, live interview transcription, candidate pipeline, and team evaluation — all scoped to isolated organisations.

---

## Quick start

```bash
# 1 — Postgres (Docker required)
./scripts/postgres.sh

# 2 — Backend  (requires uv)
./scripts/server.sh           # API at http://localhost:8000  ·  /docs

# 3 — Frontend
./scripts/client.sh           # App at http://localhost:8080/index.html
```

**First run:** copy `backend/.env.example` → `backend/.env` and fill in `FERNET_KEY` and `SESSION_SECRET` (see comments in the file). `GOOGLE_CLIENT_ID` is required for login.

`server.sh` auto-starts Postgres if it isn't running.

> **HTTPS / Live Room:** run `./scripts/gen-certs.sh` once to generate localhost certs. Both scripts detect them automatically and switch to HTTPS — required for the Web Speech API used in Live Room.

## Public endpoints

These routes are unauthenticated and exposed to the internet when deployed:

| URL | Description |
|-----|-------------|
| `GET /` | API landing page — server status + link to docs |
| `GET /docs` | Swagger UI — interactive API documentation |
| `GET /redoc` | ReDoc — alternative API docs |
| `GET /organizations/invitations/accept?token=<token>` | Accept a team invitation (redirects to app) |
| `GET /public/jobs` | Public job listings for an org (unauthenticated) |
| `POST /public/applications` | Candidate applies to a job (unauthenticated) |
| `GET /public/organizations/{slug}/jobs` | Portal API — job list + branding for a given org slug |
| `POST /public/organizations/{slug}/jobs/{id}/apply` | Portal API — submit application for a specific job |

All other routes require a valid JWT (`Authorization: Bearer <token>`).

### Job portal page

Each organisation has a public-facing job portal hosted at:

```
http://localhost:8080/index.html#portal/{slug}
```

Replace `{slug}` with the org's URL slug (chosen during organisation setup, visible in Settings → Team). The portal shows open positions with search and location filters, supports bookmarking, and lets candidates apply directly. It uses the org's branding colours and logo if configured.

Example: `https://your-domain.com/index.html#portal/acme-corp`

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 via CDN + Babel Standalone — no build step |
| Backend | FastAPI · SQLModel · PostgreSQL |
| Auth | JWT HS256 (48 h) · Google OAuth |
| AI providers | OpenAI · Anthropic · Gemini · Groq (switchable at runtime) |
| CV parsing | PyMuPDF (PDF) · python-docx (DOCX) |
| Encryption | Fernet — API keys encrypted at rest |
| Tests | pytest · in-memory SQLite |

---

## Structure

```
candid/
├── backend/          FastAPI application + tests
├── frontend/         React app (CDN, no build)
├── scripts/
│   ├── postgres.sh   start / create Postgres container
│   ├── server.sh     start backend
│   └── client.sh     start frontend dev server
└── README.md
```

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md) for deeper documentation.

---

## Multi-tenancy

Every data record carries an `org_id`. The `require_org` FastAPI dependency enforces isolation — no request reaches a data endpoint without a valid JWT that contains an `org_id`. New users complete an org setup wizard before gaining access to data.

