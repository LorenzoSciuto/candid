# Candid — AI-Powered Recruiting Assistant

Internal recruiting app with AI-assisted CV analysis, live interview transcription, and a full candidate pipeline.

---

## Quick Start

```bash
# 1 — Postgres (Docker)
./scripts/postgres.sh

# 2 — Backend  (requires uv)
./scripts/server.sh           # http://localhost:8000 · /docs

# 3 — Frontend
./scripts/client.sh           # http://localhost:8080/index.html
```

First run: copy `backend/.env.example` → `backend/.env` and fill in:
- `FERNET_KEY` — generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- `SESSION_SECRET` — any long random string
- Optionally `OPENAI_API_KEY` (or set via Settings UI after login)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 (CDN + Babel Standalone) · no build step |
| Backend | FastAPI · SQLModel · PostgreSQL |
| File parsing | PyMuPDF (PDF) · python-docx (DOCX) |
| AI | OpenAI · Anthropic · Gemini · Groq (switchable via Settings) |
| Auth | JWT (HS256, 48h TTL) · Google OAuth or demo mode |
| Encryption | Fernet — API keys encrypted at rest |

---

## Backend Architecture

```
backend/
├── src/candid/
│   ├── app.py              Application class — DI root, mounts all routers
│   ├── config.py           Settings (pydantic-settings, reads .env)
│   ├── database.py         Database class — engine, session, migrations
│   ├── dependencies.py     require_user — JWT auth FastAPI dependency
│   ├── models.py           SQLModel tables
│   ├── prompts.py          All LLM prompt templates
│   ├── schemas.py          Pydantic request/response models
│   ├── routers/            One class per resource (CandidatesRouter, etc.)
│   └── services/
│       ├── ai_engine.py    AIEngine + AIEngineFactory
│       ├── auth_service.py JWT create/verify
│       ├── crypto.py       Fernet encrypt/decrypt
│       └── cv_extractor.py PDF + DOCX text extraction
└── tests/                  pytest · in-memory SQLite · 128 tests
```

### DI pattern

`Application` in `app.py` is the single composition root. Every router is a class whose `__init__` receives only the services it needs. Routes are defined as closures in `_register()` and delegate to `_method()` implementations.

```
Application
  ├── Settings         pydantic-settings
  ├── Database         SQLModel engine + session factory
  ├── CryptoService    Fernet
  ├── CVExtractor      PDF / DOCX
  ├── AIEngineFactory  builds AIEngine per-request from DB config
  └── *Router(s)
```

### Migrations

`database.py` keeps a `_MIGRATIONS` list of `(table, column, ddl_type)` tuples. On startup, missing columns are added with `ALTER TABLE`. New columns go here — never manually.

### Running tests

```bash
cd backend
uv run pytest                          # all tests
uv run pytest tests/test_candidates.py # single file
uv run pytest -k "TestCreate"          # filter by name
```

---

## Frontend Architecture

No bundler. Script load order in `index.html` is strict:

1. `data.jsx` → `window.CANDID_DATA` (constants: STATUS, skills lists, sample data)
2. `translations.jsx` → i18n strings + `window.useT()`
3. `ui.jsx` → primitives: `Icons`, `Btn`, `Badge`, `Avatar`, `Modal`, `Rating`, `Sidebar`, `Topbar`, `StatusBadge`
4. `tweaks-panel.jsx` → runtime design knobs (`useTweaks`)
5. `screens/*.jsx` → one component per screen, each assigns to `window.*Screen`
6. `app.jsx` → `<App>` — routing, auth, fetch interceptor (injects Bearer token)

`window.API_BASE = "http://localhost:8000"` is set in `index.html`.

The fetch wrapper in `app.jsx` auto-injects `Authorization: Bearer <token>` for all requests to `API_BASE` and auto-logs out on 401.

### Auth

Login flow: `POST /auth/demo` (dev) or `POST /auth/google` (prod) → JWT stored in `localStorage` as part of the user object.

To enable Google OAuth: uncomment and fill `window.GOOGLE_CLIENT_ID` in `index.html`, then create an OAuth 2.0 credential in [Google Cloud Console](https://console.cloud.google.com) with your dev/prod origins.

---

## API Reference

All endpoints except `/auth/*` require `Authorization: Bearer <token>`.

### Auth
```
POST  /auth/demo                        → { id, name, email, token }
POST  /auth/google   { token }          → { id, name, email, picture, token }
```

### Candidates
```
GET   /candidates              ?status= ?q=    list (includes has_ai, ai_score, eval_avg)
POST  /candidates              { first_name, last_name, ... }
GET   /candidates/{id}                  get (includes interviews, evaluation, status_history)
GET   /candidates/{id}/cv               download original CV file (PDF/DOCX)
PATCH /candidates/{id}         { ...fields }
DELETE /candidates/{id}
GET   /candidates/stats                 { total, by_status, by_source, avg_score }
```

### CV & Analysis
```
POST  /upload-cv    file (multipart), candidate_id? (form)
                    → { filename, text, word_count }
                    Saves raw binary to candidate.cv_file when candidate_id provided.
POST  /analyze      { candidate_id?, job_title, cv_text, job_description?, notes? }
                    → { overview, strengths[], weaknesses[], questions[],
                        career_history[], role_fits[], extracted{} }
```

### Interviews
```
GET   /interviews              ?candidate_id=
POST  /interviews              { candidate_id, type, title?, interviewer?, raw_content? }
PATCH /interviews/{id}
DELETE /interviews/{id}
POST  /interviews/{id}/process { raw_content } → { cleaned_transcript, summary, extra_info }
```

### Evaluations
```
GET   /evaluations/{candidate_id}
POST  /evaluations   { candidate_id, human_skills{}, technical_skills{},
                       final_recommendation, notes? }   (upsert)
```

### Roles
```
GET   /roles
POST  /roles              { name, department?, description?, headcount }
PATCH /roles/{id}
DELETE /roles/{id}
POST  /roles/improve-description  { text, role_name }  → { improved_text }
```

### Job Descriptions (Positions)
```
GET   /job-descriptions
POST  /job-descriptions   { role_id, title, description?, requirements?,
                            location?, remote_ok, status, openings, owner? }
PATCH /job-descriptions/{id}
DELETE /job-descriptions/{id}
POST  /job-descriptions/improve-jd  { text, role_name }  → { improved_text }
```

### Employees (People)
```
GET   /employees
POST  /employees   { first_name, last_name, email?, role_id?, role_name?,
                     department?, salary?, currency, hire_date?, location?,
                     manager?, candidate_id? }
PATCH /employees/{id}
DELETE /employees/{id}
```

### Quick Add
```
POST  /quick-add   { text }  → parsed candidate fields (AI extraction)
```

### Config & API Keys
```
GET   /config                           { provider, model_name, api_key_masked }
PUT   /config       { provider, model_name, api_key? }
POST  /config/test                      test AI connection
GET   /config/keys                      list stored providers
POST  /config/keys  { provider, api_key }   upsert encrypted key
DELETE /config/keys/{provider}
```

### AI Rewrite
```
POST  /ai/rewrite   { action, text, to?, subject?, candidate_name?, role? }
                    actions: rewrite_email | rewrite_candidate_email
                    → { result }
```

---

## Database Schema

**candidate** — id, first_name, last_name, email, phone, current_role, years_of_experience, location, status, source, applied_at, score, cv_text, cv_filename, cv_file (BYTEA), job_title, job_description, ai_pre_analysis (JSON), career_history (JSON), status_history (JSON), extra_information

**interview** — id, candidate_id (FK), type, title, interviewer, date, duration, raw_content, cleaned_transcript, ai_summary, extra_info

**evaluation** — id, candidate_id (FK unique), human_skills (JSON), technical_skills (JSON), final_recommendation, notes

**role** — id, name, department, description, headcount

**job_description** — id, role_id (FK), title, description, requirements, location, remote_ok, status, openings, owner

**employee** — id, first_name, last_name, email, role_id (FK), role_name, department, salary, currency, hire_date, location, manager, candidate_id

**config** — id=1 (singleton), provider, model_name, encrypted_api_key

**api_key** — provider (PK), encrypted_key

---

## AI Flows

### CV Analysis
1. User uploads PDF/DOCX → `POST /upload-cv` → text extracted, raw binary saved to `candidate.cv_file`
2. `POST /analyze` → LLM returns overview, strengths/weaknesses, interview questions, role fit scores against all active positions, career history, extracted name/email/role
3. Results stored on candidate as `ai_pre_analysis` JSON

### Quick Add
1. Paste raw notes / email / LinkedIn text → `POST /quick-add`
2. LLM extracts structured fields → user reviews → `POST /candidates`

### Live Interview
1. Web Speech API (Chrome) captures transcript in browser
2. `POST /interviews/{id}/process` → LLM cleans transcript, separates speakers, generates summary
3. Stored as `cleaned_transcript` + `ai_summary`

---

## Evaluation System

**Human skills:** Communication, Problem Solving, Adaptability, Cultural Fit  
**Technical skills:** Domain Knowledge, Execution Speed, Analytical Thinking  
**Ratings:** 1–5 per skill  
**Final recommendation:** No Hire / Lean No / Lean Hire / Strong Hire

---

## Security Notes

- API keys encrypted with Fernet before DB storage; masked on read
- `FERNET_KEY` and `SESSION_SECRET` must be in `.env` (gitignored); losing `FERNET_KEY` makes stored keys unrecoverable
- JWT tokens expire after 48 h; 401 responses auto-log out the frontend
- CORS is `allow_origins=["*"]` in dev — restrict in production
