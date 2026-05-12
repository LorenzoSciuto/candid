// Candid — app shell + routing + auth + locale
const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "streaming": true,
  "showCounts": true
}/*EDITMODE-END*/;

// Fallback: translations.jsx may not have run yet if Babel loads scripts async
const LocaleContext = window.LocaleContext || React.createContext({ locale: 'en', setLocale: () => {} });

// ── Compose Modal ─────────────────────────────────────────────────────────────

const ComposeModal = ({ onClose }) => {
  const t = window.useT ? window.useT() : k => k;
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState("");

  const rewriteWithAI = async () => {
    if (!body.trim()) return;
    setRewriting(true);
    setRewriteError("");
    try {
      const res = await fetch(`${window.API_BASE}/ai/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rewrite_email",
          text: body,
          to,
          subject,
        }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setBody(d.result);
    } catch { setRewriteError("AI unavailable — check provider settings."); }
    setRewriting(false);
  };

  const send = () => {
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto);
    onClose();
  };

  return (
    <Modal open title={t('compose.title')} onClose={onClose} width={520}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" icon={<Icons.Mail size={14} />} onClick={send} disabled={!to.trim()}>
            {t('compose.send')}
          </Btn>
        </>
      }>
      <div className="col gap-12">
        <div>
          <label className="label">{t('compose.to')}</label>
          <input className="input" type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="candidate@example.com" autoFocus />
        </div>
        <div>
          <label className="label">{t('compose.subject')}</label>
          <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Re: Senior Engineer role" />
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ margin: 0 }}>{t('compose.body')}</label>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              {rewriteError && <span className="text-12" style={{ color: "var(--danger)" }}>{rewriteError}</span>}
              <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 12 }}
                onClick={rewriteWithAI} disabled={rewriting || !body.trim()}>
                {rewriting
                  ? <span className="badge ai" style={{ padding: "1px 6px", fontSize: 10 }}><span className="dot" /> {t('compose.rewriting')}</span>
                  : t('compose.rewrite')}
              </button>
            </div>
          </div>
          <textarea className="textarea" rows={9} value={body} onChange={e => setBody(e.target.value)} placeholder="Hi there,&#10;&#10;" />
        </div>
      </div>
    </Modal>
  );
};

// ── Hiring Plan Modal ─────────────────────────────────────────────────────────

const HiringPlanModal = ({ onClose, onNavigate }) => {
  const t = window.useT ? window.useT() : k => k;
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setJds(Array.isArray(d) ? d.filter(j => j.status === "Active" || j.status === "Draft") : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusColor = (s) => s === "Active" ? "positive" : s === "Draft" ? undefined : "warn";

  return (
    <Modal open title={t('plan.title')} onClose={onClose} width={680}
      footer={<Btn onClick={onClose}>{t('common.close')}</Btn>}>
      <div className="col gap-0">
        <div className="text-12 text-muted" style={{ marginBottom: 14 }}>{t('plan.sub')}</div>
        {loading && <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>{t('common.loading')}</div>}
        {!loading && jds.length === 0 && (
          <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>
            {t('plan.empty')}
            <button className="link text-13" style={{ marginLeft: 8 }} onClick={() => { onClose(); onNavigate("jobs"); }}>Go to Positions →</button>
          </div>
        )}
        {jds.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-sunken)", borderBottom: "1px solid var(--border)" }}>
                {[t('plan.col.position'), t('plan.col.openings'), t('plan.col.status'), t('plan.col.owner')].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontSize: 11.5, fontWeight: 500, color: "var(--ink-secondary)", letterSpacing: "0.02em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jds.map(j => (
                <tr key={j.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "11px 14px" }}>
                    <div className="col">
                      <span className="weight-500">{j.title}</span>
                      <span className="text-12 text-muted">{j.location || "—"}</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span className="text-mono weight-600">{j.openings || 1}</span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <Badge kind={statusColor(j.status)}>{j.status}</Badge>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    {j.owner
                      ? <div className="row gap-6"><Avatar name={j.owner} /><span className="text-13">{j.owner}</span></div>
                      : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
};

// ── Auth helpers ─────────────────────────────────────────────────────────────

const SESSION_KEY = "candid_user";

const loadUser = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
};

const saveUser = (u) => localStorage.setItem(SESSION_KEY, JSON.stringify(u));
const clearUser = () => localStorage.removeItem(SESSION_KEY);

// Decode Google JWT payload (no verification — display only)
const decodeJwt = (token) => {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }
};

// ── Login Screen ─────────────────────────────────────────────────────────────

const LoginScreen = ({ onLogin }) => {
  const t = window.useT ? window.useT() : (k) => k;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasClientId = !!window.GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!hasClientId || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: window.GOOGLE_CLIENT_ID,
      callback: handleCredential,
    });
    window.google.accounts.id.renderButton(
      document.getElementById("g-signin-btn"),
      { theme: "outline", size: "large", width: 320, text: "signin_with" }
    );
  }, [hasClientId]);

  const handleCredential = async (response) => {
    setLoading(true);
    setError("");
    try {
      // Decode JWT for immediate UX (name/picture)
      const claims = decodeJwt(response.credential);
      // Verify with backend
      const res = await fetch(`${window.API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: response.credential }),
      });
      const user = res.ok ? await res.json() : {
        id: claims?.sub, name: claims?.name, email: claims?.email, picture: claims?.picture,
      };
      const profile = { ...user, role: localStorage.getItem("candid_role") || "" };
      saveUser(profile);
      onLogin(profile);
    } catch {
      setError("Sign-in failed. Is the backend running?");
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    try {
      const res = await fetch(`${window.API_BASE}/auth/demo`, { method: "POST" });
      if (res.ok) {
        const u = await res.json();
        saveUser({ ...u, role: "Recruiter" });
        onLogin({ ...u, role: "Recruiter" });
        return;
      }
    } catch {}
    // Fallback when backend is down — no token, read-only demo
    const u = { id: "demo", name: "Demo User", email: "demo@candid.app", picture: null, role: "Recruiter" };
    saveUser(u);
    onLogin(u);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", fontFamily: "var(--font-sans)",
    }}>
      <div className="card col" style={{ width: 400, padding: 40, alignItems: "center", gap: 24 }}>
        {/* Brand */}
        <div className="col" style={{ alignItems: "center", gap: 8 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, background: "var(--ink)",
            display: "grid", placeItems: "center", color: "white",
            fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em",
          }}>C</div>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{t('login.title')}</span>
          <span className="text-13 text-secondary" style={{ textAlign: "center" }}>{t('login.subtitle')}</span>
        </div>

        <div style={{ width: "100%", height: 1, background: "var(--border)" }} />

        {/* Google button or demo */}
        {hasClientId ? (
          <div id="g-signin-btn" style={{ minHeight: 44 }} />
        ) : (
          <div className="col" style={{ alignItems: "center", gap: 10, width: "100%" }}>
            <button
              onClick={demoLogin}
              style={{
                width: "100%", padding: "12px 20px", borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--surface)",
                fontSize: 14, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
                <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                <path fill="#FBBC05" d="M11.68 28.18A13.9 13.9 0 0 1 10.8 24c0-1.45.25-2.85.68-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.86.92 7.51 2.54 10.74l7.14-5.52-.02.96z" />
                <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7C13.42 14.62 18.27 10.75 24 10.75z"/>
              </svg>
              {t('login.google')}
            </button>
            <span className="text-12 text-muted">{t('login.demoNote')} — <button className="link text-12" onClick={demoLogin}>{t('login.demo')}</button></span>
          </div>
        )}

        {loading && <span className="text-13 text-muted">{t('login.signingIn')}</span>}
        {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
    </div>
  );
};

// ── Route helpers ─────────────────────────────────────────────────────────────

const VALID_ROUTES = [
  "pipeline", "candidates", "jobs", "roles", "employees", "interviews",
  "inbox", "reports", "preinterview", "liveroom", "candidate", "settings",
];

const routeFromHash = () => {
  const h = window.location.hash.replace("#", "");
  return VALID_ROUTES.includes(h) ? h : "pipeline";
};

// ── App ───────────────────────────────────────────────────────────────────────

const App = () => {
  const [user, setUser] = useState(loadUser);
  const [locale, setLocale] = useState(() => localStorage.getItem("candid_locale") || "en");
  const [route, setRoute] = useState(routeFromHash);
  const [candidateId, setCandidateId] = useState("c-001");
  const [quickOpen, setQuickOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [liveInterview, setLiveInterview] = useState(null);
  const [t_tweaks, setTweak] = window.useTweaks(TWEAKS_DEFAULTS);
  const [liveCounts, setLiveCounts] = useState({});

  // Persist locale
  useEffect(() => { localStorage.setItem("candid_locale", locale); }, [locale]);

  // Stable ref to logout so fetch wrapper never captures stale closure
  const logoutRef = useRef(null);
  logoutRef.current = () => { clearUser(); setUser(null); };

  // Inject Authorization header + auto-logout on 401
  useEffect(() => {
    const token = user?.token;
    if (!token) return;
    const original = window._baseFetch || window.fetch;
    window._baseFetch = original;
    window.fetch = async (url, opts = {}) => {
      if (typeof url === "string" && url.startsWith(window.API_BASE)) {
        opts = { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } };
      }
      const res = await original(url, opts);
      if (res.status === 401) {
        logoutRef.current?.();
      }
      return res;
    };
    return () => {
      if (window._baseFetch) window.fetch = window._baseFetch;
    };
  }, [user?.token]);

  // Real sidebar counts
  useEffect(() => {
    if (!user) return;
    const refresh = () => Promise.all([
      fetch(`${window.API_BASE}/candidates/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${window.API_BASE}/job-descriptions`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${window.API_BASE}/roles`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${window.API_BASE}/employees`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${window.API_BASE}/interviews`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([stats, jds, roles, emps, ivs]) => {
      setLiveCounts({
        candidates: stats?.total ?? null,
        pipeline: stats?.total ?? null,
        jobs: jds ? jds.length : null,
        roles: roles ? roles.length : null,
        employees: emps ? emps.length : null,
        interviews: ivs ? ivs.length : null,
      });
    });
    window.refreshCounts = refresh;
    refresh();
    return () => { delete window.refreshCounts; };
  }, [user]);

  // Browser history
  useEffect(() => {
    const onPop = () => setRoute(routeFromHash());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (r, data) => {
    window.history.pushState(null, "", `#${r}`);
    setRoute(r);
    if (r === "liveroom" && data) setLiveInterview(data);
  };

  // ⌘K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setQuickOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Force re-login if existing session has no token (pre-auth sessions)
  useEffect(() => {
    if (user && !user.token) { clearUser(); setUser(null); }
  }, []);

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => { clearUser(); setUser(null); window.location.hash = ""; };

  if (!user) {
    return (
      <LocaleContext.Provider value={{ locale, setLocale }}>
        <LoginScreen onLogin={handleLogin} />
      </LocaleContext.Provider>
    );
  }

  const counts = t_tweaks.showCounts ? { inbox: 6, ...liveCounts } : {};

  const openCandidate = (id) => { setCandidateId(id); navigate("candidate"); };

  const crumbs = (() => {
    switch (route) {
      case "pipeline":     return ["Workspace", "Pipeline"];
      case "candidates":   return ["Workspace", "Candidates"];
      case "jobs":         return ["Workspace", "Positions"];
      case "roles":        return ["Workspace", "Roles"];
      case "employees":    return ["Workspace", "People"];
      case "interviews":   return ["Workspace", "Interviews"];
      case "inbox":        return ["Workspace", "Inbox"];
      case "reports":      return ["Workspace", "Reports"];
      case "preinterview": return ["AI Co-pilot", "Pre-Interview Analysis"];
      case "liveroom":     return ["AI Co-pilot", "Live Room"];
      case "candidate":
        return ["Candidates", "—"];
      case "settings":     return ["Settings"];
      default:             return ["Candid"];
    }
  })();

  const t_app = window.useT ? window.useT() : k => k;
  const topActions = (
    <>
      <Btn onClick={() => setQuickOpen(true)} icon={<Icons.ClipPaste size={14} />}>{t_app('topbar.quickAdd')}</Btn>
      <Btn icon={<Icons.Mail size={14} />} onClick={() => setComposeOpen(true)} title={t_app('compose.title')} />
      <Btn icon={<Icons.Calendar size={14} />} onClick={() => setPlanOpen(true)} title={t_app('topbar.plan')}>{t_app('topbar.plan')}</Btn>
      <Btn icon={<Icons.Settings size={14} />} onClick={() => navigate("settings")} title={t_app('nav.settings')} />
    </>
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <div className="app">
        <Sidebar
          route={route === "candidate" ? "candidates" : route}
          onRoute={navigate}
          counts={counts}
          onQuickAdd={() => setQuickOpen(true)}
          user={user}
          onLogout={handleLogout}
        />
        <div className="main">
          <Topbar crumbs={crumbs} actions={topActions} />
          <div className="scroll">
            {route === "pipeline"     && <window.PipelineScreen onOpenCandidate={openCandidate} onQuickAdd={() => setQuickOpen(true)} />}
            {route === "candidates"   && <window.CandidatesScreen onOpenCandidate={openCandidate} />}
            {route === "jobs"         && <window.JobsScreen onRoute={navigate} />}
            {route === "roles"        && <window.RolesScreen onRoute={navigate} />}
            {route === "employees"    && <window.EmployeesScreen />}
            {route === "interviews"   && <window.InterviewsScreen onRoute={navigate} />}
            {route === "inbox"        && <window.InboxScreen onRoute={navigate} />}
            {route === "reports"      && <window.ReportsScreen />}
            {route === "preinterview" && <window.PreInterviewScreen tweaks={t_tweaks} onCreatedCandidate={openCandidate} />}
            {route === "liveroom"     && <window.LiveRoomScreen tweaks={t_tweaks} interview={liveInterview} />}
            {route === "candidate"    && <window.CandidateScreen id={candidateId} onRoute={navigate} />}
            {route === "settings"     && <window.SettingsScreen user={user} onLocaleChange={setLocale} onLogout={handleLogout} />}
          </div>
        </div>

        <window.QuickAdd open={quickOpen} onClose={() => setQuickOpen(false)} onCreate={(id) => openCandidate(id)} tweaks={t_tweaks} />
        {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
        {planOpen && <HiringPlanModal onClose={() => setPlanOpen(false)} onNavigate={navigate} />}

        <window.TweaksPanel>
          <window.TweakSection label="AI behavior">
            <window.TweakRadio label="AI output" value={t_tweaks.streaming ? "Streaming" : "Instant"}
              options={["Streaming", "Instant"]}
              onChange={(v) => setTweak("streaming", v === "Streaming")} />
          </window.TweakSection>
          <window.TweakSection label="Sidebar">
            <window.TweakToggle label="Show item counts" value={t_tweaks.showCounts} onChange={(v) => setTweak("showCounts", v)} />
          </window.TweakSection>
        </window.TweaksPanel>
      </div>
    </LocaleContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
