# Candid — Frontend

React 18 app served as static files. **No build step, no bundler, no npm.** All dependencies load from CDN; Babel Standalone compiles JSX in the browser.

---

## Running

```bash
../scripts/client.sh     # serves . on http://localhost:8080 (https if certs present)
# or any static file server:
python -m http.server 8080
```

Open `http://localhost:8080/index.html`.

### Backend URL

`index.html` sets `window.API_BASE`. By default it points at `localhost:8000`, using the page protocol (`http` or `https`). To use another backend, define `window.CANDID_API_BASE` in an inline script placed before the `API_BASE` script:

```html
<script>window.CANDID_API_BASE = "https://api.example.com";</script>
```

React and ReactDOM load as pinned production builds from unpkg, with SRI hashes.

---

## Script load order

`index.html` loads scripts in strict order — later files depend on earlier ones. **Version query strings (`?v=N`) bust the browser cache; bump when changing a file.**

| Order | File | Exports |
|-------|------|---------|
| 1 | `data.jsx` | `window.CANDID_DATA` — pipeline stages, skill lists, `SKILL_KEYS` i18n map |
| 2 | `translations.jsx` | `window.TRANSLATIONS` · `window.useT()` — EN / IT / DE |
| 3 | `ui.jsx` | `Icons`, `Btn`, `Badge`, `Avatar`, `Modal`, `Rating`, `Sidebar`, `Topbar`, `StatusBadge`, `RoleSelect`, `Tooltip`, `useApiData` |
| 4 | `screens/*.jsx` | one component per screen → `window.*Screen` |
| 5 | `app.jsx` | `<App>` — routing, auth, invitation links, fetch interceptor, public entry point |

---

## Key patterns

### i18n

```javascript
const t = window.useT();
t('candidate.name')   // returns translated string for current language
```

All user-visible strings must go through `useT()`. Add new keys to all three locales (EN / IT / DE) in `translations.jsx`. There is no interpolation helper: use placeholders such as `{n}` and `t('key').replace('{n}', value)`.

Public pages (portal, video interview, standalone 404) run outside the app. They use the last app locale saved in `localStorage`, or the browser language if none is saved.

**Skill i18n:** English name is the database key. `window.CANDID_DATA.SKILL_KEYS[englishName]` returns the i18n key used with `t()`.

### Fetch interceptor

`app.jsx` patches `window.fetch` at module parse time (IIFE, before React mounts) so auth headers are injected even in child components that fire effects before the App component mounts:

```javascript
window.fetch = async (url, opts = {}) => {
  // injects Authorization: Bearer <token> for API_BASE requests
  // dispatches candid:unauthorized on 401
};
window._authToken = loadUser()?.token || null;
```

Update `window._authToken` whenever the token changes — the interceptor reads it at call time.

### Global events

| Event | Direction | Meaning |
|-------|-----------|---------|
| `candid:unauthorized` | fetch → App | 401 received → auto-logout |
| `candid:stages` | Settings → Pipeline | pipeline stages changed |

Dispatch: `window.dispatchEvent(new CustomEvent("candid:stages", { detail: stages }))`.

### Sidebar counters

```javascript
window.refreshCounts()   // call from any screen after mutating data
```

### Pipeline stages

`window.CANDID_DATA.STATUS` is the stages array. It is overwritten from `GET /config/stages` at app startup. Use this array (not a hardcoded list) wherever stages appear.

### Organisation preferences

`window.CANDID_PREFS` (`date_format`, `currency`, `locations`) is loaded from `GET /config/preferences` after login and shared by the whole organisation. Read it with `window.getCurrency()` / `window.getLocations()`; change it with `window.savePreferences({ ...patch })`.

### Checks

`node tests/check.js` verifies that every script in `index.html` exists and that every translation key is defined in EN, IT and DE (run in CI).

---

## Screens

| Screen | File | Notes |
|--------|------|-------|
| Pipeline | `screens/pipeline.jsx` | Kanban drag-drop; listens to `candid:stages` |
| Candidates | `screens/candidates.jsx` | Table with filters, AI score, eval avg |
| Candidate detail | `screens/candidate.jsx` | Tabs: Overview · CV Analysis · Interviews · Video interview (invites + playback) · Evaluation · Activity · Emails |
| Jobs (Positions) | `screens/jobs.jsx` | JD list + view modal |
| Roles | `screens/roles.jsx` | Headcount bar + department groups |
| Employees | `screens/employees.jsx` | People directory |
| Interviews | `screens/interviews.jsx` | List + week calendar + schedule modal |
| Settings | `screens/settings.jsx` | AI providers · pipeline stages · email (SMTP) · branding · language · profile · locations · team · danger zone |
| Quick Add | `screens/quickadd.jsx` | Paste text or upload a CV → AI parse → candidate create |
| Live Room | `screens/liveroom.jsx` | Real-time interview with Web Speech API transcription (needs HTTPS) |
| Inbox | `screens/inbox.jsx` | Notifications and activity feed |
| Reports | `screens/reports.jsx` | Hiring funnel by pipeline stage, source mix, CSV export |
| Not found | `screens/notfound.jsx` | 404. Shown inside the app shell when logged in, standalone for unknown public links |

### Public (unauthenticated) pages

| Hash | File | Notes |
|------|------|-------|
| `#portal/{slug}` | `screens/portal.jsx` | Careers portal with org branding (colours, logo, font from the Settings list) |
| `#video/{token}` | `screens/videoportal.jsx` | Candidate-side async video interview |
| `#accept-invite?token=…` | `app.jsx` | Invitation link. The token is kept through login and accepted automatically, through the setup wizard for new users or by switching into the org for existing ones |

---

## Adding a new screen

1. Create `screens/mything.jsx` — define component, assign `window.MyThingScreen = MyThingScreen`.
2. Add `<script src="screens/mything.jsx?v=1" type="text/babel"></script>` to `index.html` after other screens.
3. Add the route to `VALID_ROUTES` and the render switch in `app.jsx`, and add a nav entry to `SIDE_NAV` in `ui.jsx` if it needs one.

---

## Styling

Single stylesheet: `styles.css`. CSS variables for colours/spacing defined on `:root`. No CSS-in-JS, no Tailwind. Inline `style` props used sparingly for dynamic values only.
