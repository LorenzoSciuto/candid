// Settings — AI providers, locale, team
const SettingsScreen = ({ user, onLocaleChange, onLogout, onUserUpdate }) => {
  const t = window.useT();
  const { locale, setLocale } = window.useContext(window.LocaleContext || React.createContext({ locale: 'en', setLocale: () => {} }));
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
          { id: "ai",           label: t('settings.tab.ai') },
          { id: "pipeline",     label: "Pipeline" },
          { id: "locale",       label: t('settings.tab.locale') },
          { id: "profile",      label: t('settings.tab.profile') },
          { id: "locations",    label: t('settings.tab.locations') },
          { id: "team",         label: t('settings.tab.team') },
          { id: "integrations", label: t('settings.tab.integrations') },
        ].map(tb => (
          <button key={tb.id} className={`tab ${tab === tb.id ? "active" : ""}`} onClick={() => setTab(tb.id)}>{tb.label}</button>
        ))}
      </div>

      {tab === "ai"           && <AISettings t={t} />}
      {tab === "pipeline"     && <PipelineSettings t={t} />}
      {tab === "locale"       && <LocaleSettings t={t} locale={locale} onChange={handleLocale} />}
      {tab === "profile"      && <ProfileSettings t={t} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />}
      {tab === "locations"    && <LocationsSettings t={t} />}
      {tab === "team"         && <TeamSettings t={t} />}
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

  const parseApiError = (raw) => {
    if (!raw) return "Test failed";
    // Extract nested 'message' from OpenAI/Groq/Anthropic error strings
    // e.g. "Error code: 400 - {'error': {'message': '...', ...}}"
    try {
      const m = raw.match(/'message':\s*"([^"]+)"/);
      if (m) return m[1];
      const m2 = raw.match(/'message':\s*'([^']+)'/);
      if (m2) return m2[1];
    } catch {}
    return raw.length > 300 ? raw.slice(0, 300) + "…" : raw;
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setTestMsg("");
    await saveActiveProvider();
    try {
      const res = await fetch(`${window.API_BASE}/config/test`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(parseApiError(d.detail || "Test failed"));
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
            <Btn onClick={testConnection} disabled={testStatus === "testing"}>
              {testStatus === "testing" ? t('settings.ai.testing') : t('common.test')}
            </Btn>
          </div>
        </div>
        {testStatus === "error" && (
          <div className="row gap-10" style={{ background: "oklch(0.97 0.02 25)", border: "1px solid oklch(0.88 0.06 25)", borderRadius: 8, padding: "10px 14px", alignItems: "flex-start" }}>
            <Icons.X size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
            <div className="col gap-2">
              <span className="weight-500 text-13" style={{ color: "var(--danger)" }}>Connection failed — {activeProvider} / {activeModel}</span>
              <span className="text-12 text-mono" style={{ color: "oklch(0.45 0.08 25)", wordBreak: "break-word" }}>{testMsg}</span>
            </div>
          </div>
        )}

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

const DEFAULT_LOCATIONS = ["Remote", "SF / Remote", "SF", "NYC", "London", "Berlin", "Austin", "Toronto"];

const loadLocations = () => {
  try {
    const s = localStorage.getItem("candid_locations");
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_LOCATIONS;
};

const ProfileSettings = ({ t, user, onLogout, onUserUpdate }) => {
  const [role, setRole] = useState(() => localStorage.getItem("candid_role") || user?.role || "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem("candid_role", role);
    onUserUpdate && onUserUpdate({ ...user, role });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="col gap-16">
      <div className="card card-pad col gap-12">
        <span className="weight-600">{t('settings.tab.profile')}</span>
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
          <Btn onClick={onLogout}>{t('user.signOut')}</Btn>
        </div>
      </div>
    </div>
  );
};

// ── Locations ─────────────────────────────────────────────────────────────────

const LocationsSettings = ({ t }) => {
  const [currency, setCurrency] = useState(loadCurrency);
  const [locations, setLocations] = useState(loadLocations);
  const [newLoc, setNewLoc] = useState("");

  const saveCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("candid_currency", c);
    window.getCurrency = () => c;
  };

  const saveLocations = (locs) => {
    setLocations(locs);
    localStorage.setItem("candid_locations", JSON.stringify(locs));
  };

  const addLocation = () => {
    const v = newLoc.trim();
    if (!v || locations.includes(v)) return;
    saveLocations([...locations, v]);
    setNewLoc("");
  };

  const removeLocation = (loc) => saveLocations(locations.filter(l => l !== loc));

  return (
    <div className="col gap-16">
      <div className="card card-pad col gap-12">
        <div className="col">
          <span className="weight-600">{t('settings.currency.title')}</span>
          <span className="text-12 text-secondary">{t('settings.currency.subtitle')}</span>
        </div>
        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          {CURRENCIES.map(c => (
            <button key={c} onClick={() => saveCurrency(c)}
              className={`btn btn-sm ${currency === c ? "btn-primary" : "btn-secondary"}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="card card-pad col gap-12">
        <div className="col">
          <span className="weight-600">{t('settings.tab.locations')}</span>
          <span className="text-12 text-secondary">Available locations in job position forms.</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {locations.map(loc => (
            <span key={loc} className="row gap-6" style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>
              {loc}
              <button className="icon-btn" style={{ width: 16, height: 16 }} onClick={() => removeLocation(loc)}>
                <Icons.X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="row gap-8">
          <input
            className="input"
            style={{ flex: 1 }}
            value={newLoc}
            onChange={e => setNewLoc(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLocation(); } }}
            placeholder="Add location… (e.g. Paris, Singapore)"
          />
          <Btn onClick={addLocation} disabled={!newLoc.trim()}>{t('common.add')}</Btn>
        </div>
      </div>
    </div>
  );
};

// ── Pipeline Stages ───────────────────────────────────────────────────────────

const PipelineSettings = ({ t }) => {
  const [stages, setStages] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  useEffect(() => {
    fetch(`${window.API_BASE}/config/stages`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setStages(d); })
      .catch(() => {});
  }, []);

  const save = async (updatedStages) => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`${window.API_BASE}/config/stages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: updatedStages }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || "Failed to save");
      const data = await res.json();
      setStages(data.stages);
      window.CANDID_DATA.STATUS = data.stages;
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const addStage = () => {
    if (!newLabel.trim() || !stages) return;
    const id = newLabel.trim().toLowerCase().replace(/\s+/g, "_");
    const updated = [...stages, { id, label: newLabel.trim(), dot: newColor }];
    setStages(updated);
    setNewLabel("");
    setAdding(false);
    save(updated);
  };

  const removeStage = (id) => {
    const updated = stages.filter(s => s.id !== id);
    setStages(updated);
    save(updated);
  };

  const updateLabel = (id, label) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  };

  const updateColor = (id, dot) => {
    const updated = stages.map(s => s.id === id ? { ...s, dot } : s);
    setStages(updated);
    save(updated);
  };

  const move = (i, dir) => {
    const arr = [...stages];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setStages(arr);
    save(arr);
  };

  if (!stages) return <div className="text-13 text-muted" style={{ padding: "24px 0" }}>{t('common.loading')}</div>;

  return (
    <div className="col gap-16">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pipeline stages</span>
          <div className="row gap-8">
            {saved && <Badge kind="positive">Saved</Badge>}
            <Btn icon={<Icons.Plus size={14} />} onClick={() => setAdding(v => !v)}>Add stage</Btn>
          </div>
        </div>
        {stages.map((stage, i) => (
          <div key={stage.id} className="row" style={{ padding: "11px 18px", borderBottom: "1px solid var(--border-soft)", justifyContent: "space-between", gap: 12 }}>
            <div className="row gap-12" style={{ flex: 1 }}>
              <div className="row gap-6" style={{ flexShrink: 0 }}>
                <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1 }}>
                  <Icons.ChevronLeft size={13} />
                </button>
                <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === stages.length - 1} style={{ opacity: i === stages.length - 1 ? 0.3 : 1 }}>
                  <Icons.ChevronRight size={13} />
                </button>
              </div>
              <span className="kdot" style={{ background: stage.dot, flexShrink: 0 }} />
              <input className="input" value={stage.label} style={{ maxWidth: 200 }}
                onChange={e => updateLabel(stage.id, e.target.value)}
                onBlur={() => save(stages)} />
              <span className="text-12 text-muted">{stage.id}</span>
            </div>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <input type="color" value={stage.dot?.startsWith("#") ? stage.dot : "#6366f1"}
                onChange={e => updateColor(stage.id, e.target.value)}
                style={{ width: 28, height: 28, border: "1px solid var(--border)", borderRadius: 6, padding: 2, cursor: "pointer", background: "none" }} />
              <button className="icon-btn" style={{ color: "var(--danger)" }} onClick={() => removeStage(stage.id)}>
                <Icons.X size={13} />
              </button>
            </div>
          </div>
        ))}
        {adding && (
          <div className="col gap-10" style={{ padding: "14px 18px", borderTop: "1px solid var(--border-soft)" }}>
            <div className="row gap-12">
              <div style={{ flex: 1 }}>
                <label className="label">Label</label>
                <input className="input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Technical Screen" autoFocus onKeyDown={e => e.key === "Enter" && addStage()} />
              </div>
              <div>
                <label className="label">Color</label>
                <div style={{ marginTop: 6 }}>
                  <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                    style={{ width: 36, height: 32, border: "1px solid var(--border)", borderRadius: 6, padding: 2, cursor: "pointer", background: "none" }} />
                </div>
              </div>
            </div>
            {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
            <div className="row gap-8">
              <Btn kind="primary" onClick={addStage} disabled={!newLabel.trim() || saving}>Add</Btn>
              <Btn onClick={() => setAdding(false)}>Cancel</Btn>
            </div>
          </div>
        )}
      </div>
      <div className="text-12 text-muted">Stage IDs are generated from labels and used in candidate records. Removing a stage will hide candidates in that stage until reassigned.</div>
    </div>
  );
};

// ── Team ──────────────────────────────────────────────────────────────────────

// Currency helpers (exported for use in other screens)
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "DKK", "NOK"];
const loadCurrency = () => localStorage.getItem("candid_currency") || "EUR";
window.getCurrency = loadCurrency;

// getTeamMembers still exported for compatibility with jobs modal — returns cached org members
window.getTeamMembers = () => {
  try { const s = localStorage.getItem("candid_team_cache"); if (s) return JSON.parse(s); } catch {}
  return [];
};

const TeamSettings = ({ t }) => {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [adding, setAdding] = useState(false);

  const reload = () => {
    setLoading(true);
    fetch(`${window.API_BASE}/organizations/current`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setOrg(d);
        if (d?.members) {
          localStorage.setItem("candid_team_cache", JSON.stringify(
            d.members.map(m => ({ name: m.name, email: m.email, role: m.role }))
          ));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(reload, []);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg("");
    try {
      const res = await fetch(`${window.API_BASE}/organizations/current/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (res.ok) {
        setInviteMsg("Invitation sent.");
        setInviteEmail("");
        setAdding(false);
        reload();
      } else {
        const body = await res.json().catch(() => null);
        setInviteMsg(body?.detail || "Failed to send invitation.");
      }
    } catch {
      setInviteMsg("Network error.");
    }
    setInviting(false);
  };

  const removeMember = async (userId) => {
    await fetch(`${window.API_BASE}/organizations/current/members/${userId}`, { method: "DELETE" }).catch(() => {});
    reload();
  };

  const members = org?.members || [];
  const pending = org?.pending_invitations || [];

  return (
    <div className="col gap-16">
      <div className="card">
        <div className="card-header">
          <span className="card-title">{org ? org.name : t('settings.team.members')}</span>
          <Btn icon={<Icons.Plus size={14} />} onClick={() => setAdding(v => !v)}>{t('settings.team.invite')}</Btn>
        </div>
        {loading && <div className="text-13 text-muted" style={{ padding: "20px 18px" }}>{t('common.loading')}</div>}
        {!loading && members.map((member) => (
          <div key={member.user_id} className="row" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-soft)", justifyContent: "space-between" }}>
            <div className="row gap-12">
              <Avatar name={member.name} src={member.picture} />
              <div className="col">
                <span className="weight-500">{member.name}</span>
                <span className="text-12 text-muted">{member.email || "—"}</span>
              </div>
            </div>
            <div className="row gap-8">
              <select className="select" style={{ fontSize: 12, padding: "3px 8px", height: "auto" }}
                value={member.role}
                onChange={async e => {
                  const role = e.target.value;
                  await fetch(`${window.API_BASE}/organizations/current/members/${member.user_id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role }),
                  }).catch(() => {});
                  reload();
                }}>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              <button className="icon-btn" onClick={() => removeMember(member.user_id)} title="Remove">
                <Icons.X size={13} />
              </button>
            </div>
          </div>
        ))}
        {!loading && pending.length > 0 && (
          <>
            <div className="text-11 text-muted" style={{ padding: "10px 18px 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Pending invitations</div>
            {pending.map((invitation) => (
              <div key={invitation.id} className="row" style={{ padding: "10px 18px", borderBottom: "1px solid var(--border-soft)", justifyContent: "space-between", opacity: 0.7 }}>
                <div className="row gap-12">
                  <Avatar name={invitation.email} />
                  <span className="text-13">{invitation.email}</span>
                </div>
                <Badge>Pending</Badge>
              </div>
            ))}
          </>
        )}
        {adding && (
          <div className="col gap-10" style={{ padding: "14px 18px", borderTop: "1px solid var(--border-soft)" }}>
            <div>
              <label className="label">{t('employees.form.email')}</label>
              <input className="input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" autoFocus
                onKeyDown={e => e.key === "Enter" && sendInvite()} />
            </div>
            {inviteMsg && <span className="text-12" style={{ color: inviteMsg.includes("sent") ? "var(--positive)" : "var(--danger)" }}>{inviteMsg}</span>}
            <div className="row gap-8">
              <Btn kind="primary" onClick={sendInvite} disabled={!inviteEmail.trim() || inviting}>
                {inviting ? "Sending…" : t('settings.team.invite')}
              </Btn>
              <Btn onClick={() => { setAdding(false); setInviteMsg(""); }}>{t('common.cancel')}</Btn>
            </div>
          </div>
        )}
      </div>
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
