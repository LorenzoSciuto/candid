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

`window.API_BASE` is set dynamically in `index.html` — it matches the page protocol (`http` or `https`) and points at `localhost:8000`.

---

## Script load order

`index.html` loads scripts in strict order — later files depend on earlier ones. **Version query strings (`?v=N`) bust the browser cache; bump when changing a file.**

| Order | File | Exports |
|-------|------|---------|
| 1 | `data.jsx` | `window.CANDID_DATA` — pipeline stages, skill lists, `SKILL_KEYS` i18n map |
| 2 | `translations.jsx` | `window.TRANSLATIONS` · `window.useT()` — EN / IT / DE |
| 3 | `ui.jsx` | `Icons`, `Btn`, `Badge`, `Avatar`, `Modal`, `Rating`, `Sidebar`, `Topbar`, `StatusBadge`, `Tooltip`, `useApiData` |
| 4 | `tweaks-panel.jsx` | `window.useTweaks` — runtime design knobs |
| 5 | `screens/*.jsx` | one component per screen → `window.*Screen` |
| 6 | `app.jsx` | `<App>` — routing, auth, fetch interceptor |

---

## Key patterns

### i18n

```javascript
const t = window.useT();
t('candidate.name')   // returns translated string for current language
```

All user-visible strings must go through `useT()`. Add new keys to all three locales (EN / IT / DE) in `translations.jsx`.

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

---

## Screens

| Screen | File | Notes |
|--------|------|-------|
| Pipeline | `screens/pipeline.jsx` | Kanban drag-drop; listens to `candid:stages` |
| Candidates | `screens/candidates.jsx` | Table with filters, AI score, eval avg |
| Candidate detail | `screens/candidate.jsx` | Tabs: Overview · CV Analysis · Interviews · Evaluation · Activity |
| Jobs (Positions) | `screens/jobs.jsx` | JD list + view modal |
| Roles | `screens/roles.jsx` | Headcount bar + department groups |
| Employees | `screens/employees.jsx` | People directory |
| Interviews | `screens/interviews.jsx` | List + week calendar + schedule modal |
| Settings | `screens/settings.jsx` | AI config · team · pipeline stages · danger zone |
| Quick Add | `screens/quickadd.jsx` | Paste text → AI parse → candidate create |
| Live Room | `screens/liveroom.jsx` | Real-time interview with Web Speech API transcription |
| Pre-interview | `screens/preinterview.jsx` | AI-generated briefing before a scheduled interview |
| Inbox | `screens/inbox.jsx` | Notifications and activity feed |
| Reports | `screens/reports.jsx` | Hiring analytics and pipeline reports |

---

## Adding a new screen

1. Create `screens/mything.jsx` — define component, assign `window.MyThingScreen = MyThingScreen`.
2. Add `<script src="screens/mything.jsx?v=1" type="text/babel"></script>` to `index.html` after other screens.
3. Add a nav entry in `app.jsx` Sidebar and a route case in the `App` render switch.

---

## Styling

Single stylesheet: `styles.css`. CSS variables for colours/spacing defined on `:root`. No CSS-in-JS, no Tailwind. Inline `style` props used sparingly for dynamic values only.
