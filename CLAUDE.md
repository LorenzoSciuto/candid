# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Candid** — AI-powered recruiting assistant (pre-interview analysis, live STT, manual ingestion).

```
candid/
├── backend/          FastAPI + SQLModel + PostgreSQL
├── frontend/         React 18 (CDN) — open Candid.html directly
├── scripts/          postgres.sh · server.sh · client.sh
├── .gitignore
└── README.md
```

## Running

```bash
# 1 — Postgres (Docker)
./scripts/postgres.sh

# 2 — Backend  (requires uv)
./scripts/server.sh           # http://localhost:8000 · /docs

# 3 — Frontend
./scripts/client.sh           # http://localhost:8080/Candid.html
```

First run: copy `backend/.env.example` → `backend/.env`, fill `FERNET_KEY` and optionally pre-seed `OPENAI_API_KEY`. API key can also be set via Settings UI.

## Backend architecture

```
backend/
├── pyproject.toml            uv package manifest
├── src/candid/
│   ├── app.py                Application class — wires everything, exposes `app`
│   ├── config.py             Settings (pydantic-settings, reads .env)
│   ├── database.py           Database class — engine + get_session()
│   ├── models.py             SQLModel tables: Candidate, Interview, Evaluation, Config
│   ├── schemas.py            Pydantic I/O models
│   ├── services/
│   │   ├── ai_engine.py      AIEngine + AIEngineFactory (OpenAI / Anthropic)
│   │   ├── cv_extractor.py   CVExtractor — PDF (PyMuPDF) + DOCX
│   │   └── crypto.py         CryptoService — Fernet encrypt / decrypt / mask
│   └── routers/
│       ├── candidates.py     CandidatesRouter  — CRUD /candidates
│       ├── analysis.py       AnalysisRouter    — /upload-cv, /analyze
│       ├── interviews.py     InterviewsRouter  — CRUD + /process
│       ├── evaluations.py    EvaluationsRouter — upsert + get
│       ├── config.py         ConfigRouter      — get/put/test
│       └── quick_add.py      QuickAddRouter    — /quick-add
└── tests/
    ├── conftest.py           In-memory SQLite fixtures, TestClient
    ├── test_candidates.py
    ├── test_interviews.py
    ├── test_evaluations.py
    ├── test_config.py
    └── test_services.py      CryptoService + CVExtractor unit tests
```

### OO pattern

Every router is a class. `__init__` receives only the services it needs. `_register()` defines route closures that delegate to `_method()` implementations. `Application` in `app.py` is the DI root — it instantiates all services and mounts all routers.

```python
# Instantiation chain (app.py)
Application
  ├── Settings         (pydantic-settings)
  ├── Database         (SQLModel engine)
  ├── CryptoService    (Fernet)
  ├── CVExtractor
  ├── AIEngineFactory  (builds AIEngine per-request from DB config)
  └── *Router(s)       (receive only the services they use)
```

### Running tests

```bash
cd backend
uv run pytest              # all tests
uv run pytest tests/test_candidates.py   # single file
uv run pytest -k "TestCreate"            # filter
```

Tests use in-memory SQLite — no Postgres needed.

## Frontend architecture

No bundler. Script load order in `Candid.html` is strict:

1. `data.jsx` → `window.CANDID_DATA` (mock data + sample CV/transcript)
2. `ui.jsx` → primitives: `Icons`, `Btn`, `Badge`, `Avatar`, `Modal`, `Rating`, `Sidebar`, `Topbar`
3. `tweaks-panel.jsx` → runtime design knobs (`useTweaks`)
4. `screens/*.jsx` → one component per screen, each assigns to `window.*Screen`
5. `app.jsx` → `<App>` + routing state + `ReactDOM.createRoot`

`window.API_BASE = "http://localhost:8000"` set in `Candid.html`. All three wired screens (`preinterview`, `quickadd`, `settings`) fall back to mock data when the backend is unreachable.
