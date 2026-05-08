Project Requirements Document (PRD)

Project Name: Candid (AI-Powered Recruiting Assistant)

---

## 1. Project Overview

Candid is an internal recruiting web application designed to drastically reduce the time spent on candidate evaluation and data entry. It supports three main data ingestion flows:

**CV Analysis (Pre-Interview):** Parse a CV against a Job Description to identify strengths, weaknesses, and key questions.

**Live Capture:** Real-time speech-to-text during interviews.

**Manual Ingestion:** Quick pasting of raw notes or existing transcripts.

The AI pipeline handles speaker separation, data extraction, and strategic analysis, storing everything in a structured database.

---

## 2. Technology Stack

**Frontend:** React 18 (via CDN + Babel Standalone), custom CSS design system — no build step, open `Candid.html` directly in Chrome.

**Live Recording:** Web Speech API (Chrome-based STT) for real-time transcription.

**File Processing:** PyMuPDF (PDF) and python-docx (DOCX) to extract text from CV uploads on the backend.

**Backend:** Python 3.11+ with FastAPI. Cryptography (Fernet) for secure API key encryption at rest.

**Database:** PostgreSQL with SQLModel (SQLAlchemy + Pydantic).

**AI Integration:** Multi-model support — OpenAI GPT-4o and Anthropic Claude 3.5.

---

## 3. Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL running locally (or a managed instance)
- Chrome (for Live Room — Web Speech API)

### 1 — Database

```bash
createdb candid
createuser candid
psql -c "ALTER USER candid PASSWORD 'password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE candid TO candid;"
```

### 2 — Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: set DATABASE_URL and generate FERNET_KEY:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

uvicorn main:app --reload
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 3 — Frontend

```bash
# Option A: just open the file (works for most features)
open Candid.html          # macOS
xdg-open Candid.html      # Linux

# Option B: local server (avoids CORS on file upload)
python3 -m http.server 8080
# then visit http://localhost:8080/Candid.html
```

### 4 — Configure AI

Open the app → Settings → AI providers. Enter your OpenAI or Anthropic API key and click **Save**, then **Test**.

---

## 4. Architecture

### Backend (`backend/`)

| File | Role |
|------|------|
| `main.py` | FastAPI app, all routes |
| `models.py` | SQLModel table definitions |
| `schemas.py` | Pydantic request/response models |
| `database.py` | Engine, session, `create_db()` |
| `ai_engine.py` | AI calls — CV analysis, quick-parse, transcript processing |
| `cv_extractor.py` | PDF / DOCX text extraction |
| `crypto.py` | Fernet encrypt/decrypt/mask for API keys |

### Frontend

No bundler. React 18 + Babel Standalone from CDN. Script load order in `Candid.html` is strict:

1. `data.jsx` → `window.CANDID_DATA` (mock data)
2. `ui.jsx` → primitives, icons, Sidebar, Topbar
3. `tweaks-panel.jsx` → design knobs system
4. `screens/*.jsx` → one component per screen
5. `app.jsx` → root `<App>` + routing

`window.API_BASE = "http://localhost:8000"` is set in `Candid.html`. When the backend is unreachable, screens fall back to mock data so the UI stays functional as a standalone prototype.

---

## 5. API Reference

### Candidates
```
GET    /candidates              list (optional ?status=&q= filters)
POST   /candidates              create
GET    /candidates/{id}         get (includes interviews + evaluation)
PATCH  /candidates/{id}         update fields
DELETE /candidates/{id}         delete
```

### CV & AI Analysis
```
POST   /upload-cv               multipart; returns { filename, text, word_count }
POST   /analyze                 { job_title, job_description, cv_text, candidate_id? }
                                → { strengths[], weaknesses[], questions[], extracted{} }
```

### Interviews
```
GET    /interviews              list (optional ?candidate_id= filter)
POST   /interviews              create
PATCH  /interviews/{id}         update
POST   /interviews/{id}/process { raw_content } → AI-cleaned transcript + summary
```

### Evaluations
```
GET    /evaluations/{candidate_id}
POST   /evaluations             upsert { candidate_id, human_skills, technical_skills,
                                         final_recommendation, notes }
```

### Quick-Add
```
POST   /quick-add               { text } → { first_name, last_name, email, phone,
                                             current_role, years_of_experience, summary }
```

### Config
```
GET    /config                  { provider, model_name, api_key_masked }
PUT    /config                  { provider, model_name, api_key }
POST   /config/test             test connection with current config
```

---

## 6. Database Schema

**candidates** — id (PK), first_name, last_name, email, phone, current_role, years_of_experience, location, status, source, applied_at, score, cv_text, cv_filename, job_title, job_description, ai_pre_analysis (JSON), extra_information

**interviews** — id (PK), candidate_id (FK), type, title, interviewer, date, duration, raw_content, cleaned_transcript, ai_summary, extra_info

**evaluations** — id (PK), candidate_id (FK, unique), human_skills (JSON), technical_skills (JSON), final_recommendation, notes

**config** — id=1 (single row), provider, model_name, encrypted_api_key

---

## 7. AI Flows

### CV vs JD Analysis

1. User uploads PDF/DOCX → `POST /upload-cv` → backend extracts text
2. User clicks "Run AI analysis" → `POST /analyze`
3. Backend prompts the LLM with CV + JD, returns `{ strengths, weaknesses, deep_dive_questions, extracted_info }`
4. Frontend animates results (streaming or instant mode via Tweaks panel)

### Quick Paste (Manual Ingestion)

1. User pastes raw notes into Quick Add modal → `POST /quick-add`
2. Backend parses with LLM → structured fields
3. User reviews, clicks "Create candidate" → `POST /candidates`

### Live Interview Transcript

1. Web Speech API captures transcript in browser (Chrome only)
2. After stop, `POST /interviews/{id}/process` with `raw_content`
3. Backend runs speaker separation + summary with LLM
4. Result stored as `cleaned_transcript` + `ai_summary`

---

## 8. Evaluation System (1–5 scale)

**Human skills:** Communication, Problem Solving, Adaptability, Cultural Fit

**Technical skills:** Domain Knowledge, Execution Speed, Analytical Thinking

**Final recommendation:** No Hire / Lean No / Lean Hire / Strong Hire

---

## 9. Security Notes

- API keys are encrypted with Fernet before storage; only the masked form is returned by `GET /config`
- Generate your `FERNET_KEY` once and store it securely; losing it means stored keys can't be decrypted
- CORS is open in development (`allow_origins=["*"]`); restrict to your domain in production
- `FERNET_KEY` and database credentials must never be committed; use `.env` (already in `.gitignore`)
