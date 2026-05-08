// Settings — AI providers, locale, team
const SettingsScreen = ({ user, onLocaleChange, onLogout }) => {
  const t = window.useT();
  const { locale, setLocale } = window.useContext(window.LocaleContext);
  const [tab, setTab] = useState("ai");

  const handleLocale = (l) => {
    setLocale(l);
    onLocaleChange && onLocaleChange(l);
  };

  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <h1 className="page-h1">{t('settings.title')}</h1>
      <div className="page-sub">{t('settings.subtitle')}</div>

      <div className="tabs">
        {[
          { id: "ai", label: t('settings.tab.ai') },
          { id: "locale", label: t('settings.tab.locale') },
          { id: "workspace", label: t('settings.tab.workspace') },
          { id: "team", label: t('settings.tab.team') },
          { id: "integrations", label: t('settings.tab.integrations') },
        ].map(tb => (
          <button key={tb.id} className={`tab ${tab === tb.id ? "active" : ""}`} onClick={() => setTab(tb.id)}>{tb.label}</button>
        ))}
      </div>

      {tab === "ai" && <AISettings t={t} />}
      {tab === "locale" && <LocaleSettings t={t} locale={locale} onChange={handleLocale} />}
      {tab === "workspace" && <ProfileSettings t={t} user={user} onLogout={onLogout} />}
      {tab === "team" && <TeamSettings t={t} />}
      {tab === "integrations" && <IntegrationsSettings t={t} />}
    </div>
  );
};

// ── AI Providers ─────────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: "openai",    name: "OpenAI",    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4.1"], keyPlaceholder: "sk-…" },
  { id: "anthropic", name: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-20241022"], keyPlaceholder: "sk-ant-…" },
  { id: "gemini",    name: "Gemini",    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"], keyPlaceholder: "AIza…" },
  { id: "groq",      name: "Groq",      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"], keyPlaceholder: "gsk_…" },
];

const AISettings = ({ t }) => {
  const [activeProvider, setActiveProvider] = useState("openai");
  const [activeModel, setActiveModel] = useState("gpt-4o");
  const [keys, setKeys] = useState({ openai: "", anthropic: "", gemini: "", groq: "" });
  const [showKeys, setShowKeys] = useState({});
  const [keyStatus, setKeyStatus] = useState({}); // {provider: "saving"|"saved"|"error"}
  const [testStatus, setTestStatus] = useState(""); // "testing"|"ok"|"error"
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    // Load active provider + model
    fetch(`${window.API_BASE}/config`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setActiveProvider(d.provider || "openai");
        setActiveModel(d.model_name || "gpt-4o");
      }).catch(() => {});

    // Load all keys (masked)
    fetch(`${window.API_BASE}/config/keys`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setKeys(prev => ({ ...prev, ...d })); })
      .catch(() => {});
  }, []);

  const saveActiveProvider = async () => {
    await fetch(`${window.API_BASE}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: activeProvider, model_name: activeModel }),
    }).catch(() => {});
  };

  const saveKey = async (provider) => {
    const key = keys[provider];
    if (!key || key.includes("*")) return;
    setKeyStatus(prev => ({ ...prev, [provider]: "saving" }));
    try {
      await fetch(`${window.API_BASE}/config/keys`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: key }),
      });
      setKeyStatus(prev => ({ ...prev, [provider]: "saved" }));
      setTimeout(() => setKeyStatus(prev => ({ ...prev, [provider]: "" })), 2000);
    } catch {
      setKeyStatus(prev => ({ ...prev, [provider]: "error" }));
    }
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setTestMsg("");
    // Save active provider/model first
    await saveActiveProvider();
    try {
      const res = await fetch(`${window.API_BASE}/config/test`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Test failed");
      }
      const d = await res.json();
      setTestStatus("ok");
      setTestMsg(`${d.provider} / ${d.model}`);
    } catch (err) {
      setTestStatus("error");
      setTestMsg(err.message);
    }
  };

  const curProvider = PROVIDERS.find(p => p.id === activeProvider) || PROVIDERS[0];

  return (
    <div className="col gap-16">
      {/* Provider + model selector */}
      <div className="card card-pad col gap-12">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="col">
            <span className="weight-600">AI Providers</span>
            <span className="text-12 text-secondary">{t('settings.ai.activeDesc')}</span>
          </div>
          <div className="row gap-8">
            {testStatus === "ok" && <Badge kind="positive"><span className="dot" />{testMsg}</Badge>}
            {testStatus === "error" && <Badge kind="warn">{testMsg}</Badge>}
            <Btn onClick={testConnection} disabled={testStatus === "testing"}>
              {testStatus === "testing" ? t('settings.ai.testing') : t('common.test')}
            </Btn>
          </div>
        </div>

        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => { setActiveProvider(p.id); setActiveModel(p.models[0]); saveActiveProvider(); }}
              className="col" style={{
                flex: "1 1 140px", padding: 14, border: `1px solid ${activeProvider === p.id ? "var(--ink)" : "var(--border)"}`,
                borderRadius: 8, background: activeProvider === p.id ? "var(--surface)" : "var(--bg-sunken)",
                boxShadow: activeProvider === p.id ? "var(--shadow-sm)" : "none", textAlign: "left", gap: 4, cursor: "pointer",
              }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="weight-600" style={{ fontSize: 13 }}>{p.name}</span>
                {activeProvider === p.id && <span style={{ width: 14, height: 14, borderRadius: 999, background: "var(--ink)", color: "white", display: "grid", placeItems: "center" }}><Icons.Check size={9} /></span>}
              </div>
              <span className="text-11 text-muted text-mono">{p.models[0]}</span>
            </button>
          ))}
        </div>

        <div>
          <div className="text-12 text-muted" style={{ marginBottom: 6 }}>{t('settings.ai.model')}</div>
          <div className="row gap-8" style={{ flexWrap: "wrap" }}>
            {curProvider.models.map(m => (
              <button key={m} onClick={() => { setActiveModel(m); saveActiveProvider(); }}
                className={`btn btn-sm ${activeModel === m ? "btn-primary" : "btn-secondary"}`}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      {/* API keys — one row per provider */}
      <div className="card card-pad col gap-12">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="col">
            <span className="weight-600">{t('settings.ai.keys')}</span>
            <span className="text-12 text-secondary">{t('settings.ai.keysDesc')}</span>
          </div>
          <Badge><Icons.Lock size={11} /> {t('settings.ai.encrypted')}</Badge>
        </div>
        {PROVIDERS.map(p => (
          <div key={p.id} className="row gap-10" style={{ alignItems: "center" }}>
            <span style={{ width: 80, fontSize: 12.5, fontWeight: 500, flexShrink: 0 }}>{p.name}</span>
            <div className="row" style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "0 10px", background: "var(--surface)", alignItems: "center" }}>
              <input
                className="input"
                type={showKeys[p.id] ? "text" : "password"}
                style={{ border: 0, background: "transparent", padding: "7px 8px", fontFamily: "var(--font-mono)", fontSize: 12 }}
                value={keys[p.id] || ""}
                onChange={e => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                placeholder={p.keyPlaceholder}
              />
              <button className="icon-btn" onClick={() => setShowKeys(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                {showKeys[p.id] ? <Icons.EyeOff size={13} /> : <Icons.Eye size={13} />}
              </button>
            </div>
            <Btn size="sm" kind="primary" onClick={() => saveKey(p.id)}
              disabled={keyStatus[p.id] === "saving" || !keys[p.id] || keys[p.id].includes("*")}>
              {keyStatus[p.id] === "saving" ? t('common.saving') : keyStatus[p.id] === "saved" ? t('settings.ai.saved') : t('common.save')}
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Locale ────────────────────────────────────────────────────────────────────

const LOCALES = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "it", label: "Italiano", flag: "🇮🇹" },
  { id: "de", label: "Deutsch", flag: "🇩🇪" },
];

const LocaleSettings = ({ t, locale, onChange }) => (
  <div className="col gap-16">
    <div className="card card-pad col gap-12">
      <div className="col">
        <span className="weight-600">{t('settings.locale.title')}</span>
        <span className="text-12 text-secondary">{t('settings.locale.subtitle')}</span>
      </div>
      <div className="row gap-10" style={{ flexWrap: "wrap" }}>
        {LOCALES.map(l => (
          <button key={l.id} onClick={() => onChange(l.id)} className="col" style={{
            padding: "14px 20px", border: `1px solid ${locale === l.id ? "var(--ink)" : "var(--border)"}`,
            borderRadius: 8, background: locale === l.id ? "var(--surface)" : "var(--bg-sunken)",
            boxShadow: locale === l.id ? "var(--shadow-sm)" : "none", cursor: "pointer",
            alignItems: "center", gap: 6, minWidth: 110,
          }}>
            <span style={{ fontSize: 28 }}>{l.flag}</span>
            <span className="weight-500" style={{ fontSize: 13 }}>{l.label}</span>
            {locale === l.id && <span style={{ width: 14, height: 14, borderRadius: 999, background: "var(--ink)", color: "white", display: "grid", placeItems: "center" }}><Icons.Check size={9} /></span>}
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ── Profile / Workspace ───────────────────────────────────────────────────────

const ProfileSettings = ({ t, user, onLogout }) => {
  const [role, setRole] = useState(() => localStorage.getItem("candid_role") || user?.role || "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem("candid_role", role);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="col gap-16">
      <div className="card card-pad col gap-12">
        <span className="weight-600">Profile</span>
        <div className="row gap-14" style={{ alignItems: "center" }}>
          <Avatar name={user?.name || "User"} src={user?.picture} size="xl" />
          <div className="col gap-4">
            <span className="weight-600" style={{ fontSize: 16 }}>{user?.name || "—"}</span>
            <span className="text-13 text-secondary">{user?.email || "—"}</span>
          </div>
        </div>
        <div>
          <label className="label">Your role / title</label>
          <input className="input" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Recruiting Manager" />
        </div>
        <div className="row gap-8">
          <Btn kind="primary" onClick={save}>{saved ? "Saved ✓" : t('common.save')}</Btn>
          <Btn onClick={onLogout}>Sign out</Btn>
        </div>
      </div>
    </div>
  );
};

// ── Team ──────────────────────────────────────────────────────────────────────

const TeamSettings = ({ t }) => {
  const team = [
    { name: "Sasha Rivera", email: "sasha@candid.app", role: "Hiring Manager", admin: true },
    { name: "Devon Park", email: "devon@candid.app", role: "Recruiter" },
    { name: "Avi Chen", email: "avi@candid.app", role: "Engineering Manager" },
    { name: "Mira Khan", email: "mira@candid.app", role: "Recruiter" },
  ];
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{t('settings.team.members')}</span>
        <Btn icon={<Icons.Plus size={14} />}>{t('settings.team.invite')}</Btn>
      </div>
      {team.map((m, i) => (
        <div key={i} className="row" style={{ padding: "12px 18px", borderBottom: i === team.length - 1 ? 0 : "1px solid var(--border-soft)", justifyContent: "space-between" }}>
          <div className="row gap-12">
            <Avatar name={m.name} />
            <div className="col"><span className="weight-500">{m.name}</span><span className="text-12 text-muted">{m.email}</span></div>
          </div>
          <div className="row gap-8">
            {m.admin && <Badge kind="info">Admin</Badge>}
            <Badge>{m.role}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Integrations ──────────────────────────────────────────────────────────────

const IntegrationsSettings = ({ t }) => (
  <div className="col gap-12">
    {[
      { name: "Google Calendar", desc: "Sync interviews to your team's calendars", on: true },
      { name: "Slack", desc: "Post pipeline updates to #hiring", on: true },
      { name: "Greenhouse", desc: "Two-way sync for candidates and stages", on: false },
      { name: "Zoom", desc: "Auto-create meeting links for live interviews", on: true },
    ].map((it, i) => (
      <div key={i} className="card card-pad row" style={{ justifyContent: "space-between" }}>
        <div className="col">
          <span className="weight-500">{it.name}</span>
          <span className="text-12 text-secondary">{it.desc}</span>
        </div>
        <Btn kind={it.on ? "secondary" : "primary"}>{it.on ? "Connected" : "Connect"}</Btn>
      </div>
    ))}
  </div>
);

window.SettingsScreen = SettingsScreen;
