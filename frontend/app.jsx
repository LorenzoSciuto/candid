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

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.68 28.18A13.9 13.9 0 0 1 10.8 24c0-1.45.25-2.85.68-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.86.92 7.51 2.54 10.74l7.14-5.52-.02.96z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7C13.42 14.62 18.27 10.75 24 10.75z"/>
  </svg>
);

// ── Org Setup Wizard ──────────────────────────────────────────────────────────

const OrgSetupWizard = ({ user, onComplete }) => {
  // Steps: "org" → pick/create org  |  "profile" → name + role + dept  |  "invite" → invite teammates
  const [step, setStep] = useState("org");
  const [subStep, setSubStep] = useState(
    (user.pending_invitations?.length > 0) ? "invites" : "choose"
  );
  const [orgName, setOrgName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingOrg, setPendingOrg] = useState(null);
  const [displayName, setDisplayName] = useState(user.name || "");
  const [title, setTitle] = useState(user.title || "");
  const [department, setDepartment] = useState(user.department || "");
  const [inviteEmails, setInviteEmails] = useState(["", "", ""]);
  const [inviteSending, setInviteSending] = useState(false);
  // Setup step
  const [aiProvider, setAiProvider] = useState("openai");
  const [aiModel, setAiModel] = useState("gpt-4o");
  const [aiKey, setAiKey] = useState("");
  const [setupLocations, setSetupLocations] = useState(["Remote", "On-site", "Hybrid"]);
  const [newSetupLoc, setNewSetupLoc] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);

  const invitations = user.pending_invitations || [];

  const apiHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` };

  const joinByInvitation = async (invitationId) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${window.API_BASE}/auth/accept-invite`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ invitation_id: invitationId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || "Failed to join organization");
      const data = await res.json();
      setPendingOrg({ token: data.token, org_id: data.org_id, org: data.org });
      setStep("profile");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const joinByToken = async () => {
    if (!inviteToken.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${window.API_BASE}/auth/accept-invite`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ token: inviteToken.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || "Invalid invitation token");
      const data = await res.json();
      setPendingOrg({ token: data.token, org_id: data.org_id, org: data.org });
      setStep("profile");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const createOrg = async () => {
    if (!orgName.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${window.API_BASE}/auth/organizations`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || "Failed to create organization");
      const data = await res.json();
      setPendingOrg({ token: data.token, org_id: data.org.id, org: { id: data.org.id, name: data.org.name, role: "owner" } });
      setStep("profile");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const completeProfile = async () => {
    await fetch(`${window.API_BASE}/auth/users/me`, {
      method: "PATCH",
      headers: apiHeaders,
      body: JSON.stringify({
        name: displayName.trim() || undefined,
        title: title.trim() || undefined,
        department: department.trim() || undefined,
      }),
    }).catch(() => {});
    setStep("setup");
  };

  const saveSetup = async () => {
    setSetupSaving(true);
    const orgToken = pendingOrg.token;
    const orgHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${orgToken}` };
    // Save AI provider + model
    await fetch(`${window.API_BASE}/config`, {
      method: "PUT",
      headers: orgHeaders,
      body: JSON.stringify({ provider: aiProvider, model_name: aiModel }),
    }).catch(() => {});
    // Save API key if provided
    if (aiKey.trim()) {
      await fetch(`${window.API_BASE}/config/keys`, {
        method: "PUT",
        headers: orgHeaders,
        body: JSON.stringify({ provider: aiProvider, api_key: aiKey.trim() }),
      }).catch(() => {});
    }
    // Save locations to localStorage
    localStorage.setItem("candid_locations", JSON.stringify(setupLocations));
    setSetupSaving(false);
    setStep("invite");
  };

  const enterWorkspace = () => {
    onComplete({
      id: user.id,
      email: user.email,
      picture: user.picture,
      name: displayName.trim() || user.name,
      title: title.trim() || undefined,
      department: department.trim() || undefined,
      token: pendingOrg.token,
      org_id: pendingOrg.org_id,
      orgs: [pendingOrg.org],
      needs_org_setup: false,
    });
  };

  const sendInvites = async () => {
    const emails = inviteEmails.map(e => e.trim()).filter(Boolean);
    if (emails.length) {
      setInviteSending(true);
      const orgToken = pendingOrg.token;
      await Promise.all(emails.map(email =>
        fetch(`${window.API_BASE}/organizations/current/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${orgToken}` },
          body: JSON.stringify({ email }),
        }).catch(() => {})
      ));
      setInviteSending(false);
    }
    setStep("recap");
  };

  const cardStyle = (active) => ({
    padding: 20, cursor: "pointer", textAlign: "left",
    border: `2px solid ${active ? "var(--ink)" : "var(--border)"}`,
    borderRadius: 10, background: active ? "var(--surface)" : "var(--bg-sunken)",
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font-sans)" }}>
      <div className="card col" style={{ width: 480, padding: 40, gap: 24 }}>
        {/* Header */}
        <div className="col" style={{ alignItems: "center", gap: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: "var(--ink)", display: "grid", placeItems: "center", color: "white", fontSize: 24, fontWeight: 600 }}>C</div>
          {step === "org"     && <span style={{ fontSize: 20, fontWeight: 600 }}>Welcome, {(displayName || user.name)?.split(" ")[0]}</span>}
          {step === "profile" && <span style={{ fontSize: 20, fontWeight: 600 }}>About you</span>}
          {step === "setup"   && <span style={{ fontSize: 20, fontWeight: 600 }}>Quick setup</span>}
          {step === "invite"  && <span style={{ fontSize: 20, fontWeight: 600 }}>Invite your team</span>}
          {step === "recap"   && <span style={{ fontSize: 20, fontWeight: 600 }}>You're all set</span>}
          <span className="text-13 text-secondary" style={{ textAlign: "center" }}>
            {step === "org"     ? "Set up your workspace to get started"
           : step === "profile" ? "Help your teammates know who you are"
           : step === "setup"   ? "Configure AI and office locations — skip any time"
           : step === "invite"  ? "Add colleagues to your organization"
           : "Review your setup before entering the workspace"}
          </span>
        </div>

        {/* Step indicator */}
        {(() => {
          const steps = ["org", "profile", "setup", "invite", "recap"];
          const current = steps.indexOf(step);
          return (
            <div className="row gap-8" style={{ justifyContent: "center" }}>
              {steps.map((s, i) => (
                <div key={s} style={{ width: 20, height: 4, borderRadius: 2, background: i <= current ? "var(--ink)" : "var(--border)" }} />
              ))}
            </div>
          );
        })()}

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* ── Step 1: Org ── */}
        {step === "org" && subStep === "invites" && (
          <div className="col gap-12">
            <span className="weight-600 text-14">You have pending invitations</span>
            {invitations.map(inv => (
              <button key={inv.invitation_id} className="col" style={cardStyle(false)}
                onClick={() => !loading && joinByInvitation(inv.invitation_id)}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="col gap-2">
                    <span className="weight-600">{inv.org_name}</span>
                    <span className="text-12 text-secondary">Join as {inv.role}</span>
                  </div>
                  <span className="text-12 text-mono" style={{ background: "var(--bg-sunken)", padding: "3px 10px", borderRadius: 6 }}>
                    {loading ? "Joining…" : "Join →"}
                  </span>
                </div>
              </button>
            ))}
            {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
            <div style={{ height: 1, background: "var(--border-soft)" }} />
            <button className="col" style={cardStyle(false)} onClick={() => { setSubStep("create"); setError(""); }}>
              <div className="weight-600" style={{ marginBottom: 2 }}>Create a new organization instead</div>
              <div className="text-12 text-secondary">Start fresh with your own workspace</div>
            </button>
          </div>
        )}

        {step === "org" && subStep === "choose" && (
          <div className="col gap-12">
            <button className="col" style={cardStyle(false)} onClick={() => setSubStep("create")}>
              <div className="weight-600" style={{ marginBottom: 4 }}>Create a new organization</div>
              <div className="text-13 text-secondary">Start fresh with your own workspace</div>
            </button>
            <button className="col" style={cardStyle(false)} onClick={() => setSubStep("token")}>
              <div className="weight-600" style={{ marginBottom: 4 }}>Join via invitation token</div>
              <div className="text-13 text-secondary">Paste the token from your invitation email</div>
            </button>
          </div>
        )}

        {step === "org" && subStep === "create" && (
          <div className="col gap-12">
            <div>
              <label className="label">Organization name</label>
              <input className="input" value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="Acme Corp" autoFocus onKeyDown={e => e.key === "Enter" && createOrg()} />
            </div>
            {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
            <div className="row gap-8">
              <Btn kind="primary" onClick={createOrg} disabled={!orgName.trim() || loading}>
                {loading ? "Creating…" : "Create organization"}
              </Btn>
              <Btn onClick={() => { setSubStep(invitations.length > 0 ? "invites" : "choose"); setError(""); }}>Back</Btn>
            </div>
          </div>
        )}

        {step === "org" && subStep === "token" && (
          <div className="col gap-12">
            <div>
              <label className="label">Invitation token</label>
              <input className="input" value={inviteToken} onChange={e => setInviteToken(e.target.value)}
                placeholder="Paste your invitation token…" autoFocus onKeyDown={e => e.key === "Enter" && joinByToken()} />
              <div className="text-12 text-muted" style={{ marginTop: 6 }}>Sent by email when a team member invited you.</div>
            </div>
            {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
            <div className="row gap-8">
              <Btn kind="primary" onClick={joinByToken} disabled={!inviteToken.trim() || loading}>
                {loading ? "Joining…" : "Join organization"}
              </Btn>
              <Btn onClick={() => { setSubStep("choose"); setError(""); }}>Back</Btn>
            </div>
          </div>
        )}

        {/* ── Step 2: Profile ── */}
        {step === "profile" && (
          <div className="col gap-16">
            {/* Google identity — read-only */}
            <div className="col gap-10" style={{ alignItems: "center" }}>
              <Avatar name={displayName || user.name} src={user.picture} size="xl" />
              <div className="col gap-1" style={{ alignItems: "center" }}>
                <span className="weight-600" style={{ fontSize: 15 }}>{displayName || user.name}</span>
                <span className="text-12 text-muted">{user.email}</span>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border-soft)" }} />

            {/* Organization context */}
            <div className="row gap-8" style={{ alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: "var(--ink)", display: "grid", placeItems: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
                {(pendingOrg?.org?.name || "?")[0].toUpperCase()}
              </div>
              <span className="text-13 weight-500">{pendingOrg?.org?.name}</span>
            </div>

            {/* Editable profile fields */}
            <div className="col gap-10">
              <div>
                <label className="label">Display name</label>
                <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Full name" autoFocus />
              </div>
              <div className="row gap-10">
                <div style={{ flex: 1 }}>
                  <label className="label">Role / title <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input className="input" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Recruiting Manager" />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Department <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input className="input" value={department} onChange={e => setDepartment(e.target.value)}
                    placeholder="e.g. HR, Engineering"
                    onKeyDown={e => e.key === "Enter" && completeProfile()} />
                </div>
              </div>
            </div>

            <div className="row gap-8">
              <Btn kind="primary" onClick={completeProfile} disabled={loading}>Continue →</Btn>
              <Btn onClick={() => setStep("org")}>Back</Btn>
            </div>
          </div>
        )}

        {/* ── Step 3: Setup ── */}
        {step === "setup" && (
          <div className="col gap-16">
            {/* AI provider */}
            <div className="col gap-10">
              <span className="weight-600 text-13">AI Provider</span>
              <div className="row gap-6" style={{ flexWrap: "wrap" }}>
                {[
                  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini"] },
                  { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
                  { id: "gemini", label: "Gemini", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
                  { id: "groq", label: "Groq", models: ["llama-3.3-70b-versatile"] },
                ].map(p => (
                  <button key={p.id} onClick={() => { setAiProvider(p.id); setAiModel(p.models[0]); }}
                    className="btn btn-sm" style={{ border: `1.5px solid ${aiProvider === p.id ? "var(--ink)" : "var(--border)"}`, background: aiProvider === p.id ? "var(--surface)" : "var(--bg-sunken)" }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input className="input" type="password" value={aiKey} onChange={e => setAiKey(e.target.value)}
                placeholder="API key (optional — configure later in Settings)" />
            </div>

            <div style={{ height: 1, background: "var(--border-soft)" }} />

            {/* Locations */}
            <div className="col gap-8">
              <span className="weight-600 text-13">Office locations</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {setupLocations.map(loc => (
                  <span key={loc} className="row gap-4" style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>
                    {loc}
                    <button className="icon-btn" style={{ width: 14, height: 14 }} onClick={() => setSetupLocations(prev => prev.filter(l => l !== loc))}>
                      <Icons.X size={9} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="row gap-8">
                <input className="input" style={{ flex: 1 }} value={newSetupLoc} onChange={e => setNewSetupLoc(e.target.value)}
                  placeholder="Add location…"
                  onKeyDown={e => { if (e.key === "Enter" && newSetupLoc.trim()) { setSetupLocations(p => [...p, newSetupLoc.trim()]); setNewSetupLoc(""); } }} />
                <Btn onClick={() => { if (newSetupLoc.trim()) { setSetupLocations(p => [...p, newSetupLoc.trim()]); setNewSetupLoc(""); } }} disabled={!newSetupLoc.trim()}>Add</Btn>
              </div>
            </div>

            <div className="row gap-8" style={{ alignItems: "center" }}>
              <Btn kind="primary" onClick={saveSetup} disabled={setupSaving}>{setupSaving ? "Saving…" : "Save & continue →"}</Btn>
              <button className="btn btn-ghost btn-sm text-muted" onClick={() => setStep("invite")}>Skip for now</button>
              <button className="btn btn-ghost btn-sm text-muted" style={{ marginLeft: "auto" }} onClick={() => setStep("profile")}>← Back</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Invite ── */}
        {step === "invite" && (
          <div className="col gap-12">
            <span className="text-13 text-secondary">Add email addresses of colleagues to invite. You can always invite more later from Settings → Team.</span>
            <div className="col gap-8">
              {inviteEmails.map((email, i) => (
                <input key={i} className="input" type="email" value={email}
                  onChange={e => setInviteEmails(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  placeholder={`colleague${i + 1}@company.com`} />
              ))}
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", fontSize: 12 }}
                onClick={() => setInviteEmails(prev => [...prev, ""])}>
                + Add another
              </button>
            </div>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              {inviteEmails.some(e => e.trim())
                ? <Btn kind="primary" onClick={sendInvites} disabled={inviteSending}>{inviteSending ? "Sending…" : "Send invites →"}</Btn>
                : <Btn kind="primary" onClick={() => setStep("recap")}>Continue →</Btn>
              }
              <button className="btn btn-ghost btn-sm text-muted" style={{ marginLeft: "auto" }} onClick={() => setStep("setup")}>← Back</button>
            </div>
          </div>
        )}

        {/* ── Step 5: Recap ── */}
        {step === "recap" && (
          <div className="col gap-20" style={{ alignItems: "center", textAlign: "center" }}>
            <div className="col gap-8" style={{ alignItems: "center" }}>
              <Avatar name={displayName || user.name} src={user.picture} size="xl" />
              <div className="col gap-2" style={{ alignItems: "center" }}>
                <span className="weight-600" style={{ fontSize: 16 }}>{displayName || user.name}</span>
                {(title || department) && <span className="text-13 text-secondary">{[title, department].filter(Boolean).join(" · ")}</span>}
              </div>
            </div>

            <div className="row gap-8" style={{ alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--ink)", display: "grid", placeItems: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
                {(pendingOrg?.org?.name || "?")[0].toUpperCase()}
              </div>
              <span className="weight-500 text-14">{pendingOrg?.org?.name}</span>
            </div>

            <Btn kind="primary" onClick={enterWorkspace} style={{ width: "100%", justifyContent: "center" }}>
              Enter workspace →
            </Btn>
            <button className="btn btn-ghost btn-sm text-muted" onClick={() => setStep("invite")}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Login Screen ─────────────────────────────────────────────────────────────

const LoginScreen = ({ onLogin }) => {
  const t = window.useT ? window.useT() : (k) => k;
  const [authCfg, setAuthCfg] = useState(null); // null = loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch auth config from backend (public endpoint, no token needed)
  useEffect(() => {
    fetch(`${window.API_BASE}/auth/config`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setAuthCfg(d || {}))
      .catch(() => setAuthCfg({}));
  }, []);

  // clientId: prefer backend config, allow index.html override for local dev
  const clientId = authCfg?.google_client_id || window.GOOGLE_CLIENT_ID || null;

  // Mount Google Sign-In button once clientId is known
  useEffect(() => {
    if (!clientId || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential });
    const target = document.getElementById("g-signin-btn");
    if (target) window.google.accounts.id.renderButton(target, { theme: "outline", size: "large", width: 320, text: "signin_with" });
  }, [clientId]);

  const handleCredential = async (response) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${window.API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: response.credential }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Google sign-in failed");
      }
      const user = await res.json();
      onLogin(user);
    } catch (err) {
      setError(err.message || "Sign-in failed. Is the backend running?");
      setLoading(false);
    }
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

        {/* Auth options — shown after config loads */}
        {authCfg === null ? (
          <span className="text-13 text-muted">{t('common.loading')}</span>
        ) : clientId ? (
          <div className="col" style={{ alignItems: "center", gap: 10, width: "100%" }}>
            <div id="g-signin-btn" style={{ minHeight: 44 }} />
          </div>
        ) : (
          <div className="col gap-8" style={{ alignItems: "center", textAlign: "center" }}>
            <Icons.Lock size={28} style={{ color: "var(--ink-secondary)" }} />
            <span className="text-13 text-secondary">Google Sign-In is not configured.</span>
            <span className="text-12 text-muted">Set <code>GOOGLE_CLIENT_ID</code> in <code>backend/.env</code> to enable login.</span>
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
  "inbox", "reports", "candidate", "settings", "liveroom",
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
  const [t_tweaks, setTweak] = window.useTweaks(TWEAKS_DEFAULTS);
  const [liveCounts, setLiveCounts] = useState({});
  const [liveInterview, setLiveInterview] = useState(null);

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

  // Load org pipeline stages from API; broadcast to all screens via custom event
  useEffect(() => {
    if (!user || !user.org_id) return;
    fetch(`${window.API_BASE}/config/stages`)
      .then(r => r.ok ? r.json() : null)
      .then(stages => {
        if (Array.isArray(stages) && stages.length > 0) {
          window.CANDID_DATA.STATUS = stages;
          window.dispatchEvent(new CustomEvent("candid:stages", { detail: stages }));
        }
      })
      .catch(() => {});
  }, [user?.org_id]);

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

  const handleLogin = (u) => { saveUser(u); setUser(u); };
  const handleLogout = () => { clearUser(); setUser(null); window.location.hash = ""; };
  const handleUserUpdate = (u) => { saveUser(u); setUser(u); };
  const handleOrgSetupComplete = (u) => { saveUser(u); setUser(u); };

  const handleSwitchOrg = async (orgId) => {
    const res = await fetch(`${window.API_BASE}/auth/switch-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    const updated = { ...user, token: data.token, org_id: data.org_id };
    saveUser(updated);
    setUser(updated);
    navigate("pipeline");
  };

  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgLoading, setNewOrgLoading] = useState(false);

  const doCreateOrg = async () => {
    if (!newOrgName.trim() || newOrgLoading) return;
    setNewOrgLoading(true);
    const res = await fetch(`${window.API_BASE}/auth/organizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newOrgName.trim() }),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      const updated = {
        ...user,
        token: data.token,
        org_id: data.org.id,
        orgs: [...(user.orgs || []), { id: data.org.id, name: data.org.name, role: "owner" }],
      };
      saveUser(updated);
      setUser(updated);
      setCreateOrgOpen(false);
      navigate("pipeline");
    }
    setNewOrgLoading(false);
  };

  if (!user) {
    return (
      <LocaleContext.Provider value={{ locale, setLocale }}>
        <LoginScreen onLogin={handleLogin} />
      </LocaleContext.Provider>
    );
  }

  if (user.needs_org_setup) {
    return (
      <LocaleContext.Provider value={{ locale, setLocale }}>
        <OrgSetupWizard user={user} onComplete={handleOrgSetupComplete} />
      </LocaleContext.Provider>
    );
  }

  const counts = t_tweaks.showCounts ? liveCounts : {};

  const openCandidate = (id) => { setCandidateId(id); navigate("candidate"); };

  const crumbs = (() => {
    switch (route) {
      case "pipeline":     return ["Workspace", "Pipeline"];
      case "candidates":   return ["Workspace", "Candidates"];
      case "jobs":         return ["Workspace", "Positions"];
      case "roles":        return ["Workspace", "Roles"];
      case "employees":    return ["Workspace", "Employees"];
      case "interviews":   return ["Workspace", "Interviews"];
      case "inbox":        return ["Workspace", "Inbox"];
      case "reports":      return ["Workspace", "Reports"];
      case "liveroom":     return ["Interviews", "Recording"];
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
          route={route === "candidate" ? "candidates" : route === "liveroom" ? "interviews" : route}
          onRoute={navigate}
          counts={counts}
          onQuickAdd={() => setQuickOpen(true)}
          user={user}
          onLogout={handleLogout}
          onSwitchOrg={handleSwitchOrg}
          onCreateOrg={() => { setNewOrgName(""); setCreateOrgOpen(true); }}
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
            {route === "liveroom"     && <window.LiveRoomScreen interview={liveInterview} onDone={() => navigate("interviews")} />}
            {route === "candidate"    && <window.CandidateScreen id={candidateId} onRoute={navigate} />}
            {route === "settings"     && <window.SettingsScreen user={user} onLocaleChange={setLocale} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />}
          </div>
        </div>

        <window.QuickAdd open={quickOpen} onClose={() => setQuickOpen(false)} onCreate={(id) => openCandidate(id)} tweaks={t_tweaks} />
        {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
        {planOpen && <HiringPlanModal onClose={() => setPlanOpen(false)} onNavigate={navigate} />}
        {createOrgOpen && (
          <Modal open title="New organization" onClose={() => setCreateOrgOpen(false)} width={400}
            footer={
              <>
                <Btn onClick={() => setCreateOrgOpen(false)}>Cancel</Btn>
                <Btn kind="primary" disabled={!newOrgName.trim() || newOrgLoading} onClick={doCreateOrg}>
                  {newOrgLoading ? "Creating…" : "Create"}
                </Btn>
              </>
            }>
            <div>
              <label className="label">Organization name</label>
              <input className="input" value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
                placeholder="Acme Corp" autoFocus onKeyDown={e => e.key === "Enter" && doCreateOrg()} />
            </div>
          </Modal>
        )}

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
