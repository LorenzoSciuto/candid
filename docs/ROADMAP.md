# Candid — Status & Roadmap

Where the project stands, what is missing, and what is likely to come next. Priorities are a guide, not a promise; issues and pull requests that move any item forward are welcome.

## What works today (1.x)

| Area | Status |
|---|---|
| CV intake: PDF/DOCX parsing, AI analysis, fit against open positions, Quick Add | ✅ Complete |
| Hiring pipeline with per-organisation stages, history and activity log | ✅ Complete |
| Live interview room (browser speech-to-text) and Whisper transcription of recordings | ✅ Complete |
| Async video interviews with candidate portal and recruiter playback | ✅ Complete |
| Evaluation scorecards, AI-drafted rejection emails, per-candidate mailbox (SMTP send) | ✅ Complete |
| Job descriptions, roles, employee directory, performance reviews | ✅ Complete |
| Branded public job portal with CV applications | ✅ Complete |
| Organisations, roles (owner/admin/member), invitations, notifications | ✅ Complete |
| OpenAI, Anthropic, Gemini, Groq with per-organisation keys and fallback | ✅ Complete |
| Funnel report with CSV export | ✅ Complete |
| UI in English, Italian and German | ✅ Complete |
| Two-layer tenant isolation (app checks + PostgreSQL RLS), tested in CI | ✅ Complete |

Quality bar: 360+ backend tests (unit, API, architecture rules, real-PostgreSQL RLS), ruff with security rules, migrations checked against models, i18n completeness check, automatic semantic releases.

## What is missing

### Deployment & operations — high priority
- **Container image and compose file.** Today the app runs from the dev scripts; a `Dockerfile` for the API, a static image for the frontend and a `docker-compose.yml` would make self-hosting a one-liner.
- **Shared rate limiter.** The limiter is in-memory per worker process; multi-worker deployments need Redis or similar.
- **Object storage for media.** Interview audio and video answers live on the local disk (`UPLOAD_DIR`); S3-compatible storage would allow stateless API instances.
- **Precompiled frontend.** JSX is compiled in the browser; a production build step would cut load time and allow a strict Content Security Policy.

### Privacy & compliance — high priority
- **Candidate consent** on the public portal (privacy notice acceptance, stored with the application).
- **Data retention**: automatic deletion or anonymisation of rejected candidates after a configurable period.
- **Data subject requests**: export and erase everything about a candidate in one action.
- **Audit log** of who viewed or changed candidate data.

### Product — medium priority
- **More sign-in options**: email magic link, Microsoft Entra ID / generic OIDC.
- **Calendar integration**: send `.ics` invites, sync with Google/Microsoft calendars.
- **Inbound email**: receive candidate replies (IMAP or webhook) next to the sent history.
- **Job board syndication**: publish open positions to external boards from the portal feed.
- **Bias-aware scoring**: hide name, photo and other protected attributes from the AI prompt and from reviewers on request.

### Engineering — medium priority
- **Frontend tests**: component or end-to-end tests (e.g. Playwright) for the main flows.
- **Session cookies**: move the session token from `localStorage` to an httpOnly cookie with CSRF protection.
- **Model catalog from the providers**: list available models through each provider's API instead of a static list (`frontend/data.jsx`).

## Out of scope

Payroll, onboarding after the hire and full HRIS features. Candid stops when an offer is accepted.
