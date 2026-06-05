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
          { id: "email",        label: "Email" },
          { id: "branding",     label: "Branding" },
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
      {tab === "email"        && <EmailSettings t={t} />}
      {tab === "branding"     && <BrandingSettings t={t} />}
      {tab === "locale"       && <LocaleSettings t={t} locale={locale} onChange={handleLocale} />}
      {tab === "profile"      && <ProfileSettings t={t} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />}
      {tab === "locations"    && <LocationsSettings t={t} />}
      {tab === "team"         && <TeamSettings t={t} user={user} onLogout={onLogout} />}
      {tab === "integrations" && <IntegrationsSettings t={t} />}
    </div>
  );
};

// ── Branding ──────────────────────────────────────────────────────────────────

const PORTAL_FONTS = [
  { value: "Inter",             label: "Inter" },
  { value: "Geist, sans-serif", label: "Geist" },
  { value: "Roboto, sans-serif",          label: "Roboto" },
  { value: "'Open Sans', sans-serif",     label: "Open Sans" },
  { value: "Lato, sans-serif",            label: "Lato" },
  { value: "Poppins, sans-serif",         label: "Poppins" },
  { value: "Montserrat, sans-serif",      label: "Montserrat" },
  { value: "'DM Sans', sans-serif",       label: "DM Sans" },
  { value: "'Plus Jakarta Sans', sans-serif", label: "Plus Jakarta Sans" },
  { value: "Nunito, sans-serif",          label: "Nunito" },
  { value: "'Playfair Display', serif",   label: "Playfair Display" },
  { value: "'Merriweather', serif",       label: "Merriweather" },
  { value: "Georgia, serif",              label: "Georgia" },
];

const BrandingSettings = ({ t }) => {
  const [primaryColor, setPrimaryColor] = useState("#4F46E5");
  const [backgroundColor, setBackgroundColor] = useState("#F3F4F6");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${window.API_BASE}/organizations/current/branding`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.primary_color)    setPrimaryColor(data.primary_color);
        if (data.background_color) setBackgroundColor(data.background_color);
        if (data.font_family)      setFontFamily(data.font_family);
        if (data.logo_url)         setLogoUrl(data.logo_url || "");
      })
      .catch(() => {});
  }, []);

  const handleLogoFile = (file) => {
    if (!file) return;
    if (file.size > 512 * 1024) { setError("Logo must be under 512 KB."); return; }
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => { setLogoUrl(e.target.result); setLogoUploading(false); };
    reader.onerror = () => { setError("Failed to read file."); setLogoUploading(false); };
    reader.readAsDataURL(file);
  };

  const saveBranding = async () => {
    setSaving(true); setSaved(false); setError("");
    try {
      const res = await fetch(`${window.API_BASE}/organizations/current/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_color: primaryColor, background_color: backgroundColor, font_family: fontFamily, logo_url: logoUrl || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  return (
    <div className="col gap-16">
      <div className="card card-pad col gap-16">
        <div className="col">
          <span className="weight-600">{t('branding.title')}</span>
          <span className="text-12 text-secondary">{t('branding.sub')}</span>
        </div>

        {/* Colors */}
        <div className="row gap-16" style={{ flexWrap: "wrap" }}>
          <div className="col gap-6" style={{ flex: "1 1 180px" }}>
            <label className="label">{t('branding.primaryColor')}</label>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                style={{ width: 36, height: 32, border: "1px solid var(--border)", borderRadius: 6, padding: 2, cursor: "pointer", background: "none" }} />
              <input className="input" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: 12, flex: 1 }} placeholder="#4F46E5" />
            </div>
          </div>
          <div className="col gap-6" style={{ flex: "1 1 180px" }}>
            <label className="label">{t('branding.bgColor')}</label>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)}
                style={{ width: 36, height: 32, border: "1px solid var(--border)", borderRadius: 6, padding: 2, cursor: "pointer", background: "none" }} />
              <input className="input" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: 12, flex: 1 }} placeholder="#F3F4F6" />
            </div>
          </div>
        </div>

        {/* Font select */}
        <div className="col gap-6" style={{ maxWidth: 320 }}>
          <label className="label">{t('branding.font')}</label>
          <select className="select" value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
            {PORTAL_FONTS.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Logo upload */}
        <div className="col gap-6">
          <label className="label">{t('branding.logo')}</label>
          <div className="row gap-10" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            {logoUrl && (
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src={logoUrl} alt="Logo" style={{ maxHeight: 52, maxWidth: 160, borderRadius: 8, border: "1px solid var(--border)", padding: 6, background: "#fff", display: "block" }}
                  onError={e => { e.target.style.display = "none"; }} />
                <button onClick={() => setLogoUrl("")}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--danger)", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
              </div>
            )}
            <div className="col gap-6" style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, border: "1.5px dashed var(--border)", cursor: "pointer", fontSize: 13, color: "var(--ink-secondary)", background: "var(--bg-sunken)", width: "fit-content" }}>
                <Icons.Upload size={14} />
                {logoUploading ? "Reading…" : t('branding.upload')}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleLogoFile(e.target.files?.[0])} />
              </label>
              <span className="text-11 text-muted">{t('branding.uploadHint')}</span>
            </div>
          </div>
        </div>

        {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
        <div className="row gap-8">
          <Btn kind="primary" onClick={saveBranding} disabled={saving || logoUploading}>
            {saving ? "Saving…" : saved ? t('branding.saved') : t('branding.save')}
          </Btn>
        </div>
      </div>

      {/* Live preview */}
      <div className="card card-pad col gap-10">
        <span className="weight-600 text-13">{t('branding.preview')}</span>
        <div style={{ background: backgroundColor, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
          <div style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`, padding: "24px 20px", textAlign: "center" }}>
            {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: 36, maxWidth: 120, marginBottom: 10, display: "block", margin: "0 auto 10px", objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />}
            <div style={{ fontWeight: 800, fontSize: 20, color: "#fff", fontFamily: fontFamily, letterSpacing: "-.02em" }}>Your Organization</div>
            <div style={{ fontSize: 13, color: "#fff", opacity: .75, marginTop: 4, fontFamily: fontFamily }}>{t('branding.previewSub')}</div>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", border: "1.5px solid #e5e7eb", fontFamily: fontFamily }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>Senior Engineer</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>📍 Milano · Remote</div>
              <button style={{ background: primaryColor, color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "default", fontFamily: fontFamily }}>Apply →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── AI Providers ─────────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: "openai",    name: "OpenAI",    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4.1"], keyPlaceholder: "sk-…" },
  { id: "anthropic", name: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-20241022"], keyPlaceholder: "sk-ant-…" },
  { id: "gemini",    name: "Gemini",    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"], keyPlaceholder: "AIza…" },
  { id: "groq",      name: "Groq",      models: ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.1-8b-instant", "qwen/qwen3-32b"], keyPlaceholder: "gsk_…" },
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

const DEFAULT_LOCATIONS = ["Milano", "Remote", "Milano / Remote", "Roma", "Torino", "Bergamo", "Brescia", "Monza"];

const loadLocations = () => {
  try {
    const s = localStorage.getItem("candid_locations");
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_LOCATIONS;
};

const ProfileSettings = ({ t, user, onLogout, onUserUpdate }) => {
  const [title, setTitle] = useState(user?.title || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [picture, setPicture] = useState(user?.picture || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef(null);

  const resizeToBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = Math.min(img.width, img.height);
        const scale = 256 / size;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeToBase64(file);
    setPicture(dataUrl);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${window.API_BASE}/auth/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, department, picture: picture || null }),
      });
      if (res.ok) {
        const data = await res.json();
        onUserUpdate && onUserUpdate({ ...user, title: data.title, department: data.department, picture: data.picture });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch { /* offline */ }
    setSaving(false);
  };

  return (
    <div className="col gap-16">
      <div className="card card-pad col gap-20">
        {/* Avatar section */}
        <div className="col gap-4" style={{ alignItems: "center" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            {picture
              ? <img src={picture} style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--border)" }} referrerPolicy="no-referrer" />
              : <span style={{ width: 88, height: 88, borderRadius: "50%", background: `oklch(0.93 0.04 ${[...(user?.name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360})`, color: `oklch(0.4 0.08 ${[...(user?.name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, border: "3px solid var(--border)" }}>
                  {(user?.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
            }
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: "var(--ink)", color: "white", border: "2px solid var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              title="Change photo">
              <Icons.Edit size={12} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          </div>
          <span className="weight-700" style={{ fontSize: 17, marginTop: 8 }}>{user?.name || "—"}</span>
          <span className="text-13 text-secondary">{user?.email || "—"}</span>
          {picture && picture !== user?.picture && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }} onClick={() => setPicture(user?.picture || "")}>
              {t('common.cancel')}
            </button>
          )}
        </div>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Editable fields */}
        <div className="col gap-10">
          <div>
            <label className="label">Titolo / ruolo</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="es. Recruiting Manager" />
          </div>
          <div>
            <label className="label">Dipartimento</label>
            <input className="input" value={department} onChange={e => setDepartment(e.target.value)} placeholder="es. HR" />
          </div>
        </div>

        <div className="row gap-8" style={{ justifyContent: "space-between" }}>
          <Btn onClick={onLogout}>{t('user.signOut')}</Btn>
          <Btn kind="primary" onClick={save} disabled={saving}>{saved ? "Salvato ✓" : t('common.save')}</Btn>
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
            placeholder="Aggiungi sede… (es. Genova, Venezia)"
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
          <div className="col gap-14" style={{ padding: "18px 18px 20px", borderTop: "2px solid var(--border)", background: "var(--bg-sunken)" }}>
            <div className="row gap-12" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label className="label">Label</label>
                <input className="input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="es. Technical Screen" autoFocus onKeyDown={e => e.key === "Enter" && addStage()} />
              </div>
              <div>
                <label className="label">Color</label>
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                  style={{ width: 38, height: 36, border: "1px solid var(--border)", borderRadius: 6, padding: 2, cursor: "pointer", background: "none", display: "block" }} />
              </div>
            </div>
            {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
            <div className="row gap-10" style={{ justifyContent: "flex-end" }}>
              <Btn onClick={() => { setAdding(false); setNewLabel(""); setError(""); }}>Cancel</Btn>
              <Btn kind="primary" onClick={addStage} disabled={!newLabel.trim() || saving}>Add stage</Btn>
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

const TeamSettings = ({ t, user, onLogout }) => {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const reload = () => {
    setLoading(true);
    fetch(`${window.API_BASE}/organizations/current`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setOrg(d);
        if (d?.members) {
          localStorage.setItem("candid_team_cache", JSON.stringify(
            d.members.map(m => ({ name: m.name, email: m.email, role: m.role, title: m.title || null, department: m.department || null }))
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

  const deleteOrg = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`${window.API_BASE}/organizations/current`, { method: "DELETE" });
    } catch {}
    setDeleting(false);
    onLogout && onLogout();
  };

  const isOwner = user && org && org.owner_id === user.id;
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

      {/* Danger zone — owner only */}
      {isOwner && (
        <div className="card" style={{ border: "1px solid var(--danger-soft, oklch(0.88 0.06 25))" }}>
          <div className="card-header" style={{ borderBottom: "1px solid var(--danger-soft, oklch(0.88 0.06 25))" }}>
            <span className="card-title" style={{ color: "var(--danger)" }}>Danger zone</span>
          </div>
          <div className="row" style={{ padding: "16px 18px", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div className="col gap-2">
              <span className="weight-500">Delete this organization</span>
              <span className="text-12 text-secondary">Permanently deletes the org and all its data — candidates, interviews, employees, roles, and settings. Cannot be undone.</span>
            </div>
            <Btn kind="danger" onClick={() => { setConfirmName(""); setDeleteOpen(true); }} style={{ flexShrink: 0 }}>
              Delete organization
            </Btn>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}
          onClick={() => !deleting && setDeleteOpen(false)}>
          <div className="card col" style={{ width: 420, padding: 28, gap: 16 }} onClick={e => e.stopPropagation()}>
            <div className="col gap-4">
              <span style={{ fontWeight: 600, fontSize: 16, color: "var(--danger)" }}>Delete "{org?.name}"?</span>
              <span className="text-13 text-secondary">
                This will permanently delete the organization and <strong>all its data</strong>: candidates, interviews, employees, roles, positions, API keys, and settings. This action cannot be undone.
              </span>
            </div>
            <div>
              <label className="label">Type <strong>{org?.name}</strong> to confirm</label>
              <input className="input" value={confirmName} onChange={e => setConfirmName(e.target.value)}
                placeholder={org?.name} autoFocus />
            </div>
            <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
              <Btn onClick={() => setDeleteOpen(false)} disabled={deleting}>{t('common.cancel')}</Btn>
              <Btn kind="danger" onClick={deleteOrg}
                disabled={confirmName !== org?.name || deleting}>
                {deleting ? "Deleting…" : "Delete forever"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Integrations ──────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    category: "Communication",
    items: [
      { name: "Slack",           desc: "Post pipeline updates and hiring notifications to any channel", icon: "💬" },
      { name: "Microsoft Teams", desc: "Send interview reminders and candidate alerts to Teams channels", icon: "🟦" },
      { name: "Google Chat",     desc: "Notify your team of stage changes via Google Chat spaces", icon: "💭" },
    ],
  },
  {
    category: "Calendar & Scheduling",
    items: [
      { name: "Google Calendar",  desc: "Auto-sync interviews to your team's calendars", icon: "📅" },
      { name: "Outlook Calendar", desc: "Create calendar events for every scheduled interview", icon: "📆" },
      { name: "Calendly",         desc: "Let candidates self-schedule via your Calendly links", icon: "🗓️" },
    ],
  },
  {
    category: "Video Conferencing",
    items: [
      { name: "Zoom",          desc: "Auto-generate Zoom links when an interview is scheduled", icon: "🎥" },
      { name: "Google Meet",   desc: "Attach Meet links to interview calendar events", icon: "🟢" },
      { name: "Microsoft Teams Meetings", desc: "Create Teams meeting links for remote interviews", icon: "📹" },
    ],
  },
  {
    category: "ATS & HR Systems",
    items: [
      { name: "Greenhouse",  desc: "Two-way sync for candidates, stages, and scorecards", icon: "🌿" },
      { name: "BambooHR",    desc: "Push hired candidates directly into your HR system", icon: "🎋" },
      { name: "Workday",     desc: "Sync employee records and onboarding data with Workday", icon: "☁️" },
      { name: "Lever",       desc: "Import candidates and export offers to Lever", icon: "⚙️" },
    ],
  },
  {
    category: "Job Boards",
    items: [
      { name: "LinkedIn Jobs", desc: "Post open roles and import applicants automatically", icon: "🔗" },
      { name: "Indeed",        desc: "Sync job listings and pull in applicants from Indeed", icon: "🔍" },
      { name: "Glassdoor",     desc: "Publish openings and track applicant source data", icon: "🏢" },
    ],
  },
  {
    category: "Automation & Documents",
    items: [
      { name: "Zapier",    desc: "Connect Candid to 6,000+ apps with no-code workflows", icon: "⚡" },
      { name: "Make",      desc: "Build advanced multi-step automations with Make scenarios", icon: "🔧" },
      { name: "DocuSign",  desc: "Send and track offer letters and NDAs for e-signature", icon: "✍️" },
    ],
  },
];

const IntegrationsSettings = () => (
  <div className="col gap-20">
    <div style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 18 }}>🚧</span>
      <div className="col gap-1">
        <span style={{ fontWeight: 600, fontSize: 13 }}>Integrations — Coming soon</span>
        <span className="text-12 text-muted">These integrations are under development. You'll be notified when they become available.</span>
      </div>
    </div>

    {INTEGRATIONS.map(group => (
      <div key={group.category}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          {group.category}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {group.items.map(integration => (
            <div key={integration.name} className="card card-pad" style={{ opacity: 0.55, cursor: "not-allowed", userSelect: "none" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="row gap-10" style={{ alignItems: "flex-start", flex: 1 }}>
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{integration.icon}</span>
                  <div className="col gap-3">
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{integration.name}</span>
                    <span className="text-12 text-muted" style={{ lineHeight: 1.4 }}>{integration.desc}</span>
                  </div>
                </div>
                <span style={{ flexShrink: 0, marginLeft: 10, fontSize: 10.5, fontWeight: 600, color: "var(--ink-muted)", background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" }}>
                  Soon
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ── Email (SMTP) Settings ─────────────────────────────────────────────────────

const EmailSettings = ({ t }) => {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState("");
  const [passwordSet, setPasswordSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    fetch(`${window.API_BASE}/config/email`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setHost(d.smtp_host || "");
        setPort(String(d.smtp_port || 587));
        setUser(d.smtp_user || "");
        setFrom(d.smtp_from || "");
        setPasswordSet(d.smtp_password_set || false);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveMsg("");
    const body = {
      smtp_host: host || null,
      smtp_port: parseInt(port) || 587,
      smtp_user: user || null,
      smtp_from: from || null,
      smtp_password: password || null,
    };
    try {
      const res = await fetch(`${window.API_BASE}/config/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setPasswordSet(d.smtp_password_set || false);
      setPassword("");
      setSaveMsg("Saved ✓");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch {
      setSaveMsg("Save failed");
    }
    setSaving(false);
  };

  return (
    <div className="col gap-16">
      <div className="card card-pad col gap-16">
        <div className="col gap-4">
          <span className="weight-600">Outgoing email (SMTP)</span>
          <span className="text-12 text-secondary">Used to send rejection emails. Each organization can configure its own sender.</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
          <div>
            <label className="label">SMTP host</label>
            <input className="input" value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className="label">Port</label>
            <input className="input" type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="587" />
          </div>
        </div>

        <div>
          <label className="label">Username</label>
          <input className="input" type="email" value={user} onChange={e => setUser(e.target.value)} placeholder="sender@yourcompany.com" />
        </div>

        <div>
          <label className="label">
            Password
            {passwordSet && !password && <span className="text-11 text-muted" style={{ marginLeft: 6 }}>(set — leave blank to keep)</span>}
          </label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={passwordSet ? "••••••••" : "App password or SMTP password"} />
        </div>

        <div>
          <label className="label">From address</label>
          <input className="input" type="email" value={from} onChange={e => setFrom(e.target.value)} placeholder="recruiting@yourcompany.com" />
          <span className="text-11 text-muted" style={{ marginTop: 4, display: "block" }}>Shown as the sender on rejection emails. Defaults to username if blank.</span>
        </div>

        <div className="row gap-8" style={{ alignItems: "center" }}>
          <Btn kind="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
          {saveMsg && <span className="text-12" style={{ color: saveMsg.includes("✓") ? "var(--positive)" : "var(--danger)" }}>{saveMsg}</span>}
        </div>
      </div>
    </div>
  );
};

window.SettingsScreen = SettingsScreen;
