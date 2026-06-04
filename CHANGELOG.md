# Changelog

All notable changes to Candid. Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — develop

### Security
- **Fix:** Google OAuth token now validates `aud` claim against `GOOGLE_CLIENT_ID` — prevents tokens issued for other apps from authenticating
- **Fix:** Evaluation fetch in candidate detail now filters by `org_id` — prevents theoretical cross-tenant data leak
- **Fix:** CV filename sanitized before use in `Content-Disposition` header — prevents header injection

### Changed
- Pipeline cards: dates now show human-readable format (`Today`, `Yesterday`, `3d ago`, `Jun 4`) instead of raw ISO timestamp
- Pipeline cards: AI screening badge no longer truncates; name overflows with ellipsis
- Test names in `test_ai_engine` and `test_performance_reviews` converted to snake_case

---

## [1.8.0] — 2026-05

### Added
- Async video interview portal: one-time invite link, timed video answers per question, chunked upload

## [1.7.0] — 2026-05

### Added
- PostgreSQL row-level security (RLS) as defence-in-depth below application `org_id` filters

## [1.6.0] — 2026-05

### Added
- 2FA OTP flow for candidate-facing public applications (6-digit code, 10-min TTL, SHA-256)

## [1.5.0] — 2026-05

### Added
- AI-drafted rejection emails: personalised gap analysis, editable before send

## [1.4.0] — 2026-05

### Added
- Org branding / white-labelling: custom colours, logo, fonts per org for public portal

## [1.3.0] — 2026-05

### Added
- Inbox notifications: backend model + real events (new applicant, analysis done, invite accepted)

## [1.2.0] — 2026-05

### Added
- Employee performance reviews: structured review cycles (self-eval + manager feedback + KPIs + AI improve)

## [1.1.0] — 2026-05

### Added
- AI engine exponential backoff (1 s → 2 s → 4 s) on provider errors
- Multi-provider fallback chain: primary → fallback providers tried in order until one succeeds
- `AIEngineFactory.from_session_with_fallbacks` builds fallback chain from all stored org keys

### Fixed
- `alembic.ini` path resolution in `database.py`

## [1.0.0] — 2026-04

### Added
- Google OAuth + JWT HS256 (48 h TTL) authentication
- Multi-tenant org isolation via `require_org` dependency; wizard tokens cannot reach data endpoints
- Org setup wizard + team invitations (7-day expiry, email delivery)
- CV upload and AI parsing — PDF (PyMuPDF) + DOCX
- AI candidate pre-analysis: skills, career score, career history, role fit per active JD
- Candidate pipeline — Kanban with configurable stages, drag-and-drop, status history
- Quick Add — paste text → AI extracts candidate fields
- Live Room — real-time interview transcription via Web Speech API
- Pre-interview AI briefing
- Interview scheduling (list + week calendar views)
- Per-candidate evaluation form (human skills + technical skills + recommendation)
- Job descriptions CRUD + AI improvement
- Roles with headcount tracking and AI description improve
- Employee directory CRUD
- Reports — hiring funnel analytics
- AI provider switching at runtime (OpenAI / Anthropic / Gemini / Groq)
- Encrypted API key storage (Fernet) — keys never stored in plaintext
- Pipeline stages editor (configurable labels, colors)
- i18n — EN / IT / DE
- Alembic migration system (auto-runs `upgrade head` at startup)
- HTTPS support via generated localhost certs (required for Web Speech API)
- 156 automated tests (pytest, in-memory SQLite, no external infrastructure)
