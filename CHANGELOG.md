# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/). From 1.0.0 onwards, every release on
GitHub also carries notes generated from the Conventional Commits it contains.

## [Unreleased]

### Fixed
- The Anthropic fallback model pointed to a retired model; it now uses `claude-haiku-5-5`.
- Removed retired models (Claude 3.5 Sonnet, Gemini 1.5) from the model pickers.

### Changed
- One AI provider catalog (`CANDID_DATA.AI_PROVIDERS`) shared by the setup wizard and Settings.
- Removed 46 unused translation keys.

### Documentation
- Catchier README with project status, a roadmap (`docs/ROADMAP.md`), code of conduct, issue and PR templates.

## [1.0.0] — first public release

### Features
- CV upload (PDF/DOCX) with AI analysis: summary, strengths, gaps, interview questions and fit against open positions.
- Hiring pipeline with per-organisation stages, status history and activity log.
- Live interview room with in-browser speech-to-text; Whisper transcription of uploaded recordings.
- Asynchronous video interviews: candidate recording portal plus recruiter invites and playback.
- Evaluation scorecards, AI-drafted rejection emails and an SMTP mailbox per candidate.
- Job descriptions, roles with headcount, employee directory and performance reviews.
- Public, branded job portal with CV applications.
- Organisations with owner/admin/member roles, email invitations and a notification inbox.
- OpenAI, Anthropic, Gemini and Groq support with per-organisation keys and automatic fallback.
- Funnel report with CSV export; organisation-wide date format, currency and locations.
- Full UI in English, Italian and German; themed 404 page.

### Security
- Two-layer tenant isolation: application checks on every client-supplied id plus PostgreSQL Row-Level
  Security enforced through an unprivileged role, verified against PostgreSQL in CI.
- Membership and admin role re-checked on every request; no default session secret.
- Upload size caps, extension allowlists and server-generated file names; rate-limited public endpoints.
- Verified SMTP TLS, HTML-escaped emails, secrets encrypted at rest, provider errors never echoed to clients.

### Upgrade notes
- The migration history was squashed into one baseline. Databases created by pre-release checkouts
  must be recreated (`./scripts/reset-db.sh`).
- The migrating database user needs `CREATEROLE`, or the `candid_app` role must exist and be granted
  to it (see README → Deployment notes).

### Engineering
- Layered backend (`commons` / `services` / `routers`) with import rules enforced by tests.
- Single baseline Alembic migration checked against the models in CI.
- CI with ruff (including security rules), pytest with coverage, frontend syntax and i18n checks;
  automatic semantic-version releases from Conventional Commits.
