// Candid — app shell + routing + auth + locale

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
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

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
    } catch { setRewriteError(t('app.aiUnavailable')); }
    setRewriting(false);
  };

  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`${window.API_BASE}/ai/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      if (res.status === 503) {
        window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        onClose();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setSendError(err?.detail || t('app.sendFailed'));
        setSending(false);
        return;
      }
    } catch {
      setSendError(t('app.backendUnreachable'));
      setSending(false);
      return;
    }
    onClose();
  };

  return (
    <Modal open title={t('compose.title')} onClose={onClose} width={520}
      footer={
        <>
          {sendError && <span className="text-12" style={{ color: "var(--danger)", marginRight: "auto" }}>{sendError}</span>}
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" icon={<Icons.Mail size={14} />} onClick={send} disabled={!to.trim() || sending}>
            {sending ? t('compose.sending') : t('compose.send')}
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
          <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder={t('compose.subjectPlaceholder')} />
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
          <textarea className="textarea" rows={9} value={body} onChange={e => setBody(e.target.value)} placeholder={t('compose.bodyPlaceholder')} />
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
    <Modal open title={t('plan.title')} onClose={onClose} width={680} disableBackdropClose={false}
      footer={<Btn onClick={onClose}>{t('common.close')}</Btn>}>
      <div className="col gap-0">
        <div className="text-12 text-muted" style={{ marginBottom: 14 }}>{t('plan.sub')}</div>
        {loading && <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>{t('common.loading')}</div>}
        {!loading && jds.length === 0 && (
          <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>
            {t('plan.empty')}
            <button className="link text-13" style={{ marginLeft: 8 }} onClick={() => { onClose(); onNavigate("jobs"); }}>{t('plan.goToPositions')}</button>
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

// ── Server health monitor ─────────────────────────────────────────────────────

const useServerHealth = () => {
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await window._baseFetch(`${window.API_BASE}/`, { signal: AbortSignal.timeout(4000) });
        if (!cancelled) setOnline(res.ok || res.status < 500);
      } catch {
        if (!cancelled) setOnline(false);
      }
      if (!cancelled) setChecking(false);
    };
    check();
    const timer = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return { online, checking };
};

const ServerOfflineOverlay = () => {
  const t = window.useT();
  return (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    background: "var(--bg, #fafaf9)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
    gap: 0,
  }}>
    <div style={{
      width: 460, padding: "40px 44px",
      background: "var(--surface, #fff)",
      border: "1px solid var(--border, #e5e5e5)",
      borderRadius: 16,
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 16, textAlign: "center",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: "var(--danger-soft, #fef2f2)",
        border: "1px solid oklch(0.55 0.18 25 / 0.18)",
        display: "grid", placeItems: "center",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger, #ef4444)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.364 5.636a9 9 0 0 1 0 12.728M5.636 5.636a9 9 0 0 0 0 12.728" />
          <path d="M15.536 8.464a5 5 0 0 1 0 7.072M8.464 8.464a5 5 0 0 0 0 7.072" />
          <line x1="12" y1="12" x2="12.01" y2="12" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink, #1c1917)", letterSpacing: "-0.02em", marginBottom: 6 }}>
          {t('app.offline.title')}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-secondary, #78716c)", lineHeight: 1.6 }}>
          {t('app.offline.body')}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-faint, #a8a29e)" }}>
        {t('app.offline.retrying')}
      </div>
    </div>
  </div>
  );
};

// ── Auth helpers ─────────────────────────────────────────────────────────────

const SESSION_KEY = "candid_user";

const loadUser = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
};

const saveUser = (u) => localStorage.setItem(SESSION_KEY, JSON.stringify(u));
const clearUser = () => localStorage.removeItem(SESSION_KEY);

// Patch window.fetch once at module load — child-component effects fire before parent
// useEffect, so the token must be available synchronously via window._authToken.
(function () {
  const _orig = window.fetch;
  window._baseFetch = _orig;
  window.fetch = async (url, opts = {}) => {
    if (typeof url === "string" && url.startsWith(window.API_BASE || "")) {
      const token = window._authToken;
      if (token) opts = { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } };
    }
    const res = await _orig(url, opts);
    if (res.status === 401 && typeof url === "string" && url.startsWith(window.API_BASE || "")) {
      window.dispatchEvent(new CustomEvent("candid:unauthorized"));
    }
    return res;
  };
})();
window._authToken = loadUser()?.token || null;

// Decode Google JWT payload (no verification — display only)
const decodeJwt = (token) => {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }
};

// ── Invitations ──────────────────────────────────────────────────────────────

const PENDING_INVITE_KEY = "candid_invite_token";

// Invitation emails link to #accept-invite?token=…; the backend GET accept redirects to #?invite_accepted=1….
// Stash the token (consumed after login) and clean the hash before routing reads it.
(function () {
  const h = window.location.hash;
  if (h.startsWith("#accept-invite")) {
    const token = new URLSearchParams(h.split("?")[1] || "").get("token");
    if (token) localStorage.setItem(PENDING_INVITE_KEY, token);
  }
  if (h.startsWith("#accept-invite") || h.startsWith("#?invite_accepted")) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
})();

// POST /auth/accept-invite — body is { token } or { invitation_id }. Returns { token, org_id, org }.
const acceptInvite = async (authToken, body, fallbackError) => {
  const res = await fetch(`${window.API_BASE}/auth/accept-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || fallbackError);
  return res.json();
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
  const t = window.useT();
  // Steps: "org" → pick/create org  |  "profile" → name + role + dept  |  "invite" → invite teammates
  const linkToken = localStorage.getItem(PENDING_INVITE_KEY) || "";
  const [step, setStep] = useState("org");
  const [subStep, setSubStep] = useState(
    linkToken ? "token" : (user.pending_invitations?.length > 0) ? "invites" : "choose"
  );
  const [orgName, setOrgName] = useState("");
  const [inviteToken, setInviteToken] = useState(linkToken);
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
      const data = await acceptInvite(user.token, { invitation_id: invitationId }, t('wizard.err.join'));
      setPendingOrg({ token: data.token, org_id: data.org_id, org: data.org });
      setStep("profile");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const joinByToken = async () => {
    if (!inviteToken.trim()) return;
    localStorage.removeItem(PENDING_INVITE_KEY);
    setLoading(true);
    setError("");
    try {
      const data = await acceptInvite(user.token, { token: inviteToken.trim() }, t('wizard.err.token'));
      setPendingOrg({ token: data.token, org_id: data.org_id, org: data.org });
      setStep("profile");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Arrived from an invitation link: submit the stored token right away.
  useEffect(() => { if (linkToken) joinByToken(); }, []);

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
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || t('wizard.err.create'));
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
    await fetch(`${window.API_BASE}/config/preferences`, {
      method: "PUT",
      headers: orgHeaders,
      body: JSON.stringify({ locations: setupLocations }),
    }).catch(() => {});
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
          <span style={{ fontSize: 20, fontWeight: 600 }}>
            {step === "org" ? t('wizard.org.title').replace('{name}', (displayName || user.name || "").split(" ")[0]) : t(`wizard.${step}.title`)}
          </span>
          <span className="text-13 text-secondary" style={{ textAlign: "center" }}>{t(`wizard.${step}.sub`)}</span>
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
            <span className="weight-600 text-14">{t('wizard.pendingInvites')}</span>
            {invitations.map(inv => (
              <button key={inv.invitation_id} className="col" style={cardStyle(false)}
                onClick={() => !loading && joinByInvitation(inv.invitation_id)}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="col gap-2">
                    <span className="weight-600">{inv.org_name}</span>
                    <span className="text-12 text-secondary">{t('wizard.joinAs').replace('{role}', inv.role)}</span>
                  </div>
                  <span className="text-12 text-mono" style={{ background: "var(--bg-sunken)", padding: "3px 10px", borderRadius: 6 }}>
                    {loading ? t('wizard.joining') : t('wizard.join')}
                  </span>
                </div>
              </button>
            ))}
            {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
            <div style={{ height: 1, background: "var(--border-soft)" }} />
            <button className="col" style={cardStyle(false)} onClick={() => { setSubStep("create"); setError(""); }}>
              <div className="weight-600" style={{ marginBottom: 2 }}>{t('wizard.createInstead')}</div>
              <div className="text-12 text-secondary">{t('wizard.createSub')}</div>
            </button>
          </div>
        )}

        {step === "org" && subStep === "choose" && (
          <div className="col gap-12">
            <button className="col" style={cardStyle(false)} onClick={() => setSubStep("create")}>
              <div className="weight-600" style={{ marginBottom: 4 }}>{t('wizard.create')}</div>
              <div className="text-13 text-secondary">{t('wizard.createSub')}</div>
            </button>
            <button className="col" style={cardStyle(false)} onClick={() => setSubStep("token")}>
              <div className="weight-600" style={{ marginBottom: 4 }}>{t('wizard.joinToken')}</div>
              <div className="text-13 text-secondary">{t('wizard.joinTokenSub')}</div>
            </button>
          </div>
        )}

        {step === "org" && subStep === "create" && (
          <div className="col gap-12">
            <div>
              <label className="label">{t('wizard.orgName')}</label>
              <input className="input" value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="Acme Corp" autoFocus onKeyDown={e => e.key === "Enter" && createOrg()} />
            </div>
            {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
            <div className="row gap-8">
              <Btn kind="primary" onClick={createOrg} disabled={!orgName.trim() || loading}>
                {loading ? t('wizard.creating') : t('wizard.createOrg')}
              </Btn>
              <Btn onClick={() => { setSubStep(invitations.length > 0 ? "invites" : "choose"); setError(""); }}>{t('wizard.back')}</Btn>
            </div>
          </div>
        )}

        {step === "org" && subStep === "token" && (
          <div className="col gap-12">
            <div>
              <label className="label">{t('wizard.token')}</label>
              <input className="input" value={inviteToken} onChange={e => setInviteToken(e.target.value)}
                placeholder={t('wizard.tokenPlaceholder')} autoFocus onKeyDown={e => e.key === "Enter" && joinByToken()} />
              <div className="text-12 text-muted" style={{ marginTop: 6 }}>{t('wizard.tokenHelp')}</div>
            </div>
            {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
            <div className="row gap-8">
              <Btn kind="primary" onClick={joinByToken} disabled={!inviteToken.trim() || loading}>
                {loading ? t('wizard.joining') : t('wizard.joinOrg')}
              </Btn>
              <Btn onClick={() => { setSubStep("choose"); setError(""); }}>{t('wizard.back')}</Btn>
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
                <label className="label">{t('wizard.displayName')}</label>
                <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t('wizard.fullName')} autoFocus />
              </div>
              <div className="row gap-10">
                <div style={{ flex: 1 }}>
                  <label className="label">{t('wizard.title')} <span className="text-muted" style={{ fontWeight: 400 }}>{t('wizard.optional')}</span></label>
                  <input className="input" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder={t('wizard.titlePlaceholder')} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">{t('wizard.department')} <span className="text-muted" style={{ fontWeight: 400 }}>{t('wizard.optional')}</span></label>
                  <input className="input" value={department} onChange={e => setDepartment(e.target.value)}
                    placeholder={t('wizard.departmentPlaceholder')}
                    onKeyDown={e => e.key === "Enter" && completeProfile()} />
                </div>
              </div>
            </div>

            <div className="row gap-8">
              <Btn kind="primary" onClick={completeProfile} disabled={loading}>{t('wizard.continue')}</Btn>
              <Btn onClick={() => setStep("org")}>{t('wizard.back')}</Btn>
            </div>
          </div>
        )}

        {/* ── Step 3: Setup ── */}
        {step === "setup" && (
          <div className="col gap-16">
            {/* AI provider */}
            <div className="col gap-10">
              <span className="weight-600 text-13">{t('wizard.aiProvider')}</span>
              <div className="row gap-6" style={{ flexWrap: "wrap" }}>
                {window.CANDID_DATA.AI_PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => { setAiProvider(p.id); setAiModel(p.models[0]); }}
                    className="btn btn-sm" style={{ border: `1.5px solid ${aiProvider === p.id ? "var(--ink)" : "var(--border)"}`, background: aiProvider === p.id ? "var(--surface)" : "var(--bg-sunken)" }}>
                    {p.name}
                  </button>
                ))}
              </div>
              <input className="input" type="password" value={aiKey} onChange={e => setAiKey(e.target.value)}
                placeholder={t('wizard.apiKeyPlaceholder')} />
            </div>

            <div style={{ height: 1, background: "var(--border-soft)" }} />

            {/* Locations */}
            <div className="col gap-8">
              <span className="weight-600 text-13">{t('wizard.locations')}</span>
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
                  placeholder={t('wizard.addLocation')}
                  onKeyDown={e => { if (e.key === "Enter" && newSetupLoc.trim()) { setSetupLocations(p => [...p, newSetupLoc.trim()]); setNewSetupLoc(""); } }} />
                <Btn onClick={() => { if (newSetupLoc.trim()) { setSetupLocations(p => [...p, newSetupLoc.trim()]); setNewSetupLoc(""); } }} disabled={!newSetupLoc.trim()}>{t('common.add')}</Btn>
              </div>
            </div>

            <div className="row gap-8" style={{ alignItems: "center" }}>
              <Btn kind="primary" onClick={saveSetup} disabled={setupSaving}>{setupSaving ? t('common.saving') : t('wizard.saveContinue')}</Btn>
              <button className="btn btn-ghost btn-sm text-muted" onClick={() => setStep("invite")}>{t('wizard.skip')}</button>
              <button className="btn btn-ghost btn-sm text-muted" style={{ marginLeft: "auto" }} onClick={() => setStep("profile")}>← {t('wizard.back')}</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Invite ── */}
        {step === "invite" && (
          <div className="col gap-12">
            <span className="text-13 text-secondary">{t('wizard.inviteHelp')}</span>
            <div className="col gap-8">
              {inviteEmails.map((email, i) => (
                <input key={i} className="input" type="email" value={email}
                  onChange={e => setInviteEmails(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  placeholder={`colleague${i + 1}@company.com`} />
              ))}
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", fontSize: 12 }}
                onClick={() => setInviteEmails(prev => [...prev, ""])}>
                {t('wizard.addAnother')}
              </button>
            </div>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              {inviteEmails.some(e => e.trim())
                ? <Btn kind="primary" onClick={sendInvites} disabled={inviteSending}>{inviteSending ? t('compose.sending') : t('wizard.sendInvites')}</Btn>
                : <Btn kind="primary" onClick={() => setStep("recap")}>{t('wizard.continue')}</Btn>
              }
              <button className="btn btn-ghost btn-sm text-muted" style={{ marginLeft: "auto" }} onClick={() => setStep("setup")}>← {t('wizard.back')}</button>
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
              {t('wizard.enter')}
            </Btn>
            <button className="btn btn-ghost btn-sm text-muted" onClick={() => setStep("invite")}>← {t('wizard.back')}</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Login Screen ─────────────────────────────────────────────────────────────

const _LOGIN_FEATURES = [
  { Icon: Icons.Sparkles,  key: "analysis" },
  { Icon: Icons.Layout,    key: "pipeline" },
  { Icon: Icons.Mic,       key: "interviews" },
  { Icon: Icons.Users,     key: "team" },
  { Icon: Icons.UserCheck, key: "reviews" },
];

const LoginScreen = ({ onLogin }) => {
  const t = window.useT ? window.useT() : (k) => k;
  const [authCfg, setAuthCfg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const googleInitRef = useRef(false);

  useEffect(() => {
    fetch(`${window.API_BASE}/auth/config`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setAuthCfg(d || {}))
      .catch(() => setAuthCfg({}));
  }, []);

  const clientId = authCfg?.google_client_id || window.GOOGLE_CLIENT_ID || null;

  useEffect(() => {
    if (!clientId || !window.google?.accounts?.id || googleInitRef.current) return;
    googleInitRef.current = true;
    window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential });
    const target = document.getElementById("g-signin-btn");
    if (target) window.google.accounts.id.renderButton(target, { theme: "outline", size: "large", width: 300, text: "signin_with" });
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
        throw new Error(body?.detail || t('login.err.google'));
      }
      onLogin(await res.json());
    } catch (err) {
      setError(err.message || t('login.err.generic'));
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--font-sans)" }}>

      {/* ── Left panel — dark brand ──────────────────────────────────────── */}
      <div style={{
        flex: "0 0 56%", background: "#1C1917", position: "relative",
        display: "flex", flexDirection: "column", padding: "44px 52px",
        overflow: "hidden",
      }}>

        {/* Subtle dot-grid texture */}
        <svg aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.045, pointerEvents: "none" }}>
          <defs>
            <pattern id="lgrid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lgrid)" />
        </svg>

        {/* Glow orb — top-right purple */}
        <div aria-hidden="true" style={{
          position: "absolute", top: -160, right: -120, width: 560, height: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, oklch(0.52 0.16 285 / 0.18) 0%, transparent 68%)",
          pointerEvents: "none",
        }} />
        {/* Glow orb — bottom-left green */}
        <div aria-hidden="true" style={{
          position: "absolute", bottom: -140, left: -100, width: 480, height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, oklch(0.52 0.13 155 / 0.14) 0%, transparent 68%)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 9, background: "white",
            display: "grid", placeItems: "center",
            fontSize: 20, fontWeight: 700, color: "#1C1917", letterSpacing: "-0.04em",
            flexShrink: 0,
          }}>C</div>
          <span style={{ fontSize: 18, fontWeight: 600, color: "white", letterSpacing: "-0.02em" }}>Candid</span>
        </div>

        {/* Headline + feature list */}
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 40, paddingBottom: 40 }}>
          <div style={{ marginBottom: 36 }}>
            <h2 style={{
              margin: "0 0 14px", fontSize: 40, fontWeight: 700, color: "white",
              letterSpacing: "-0.035em", lineHeight: 1.13,
            }}>
              {t('login.hero1')}<br />
              <span style={{ color: "oklch(0.74 0.12 285)" }}>{t('login.hero2')}</span>
            </h2>
            <p style={{
              margin: 0, fontSize: 15, lineHeight: 1.65,
              color: "rgba(255,255,255,0.48)", maxWidth: 360,
            }}>
              {t('login.tagline')}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {_LOGIN_FEATURES.map(({ Icon, key }, index) => (
              <div key={index} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0, marginTop: 1,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  display: "grid", placeItems: "center",
                  color: "oklch(0.80 0.10 285)",
                }}>
                  <Icon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.88)", marginBottom: 2, letterSpacing: "-0.01em" }}>{t(`login.feature.${key}`)}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.55 }}>{t(`login.feature.${key}.desc`)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: "relative", fontSize: 11, color: "rgba(255,255,255,0.22)", letterSpacing: "0.01em" }}>
          © {new Date().getFullYear()} Candid — {t('login.footer')}
        </div>
      </div>

      {/* ── Right panel — sign-in form ───────────────────────────────────── */}
      <div style={{
        flex: 1, background: "var(--bg)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 48px",
      }}>
        <div style={{ width: "100%", maxWidth: 340 }}>

          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <h1 style={{
              margin: "0 0 8px", fontSize: 26, fontWeight: 700,
              color: "var(--ink)", letterSpacing: "-0.025em",
            }}>{t('login.welcome')}</h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-secondary)", lineHeight: 1.55 }}>
              {t('login.signInSub')}
            </p>
          </div>

          {/* Auth block */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {authCfg === null ? (
              <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{t('common.loading')}</span>
              </div>
            ) : clientId ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                <div id="g-signin-btn" style={{ minHeight: 44, display: "flex", justifyContent: "center" }} />
              </div>
            ) : (
              <div style={{
                padding: "20px 22px", background: "var(--bg-sunken)",
                borderRadius: "var(--r-lg)", border: "1px solid var(--border)",
                textAlign: "center", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 8,
              }}>
                <Icons.Lock size={22} style={{ color: "var(--ink-muted)" }} />
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink-secondary)" }}>{t('login.notConfigured')}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)" }}>
                  {t('login.set')} <code style={{ background: "var(--border-strong)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--font-mono)" }}>GOOGLE_CLIENT_ID</code> {t('login.in')} <code style={{ background: "var(--border-strong)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--font-mono)" }}>backend/.env</code>
                </p>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{t('login.signingIn')}</span>
              </div>
            )}
            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: "var(--r-md)",
                background: "var(--danger-soft)", border: "1px solid oklch(0.55 0.18 25 / 0.18)",
              }}>
                <span style={{ fontSize: 13, color: "var(--danger)" }}>{error}</span>
              </div>
            )}
          </div>

        </div>
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
  if (!h || h === "/") return "pipeline";
  return VALID_ROUTES.includes(h) ? h : "not-found";
};

// ── App ───────────────────────────────────────────────────────────────────────

const App = () => {
  const [user, setUser] = useState(loadUser);
  const [locale, setLocale] = useState(() => localStorage.getItem("candid_locale") || "en");
  const [route, setRoute] = useState(routeFromHash);
  const [routeData, setRouteData] = useState({});
  const [candidateId, setCandidateId] = useState(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [liveCounts, setLiveCounts] = useState({});
  const [liveInterview, setLiveInterview] = useState(null);
  const [liveReturnTab, setLiveReturnTab] = useState(null);
  const t_app = window.useT ? window.useT() : k => k;

  // Persist locale
  useEffect(() => { localStorage.setItem("candid_locale", locale); }, [locale]);

  // Keep the module-level fetch interceptor's token in sync
  useEffect(() => { window._authToken = user?.token || null; }, [user?.token]);

  // Auto-logout on 401 — dispatched by the module-level fetch interceptor
  useEffect(() => {
    const handler = () => { clearUser(); setUser(null); };
    window.addEventListener("candid:unauthorized", handler);
    return () => window.removeEventListener("candid:unauthorized", handler);
  }, []);

  // Load org metadata (slug, name) for portal links
  useEffect(() => {
    if (!user || !user.org_id) return;
    fetch(`${window.API_BASE}/organizations/current`)
      .then(r => r.ok ? r.json() : null)
      .then(org => { if (org) window.CANDID_ORG = org; })
      .catch(() => {});
  }, [user?.org_id]);

  // Load org preferences (date format etc.)
  useEffect(() => {
    if (!user || !user.org_id) return;
    fetch(`${window.API_BASE}/config/preferences`)
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (!prefs) return;
        window.CANDID_PREFS = prefs;
        window.CANDID_DATE_FORMAT = prefs.date_format;
      })
      .catch(() => {});
  }, [user?.org_id]);

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
      if (Array.isArray(jds)) window.CANDID_DATA.JDS = jds;
      if (Array.isArray(roles)) window.CANDID_DATA.ROLES = roles;
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
    setRouteData(data || {});
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

  const handleLogin = (u) => { window._authToken = u?.token || null; saveUser(u); setUser(u); };
  const handleLogout = () => { window._authToken = null; clearUser(); setUser(null); window.location.hash = ""; };
  const handleUserUpdate = (u) => { saveUser(u); setUser(u); };
  const handleOrgSetupComplete = (u) => { window._authToken = u?.token || null; saveUser(u); setUser(u); };

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

  const [inviteError, setInviteError] = useState("");
  useEffect(() => {
    const token = localStorage.getItem(PENDING_INVITE_KEY);
    if (!token || !user?.token || user.needs_org_setup) return; // the wizard consumes it in that case
    localStorage.removeItem(PENDING_INVITE_KEY);
    acceptInvite(user.token, { token }, t_app('wizard.err.token'))
      .then(data => {
        const orgs = (user.orgs || []).some(o => o.id === data.org_id) ? user.orgs : [...(user.orgs || []), data.org];
        handleUserUpdate({ ...user, token: data.token, org_id: data.org_id, orgs });
        navigate("pipeline");
      })
      .catch(err => setInviteError(err.message));
  }, [user?.token]);

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

  const openCandidate = (id) => { setCandidateId(id); navigate("candidate"); };

  const crumbs = (() => {
    switch (route) {
      case "jobs":         return [t_app('nav.workspace'), t_app('nav.positions')];
      case "pipeline": case "candidates": case "roles": case "employees":
      case "interviews": case "inbox": case "reports":
        return [t_app('nav.workspace'), t_app(`nav.${route}`)];
      case "liveroom":     return [t_app('nav.interviews'), t_app('nav.recording')];
      case "candidate":    return [t_app('nav.candidates'), "—"];
      case "settings":     return [t_app('nav.settings')];
      default:             return ["Candid"];
    }
  })();

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
          counts={liveCounts}
          onQuickAdd={() => setQuickOpen(true)}
          user={user}
          onLogout={handleLogout}
          onSwitchOrg={handleSwitchOrg}
          onCreateOrg={() => { setNewOrgName(""); setCreateOrgOpen(true); }}
        />
        <div className="main">
          <Topbar crumbs={crumbs} actions={topActions} />
          <div className="scroll">
            {route === "pipeline"     && <window.PipelineScreen onOpenCandidate={openCandidate} onQuickAdd={() => setQuickOpen(true)} onRoute={navigate} />}
            {route === "candidates"   && <window.CandidatesScreen onOpenCandidate={openCandidate} />}
            {route === "jobs"         && <window.JobsScreen onRoute={navigate} initialRoleFilter={routeData.roleFilter} />}
            {route === "roles"        && <window.RolesScreen onRoute={navigate} />}
            {route === "employees"    && <window.EmployeesScreen initialRoleFilter={routeData.roleFilter} />}
            {route === "interviews"   && <window.InterviewsScreen onRoute={navigate} />}
            {route === "inbox"        && <window.InboxScreen onRoute={navigate} />}
            {route === "reports"      && <window.ReportsScreen />}
            {route === "liveroom"     && <window.LiveRoomScreen interview={liveInterview} onDone={() => {
              if (liveInterview?.candidateId) {
                setCandidateId(liveInterview.candidateId);
                setLiveReturnTab("interviews");
                navigate("candidate");
              } else {
                navigate("interviews");
              }
            }} />}
            {route === "candidate" && candidateId && <window.CandidateScreen id={candidateId} onRoute={navigate} initialTab={liveReturnTab} onMount={() => setLiveReturnTab(null)} />}
            {route === "settings"     && <window.SettingsScreen user={user} onLocaleChange={setLocale} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />}
            {route === "not-found"    && <window.NotFoundScreen onRoute={navigate} />}
          </div>
        </div>

        <window.QuickAdd open={quickOpen} onClose={() => setQuickOpen(false)} onCreate={(id) => openCandidate(id)} />
        {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
        {planOpen && <HiringPlanModal onClose={() => setPlanOpen(false)} onNavigate={navigate} />}
        {inviteError && (
          <Modal open title={t_app('wizard.inviteFailed')} onClose={() => setInviteError("")} width={400}
            footer={<Btn onClick={() => setInviteError("")}>{t_app('common.close')}</Btn>}>
            <span className="text-13">{inviteError}</span>
          </Modal>
        )}
        {createOrgOpen && (
          <Modal open title={t_app('wizard.newOrg')} onClose={() => setCreateOrgOpen(false)} width={400}
            footer={
              <>
                <Btn onClick={() => setCreateOrgOpen(false)}>{t_app('common.cancel')}</Btn>
                <Btn kind="primary" disabled={!newOrgName.trim() || newOrgLoading} onClick={doCreateOrg}>
                  {newOrgLoading ? t_app('wizard.creating') : t_app('wizard.createShort')}
                </Btn>
              </>
            }>
            <div>
              <label className="label">{t_app('wizard.orgName')}</label>
              <input className="input" value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
                placeholder="Acme Corp" autoFocus onKeyDown={e => e.key === "Enter" && doCreateOrg()} />
            </div>
          </Modal>
        )}

      </div>
    </LocaleContext.Provider>
  );
};

// ── Portal entry-point ────────────────────────────────────────────────────────

// Public pages have no settings screen: use the last app locale, else the browser language.
const publicLocale = () => {
  const l = localStorage.getItem("candid_locale") || (navigator.language || "en").slice(0, 2);
  return window.TRANSLATIONS[l] ? l : "en";
};

const PortalEntry = () => {
  const { online, checking } = useServerHealth();

  const hash = window.location.hash.replace("#", "");
  let page;
  if (hash.startsWith("portal/") && hash.length > "portal/".length) {
    page = <window.PortalScreen slug={hash.slice("portal/".length)} />;
  } else if (hash.startsWith("video/") && hash.length > "video/".length) {
    page = <window.VideoPortalScreen token={hash.slice("video/".length)} />;
  } else if (!loadUser() && hash && hash !== "/" && !VALID_ROUTES.includes(hash)) {
    page = <window.NotFoundScreen />;
  } else {
    page = (
      <>
        {!checking && !online && <ServerOfflineOverlay />}
        <App />
      </>
    );
  }

  return (
    <LocaleContext.Provider value={{ locale: publicLocale(), setLocale: () => {} }}>
      {page}
    </LocaleContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<PortalEntry />);
