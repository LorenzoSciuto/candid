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

---

## Roadmap

See [`docs/PROJECT.md`](docs/PROJECT.md) for full architecture and feature documentation.

### Shipped ✅
- [x] Google OAuth + JWT auth
- [x] Multi-tenant org isolation (`require_org`)
- [x] Org setup wizard + team invitations
- [x] CV upload and AI parsing (PDF + DOCX)
- [x] AI candidate analysis (skills, score, career history, role fit)
- [x] Candidate pipeline — Kanban with configurable stages
- [x] Quick Add — paste text → AI extracts candidate fields
- [x] Live Room — real-time interview transcription (Web Speech API)
- [x] Pre-interview AI briefing
- [x] Interview scheduling (list + week calendar)
- [x] Per-candidate evaluation form
- [x] Job descriptions + roles with AI improvement
- [x] Employee directory
- [x] Reports — hiring funnel analytics
- [x] AI provider switching at runtime (OpenAI / Anthropic / Gemini / Groq)
- [x] Encrypted API key storage (Fernet)
- [x] Pipeline stages editor
- [x] i18n — EN / IT / DE

### Planned ⬜
- [ ] **Candidate-facing async video interview portal** — one-time invite link, 3-min timed video answers per question, chunked upload, crash recovery
- [ ] **2FA for candidates** — 6-digit OTP email verification (SHA-256, 10-min TTL)
- [ ] **Public job listing page** — unauthenticated, shows org branding + active openings
- [ ] **Whisper / STT async pipeline** — post-interview audio extraction + transcription (OpenAI Whisper or Groq)
- [ ] **AI-drafted rejection emails** — personalised gap analysis, editable before send
- [ ] **Employee performance reviews** — structured review cycles (self-eval + manager feedback + KPIs)
- [ ] **Org branding / white-labelling** — custom colours, fonts, logo per org for public portal
- [ ] **Inbox notifications** — backend model + real events (new applicant, analysis done, invite accepted)
- [ ] **AI provider fallback + exponential backoff** — auto-failover across providers on error
- [ ] **PostgreSQL RLS** — row-level security as defence-in-depth below application filters
