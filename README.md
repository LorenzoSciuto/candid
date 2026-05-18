# Candid

AI-powered recruiting assistant. Manages the full pre-hire lifecycle: CV parsing, AI analysis, live interview transcription, candidate pipeline, and team evaluation — all scoped to isolated organisations.

---

## Quick start

```bash
# 1 — Postgres (Docker required)
./scripts/postgres.sh

# 2 — Backend  (requires uv)
./scripts/server.sh           # API at https://localhost:8000  ·  /docs

# 3 — Frontend
./scripts/client.sh           # App at https://localhost:8080/index.html
```

**First run:** copy `backend/.env.example` → `backend/.env` and fill in `FERNET_KEY` and `SESSION_SECRET` (see comments in the file). `GOOGLE_CLIENT_ID` is required for login.

`server.sh` auto-starts Postgres if it isn't running.

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
