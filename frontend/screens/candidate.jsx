// Candidate Detail Hub — full profile with tabs
const { HUMAN_SKILLS, TECH_SKILLS } = window.CANDID_DATA;

// ── AI Prompts — keep all prompts in one place for easy editing ───────────────

const mapCandidate = (c) => ({
  id: c.id,
  first: c.first_name,
  last: c.last_name,
  email: c.email,
  phone: c.phone,
  role: c.current_role || c.job_title,
  experience: c.years_of_experience,
  location: c.location,
  status: c.status,
  source: c.source,
  appliedAt: c.applied_at,
  score: c.score,
  cvText: c.cv_text,
  cvFilename: c.cv_filename,
  hasCvFile: c.has_cv_file || false,
  jobDescription: c.job_description,
  pre: c.ai_pre_analysis || null,
  careerHistory: c.career_history || null,
  interviews: (c.interviews || []).map(iv => ({
    id: iv.id,
    title: iv.title || iv.type,
    type: iv.type,
    date: iv.date,
    duration: iv.duration,
    interviewer: iv.interviewer,
    summary: iv.ai_summary,
    cleaned_transcript: iv.cleaned_transcript,
  })),
  evaluation: c.evaluation || null,
  statusHistory: c.status_history || [],
});

// ── Email Modal ───────────────────────────────────────────────────────────────

const EmailModal = ({ candidate, onClose }) => {
  const t = window.useT();
  const [subject, setSubject] = useState(`Re: ${candidate.role || "Opportunity"} at Candid`);
  const [body, setBody] = useState(`Hi ${candidate.first},\n\n`);
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
          action: "rewrite_candidate_email",
          text: body,
          candidate_name: `${candidate.first} ${candidate.last}`,
          role: candidate.role || "",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setBody(d.result);
    } catch {
      setRewriteError("AI unavailable — check provider settings.");
    }
    setRewriting(false);
  };

  const sendEmail = () => {
    const mailto = `mailto:${candidate.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto);
    onClose();
  };

  return (
    <Modal open title={`Email ${candidate.first} ${candidate.last}`} onClose={onClose}
      width={560}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" icon={<Icons.Mail size={14} />} onClick={sendEmail} disabled={!candidate.email}>Send</Btn>
        </>
      }>
      <div className="col gap-12">
        {!candidate.email && <div className="text-12" style={{ color: "var(--warn)" }}>No email address on file for this candidate.</div>}
        <div>
          <label className="label">To</label>
          <input className="input" value={candidate.email || "(no email)"} disabled style={{ opacity: 0.6 }} />
        </div>
        <div>
          <label className="label">Subject</label>
          <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ margin: 0 }}>Body</label>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              {rewriteError && <span className="text-12" style={{ color: "var(--danger)" }}>{rewriteError}</span>}
              <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 12 }}
                onClick={rewriteWithAI} disabled={rewriting || !body.trim()}>
                {rewriting
                  ? <span className="badge ai" style={{ padding: "1px 6px", fontSize: 10 }}><span className="dot" /> rewriting…</span>
                  : <>✨ Rewrite with AI</>}
              </button>
            </div>
          </div>
          <textarea className="textarea" rows={9} value={body} onChange={e => setBody(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

// ── Edit Candidate Modal ──────────────────────────────────────────────────────

const EditCandidateModal = ({ candidate, onClose, onSaved }) => {
  const t = window.useT();
  const [first, setFirst] = useState(candidate.first || "");
  const [last, setLast] = useState(candidate.last || "");
  const [email, setEmail] = useState(candidate.email || "");
  const [phone, setPhone] = useState(candidate.phone || "");
  const [role, setRole] = useState(candidate.role || "");
  const [location, setLocation] = useState(candidate.location || "");
  const [experience, setExperience] = useState(candidate.experience ?? "");
  const [source, setSource] = useState(candidate.source || "");
  const [status, setStatus] = useState(candidate.status || "new");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${window.API_BASE}/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first, last_name: last,
          email: email || null, phone: phone || null,
          current_role: role || null, location: location || null,
          years_of_experience: experience !== "" ? parseInt(experience) : null,
          source: source || null, status,
        }),
      });
      onSaved();
    } catch { /* offline */ }
    setSaving(false);
  };

  const statuses = window.CANDID_DATA.STATUS || [];

  return (
    <Modal open title="Edit candidate" onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" onClick={save} disabled={saving || !first || !last}>{saving ? t('common.saving') : t('common.save')}</Btn>
        </>
      }>
      <div className="col gap-12">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="label">First name</label><input className="input" value={first} onChange={e => setFirst(e.target.value)} /></div>
          <div><label className="label">Last name</label><input className="input" value={last} onChange={e => setLast(e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label className="label">Current role / title</label><input className="input" value={role} onChange={e => setRole(e.target.value)} /></div>
          <div><label className="label">Location</label><input className="input" value={location} onChange={e => setLocation(e.target.value)} /></div>
          <div><label className="label">Years of experience</label><input className="input" type="number" min={0} value={experience} onChange={e => setExperience(e.target.value)} /></div>
          <div>
            <label className="label">Source</label>
            <select className="select" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">—</option>
              {["Referral", "LinkedIn", "Inbound", "Job board", "Agency", "Other"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Stage</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
};

const CandidateScreen = ({ id, onRoute }) => {
  const t = window.useT();
  const [c, setC] = useState({ first: "", last: "", email: null, phone: null, role: null, experience: null, location: null, status: "new", source: null, pre: null, interviews: [], evaluation: null, score: null, cvText: null, jobDescription: null });
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [hiring, setHiring] = useState(false);
  const [hired, setHired] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${window.API_BASE}/candidates/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setC(mapCandidate(d));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const refreshCandidate = () => {
    fetch(`${window.API_BASE}/candidates/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setC(mapCandidate(d)); })
      .catch(() => {});
  };

  const fullName = `${c.first} ${c.last}`;

  const convertToEmployee = async () => {
    setHiring(true);
    try {
      await fetch(`${window.API_BASE}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: c.first, last_name: c.last, email: c.email || null,
          role_name: c.role || null, location: c.location || null,
        }),
      });
      await fetch(`${window.API_BASE}/candidates/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "hired" }),
      });
      setC(prev => ({ ...prev, status: "hired" }));
      setHired(true);
    } catch { /* offline */ }
    setHiring(false);
  };

  const TABS = [
    { id: "overview",    label: t('candidate.tab.overview') },
    { id: "cv-analysis", label: t('candidate.tab.cv') },
    { id: "interviews",  label: t('candidate.tab.interviews') },
    { id: "evaluation",  label: t('candidate.tab.evaluation') },
    { id: "activity",    label: t('candidate.tab.activity') },
  ];

  return (
    <div className="page page-wide" style={{ maxWidth: 1200 }}>
      <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div className="row gap-16">
          <Avatar name={fullName} size="xl" />
          <div className="col gap-4">
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <h1 style={{ fontSize: 24, margin: 0, fontWeight: 600, letterSpacing: "-0.02em" }}>{fullName}</h1>
              <StatusBadge status={c.status} />
            </div>
            <div className="text-13 text-secondary">{c.role}{c.location && ` · ${c.location}`}</div>
            <div className="row gap-12 mt-8">
              {c.email && <span className="row gap-6 text-12 text-secondary"><Icons.Mail size={12} />{c.email}</span>}
              {c.phone && <span className="row gap-6 text-12 text-secondary"><Icons.Phone size={12} />{c.phone}</span>}
              {c.experience != null && <span className="row gap-6 text-12 text-secondary"><Icons.Briefcase size={12} />{c.experience}y experience</span>}
              {c.source && <span className="row gap-6 text-12 text-secondary"><Icons.User size={12} />{c.source}</span>}
            </div>
          </div>
        </div>
        <div className="row gap-8">
          <Btn icon={<Icons.Edit size={14} />} onClick={() => setEditOpen(true)}>{t('common.edit')}</Btn>
          <Btn icon={<Icons.Mail size={14} />} onClick={() => setEmailOpen(true)}>{t('candidate.email')}</Btn>
          <Btn icon={<Icons.Calendar size={14} />}>{t('candidate.schedule')}</Btn>
          {(c.hasCvFile || c.cvText) && (
            <Btn icon={<Icons.Download size={14} />} onClick={async () => {
              if (c.hasCvFile) {
                const res = await fetch(`${window.API_BASE}/candidates/${c.id}/cv`);
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url;
                  a.download = c.cvFilename || `${c.first}_${c.last}_cv`;
                  a.click(); URL.revokeObjectURL(url);
                  return;
                }
              }
              if (c.cvText) {
                const blob = new Blob([c.cvText], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = c.cvFilename?.replace(/\.\w+$/, ".txt") || `${c.first}_${c.last}_cv.txt`;
                a.click(); URL.revokeObjectURL(url);
              }
            }}>CV</Btn>
          )}
          {(c.status === "offer" || c.status === "hired") && !hired && (
            <Btn kind="primary" icon={<Icons.UserCheck size={14} />} onClick={convertToEmployee} disabled={hiring || c.status === "hired"}>
              {hiring ? t('common.saving') : c.status === "hired" ? "Hired ✓" : "Hire → Employees"}
            </Btn>
          )}
          {hired && <Badge kind="positive"><Icons.Check size={11} /> Moved to Employees</Badge>}
          {c.status !== "offer" && c.status !== "hired" && (
            <Btn kind="primary" icon={<Icons.Mic size={14} />} onClick={() => onRoute("liveroom", { candidateName: `${c.first} ${c.last}`, candidateId: c.id, title: "Interview", type: "Live" })}>{t('candidate.startInterview')}</Btn>
          )}
        </div>
      </div>

      {c.score != null && (
        <div className="card" style={{ padding: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
          <Stat label={t('candidate.stat.score')} value={c.score?.toFixed(1)} unit="/ 5" />
          <Stat label={t('candidate.stat.interviews')} value={String((c.interviews || []).length)} sub="completed" />
          <Stat label={t('candidate.stat.recommendation')} value={c.evaluation?.final_recommendation || t('common.pending')} mono={false} />
          <Stat label={t('candidate.stat.stage')} value={window.CANDID_DATA.STATUS.find(s => s.id === c.status)?.label || c.status} small />
        </div>
      )}

      <div className="tabs">
        {TABS.map(tb => (
          <button key={tb.id} className={`tab ${tab === tb.id ? "active" : ""}`} onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview"    && <OverviewTab c={c} onTab={setTab} t={t} />}
      {tab === "cv-analysis" && <CVAnalysisTab c={c} t={t} onRefresh={refreshCandidate} />}
      {tab === "interviews"  && <InterviewsTab c={c} onRoute={onRoute} onRefresh={refreshCandidate} t={t} />}
      {tab === "evaluation"  && <EvaluationTab c={c} onSaved={refreshCandidate} t={t} />}
      {tab === "activity"    && <ActivityTab c={c} />}

      {emailOpen && <EmailModal candidate={c} onClose={() => setEmailOpen(false)} />}
      {editOpen && (
        <EditCandidateModal
          candidate={c}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); refreshCandidate(); }}
        />
      )}
    </div>
  );
};

const Stat = ({ label, value, unit, sub, trend, small }) => (
  <div className="col gap-4" style={{ padding: "16px 20px", borderRight: "1px solid var(--border)" }}>
    <span className="text-12 text-muted">{label}</span>
    <div className="row gap-6" style={{ alignItems: "baseline" }}>
      <span style={{ fontSize: small ? 14 : 22, fontWeight: 600, letterSpacing: "-0.01em" }}>{value || "—"}</span>
      {unit && <span className="text-12 text-muted text-mono">{unit}</span>}
      {trend && <span className="text-12" style={{ color: "var(--positive)" }}>{trend}</span>}
    </div>
    {sub && <span className="text-12 text-muted">{sub}</span>}
  </div>
);

// ── Fractional star rating ────────────────────────────────────────────────────

const StarScore = ({ score, max = 5, size = 14 }) => {
  const pct = Math.max(0, Math.min(1, score / max)) * 100;
  const star = { fontSize: size, lineHeight: 1, letterSpacing: 1 };
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span style={{ ...star, color: "var(--bg-sunken)", filter: "brightness(1.8)" }}>{"★".repeat(max)}</span>
      <span style={{ ...star, color: "var(--ai)", position: "absolute", left: 0, top: 0, overflow: "hidden", width: `${pct}%`, whiteSpace: "nowrap" }}>{"★".repeat(max)}</span>
    </div>
  );
};

// ── Overview ──────────────────────────────────────────────────────────────────

const OverviewTab = ({ c, onTab, t }) => (
  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 20 }}>
    <div className="col gap-16">
      {c.pre ? (
        <>
          <div className="ai-panel card-pad">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <span className="ai-tag"><Icons.Sparkles size={11} /> {t('candidate.overview.aiSummary')}</span>
              <button className="link text-12" onClick={() => onTab("cv-analysis")}>{t('candidate.overview.fullAnalysis')}</button>
            </div>
            <div className="text-13" style={{ lineHeight: 1.6 }}>
              {c.pre?.overview || c.pre?.strengths?.[0] || "AI analysis completed."}
            </div>
          </div>
          {c.pre?.strengths?.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">{t('candidate.overview.strengths')}</span><Badge kind="positive">{c.pre.strengths.length}</Badge></div>
              <div style={{ padding: 14 }}>
                <ul className="ai-list strengths">
                  {c.pre.strengths.slice(0, 3).map((s, i) => (
                    <li key={i}><span className="marker"><Icons.Check size={11} /></span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card card-pad" style={{ textAlign: "center", padding: 40 }}>
          <Icons.Sparkles size={22} style={{ color: "var(--ai)", marginBottom: 8 }} />
          <div className="weight-600">{t('candidate.overview.noAnalysis')}</div>
          <div className="text-13 text-secondary mt-4" style={{ marginBottom: 14 }}>Go to CV Analysis to upload a CV and run AI analysis.</div>
          <Btn kind="ai" icon={<Icons.Upload size={14} />} onClick={() => onTab("cv-analysis")}>{t('candidate.overview.runAnalysis')}</Btn>
        </div>
      )}
    </div>

    <div className="col gap-16">
      {/* Career history */}
      {c.careerHistory?.length > 0 && (
        <div className="card card-pad col gap-10">
          <div className="weight-500" style={{ marginBottom: 4 }}>Career history</div>
          {c.careerHistory.map((role, i) => (
            <div key={i} className="row gap-10" style={{ alignItems: "flex-start" }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--ai)", marginTop: 5, flexShrink: 0 }} />
              <div className="col" style={{ minWidth: 0 }}>
                <span className="text-13 weight-500">{role.title}</span>
                <span className="text-12 text-muted">{[role.company, role.period].filter(Boolean).join(" · ")}</span>
                {role.description && <span className="text-12 text-secondary" style={{ marginTop: 2 }}>{role.description}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline tracker */}
      <div className="card card-pad">
        <div className="weight-500" style={{ marginBottom: 12 }}>{t('candidate.overview.pipeline')}</div>
        <div className="col gap-8">
          {window.CANDID_DATA.STATUS.map((s, i) => {
            const myIdx = window.CANDID_DATA.STATUS.findIndex(x => x.id === c.status);
            const done = i < myIdx, here = i === myIdx;
            return (
              <div key={s.id} className="row gap-8" style={{ alignItems: "center" }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: done || here ? s.dot : "var(--bg-sunken)", display: "grid", placeItems: "center", color: "white" }}>
                  {done && <Icons.Check size={10} />}
                  {here && <span style={{ width: 6, height: 6, borderRadius: 999, background: "white" }} />}
                </span>
                <span className={here ? "weight-600" : (done ? "text-secondary" : "text-muted")} style={{ fontSize: 13 }}>{s.label}</span>
                {here && <span className="text-12 text-muted" style={{ marginLeft: "auto" }}>now</span>}
              </div>
            );
          })}
        </div>
      </div>

      {c.pre?.questions?.length > 0 && (
        <div className="card card-pad col gap-8">
          <div className="weight-500">{t('candidate.overview.suggestedQ')}</div>
          <ul className="ai-list questions" style={{ padding: "0 0 0 4px", margin: 0 }}>
            {c.pre.questions.slice(0, 2).map((q, i) => (
              <li key={i} style={{ paddingLeft: 8 }}><span className="marker">{i + 1}</span><span className="text-13" style={{ lineHeight: 1.5 }}>{q}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </div>
);

// ── CV Analysis ───────────────────────────────────────────────────────────────

const CVAnalysisTab = ({ c, t, onRefresh }) => {
  const [stage, setStage] = useState("idle"); // idle | uploading | analyzing
  const [error, setError] = useState("");
  const [localCvText, setLocalCvText] = useState("");
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const runAnalysis = async (cvText) => {
    const text = cvText || c.cvText || localCvText;
    if (!text) return;
    setError("");
    setStage("analyzing");
    try {
      const res = await fetch(`${window.API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: c.id, job_title: c.role || "", cv_text: text }),
      });
      if (!res.ok) throw new Error(await res.text());
      onRefresh && onRefresh();
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    }
    setStage("idle");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setStage("uploading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (c.id) fd.append("candidate_id", c.id);
      const res = await fetch(`${window.API_BASE}/upload-cv`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLocalCvText(data.text);
      await runAnalysis(data.text);
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
      setStage("idle");
    }
  };

  const displayCvText = c.cvText || localCvText;
  const busy = stage !== "idle";

  return (
    <div className="col gap-16">
      {/* Top bar: overview + run button */}
      <div className="ai-panel card-pad row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div className="col gap-6" style={{ flex: 1 }}>
          <span className="ai-tag" style={{ display: "inline-flex" }}><Icons.Sparkles size={11} /> AI Overview</span>
          <div className="text-13" style={{ lineHeight: 1.6 }}>
            {c.pre?.overview || <span className="text-muted">No analysis yet — upload a CV or run analysis to get started.</span>}
          </div>
        </div>
        <div className="col gap-6" style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{ display: "none" }} onChange={handleFileChange} />
          {!displayCvText ? (
            <Btn kind="ai" icon={<Icons.Upload size={14} />} disabled={busy} onClick={() => fileInputRef.current?.click()}>
              {stage === "uploading" ? "Uploading…" : "Upload CV"}
            </Btn>
          ) : (
            <Btn kind="ai" icon={<Icons.Sparkles size={14} />} disabled={busy} onClick={() => runAnalysis()}>
              {stage === "analyzing" ? "Analyzing…" : c.pre ? "Re-run analysis" : "Run analysis"}
            </Btn>
          )}
          {displayCvText && (
            <button className="text-12 text-muted link" onClick={() => fileInputRef.current?.click()}>
              {stage === "uploading" ? "Uploading…" : "Replace CV"}
            </button>
          )}
        </div>
      </div>
      {error && <div className="text-12" style={{ color: "var(--danger)" }}>{error}</div>}

      {c.pre ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 16 }}>
          <div className="col gap-12">
            {/* Strengths */}
            {c.pre.strengths?.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">{t('candidate.cv.strengths')}</span><Badge kind="positive">{c.pre.strengths.length}</Badge></div>
                <div style={{ padding: 14 }}><ul className="ai-list strengths">{c.pre.strengths.map((s, i) => <li key={i}><span className="marker"><Icons.Check size={11} /></span><span>{s}</span></li>)}</ul></div>
              </div>
            )}
            {/* Weaknesses */}
            {c.pre.weaknesses?.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">{t('candidate.cv.weaknesses')}</span><Badge kind="warn">{c.pre.weaknesses.length}</Badge></div>
                <div style={{ padding: 14 }}><ul className="ai-list weaknesses">{c.pre.weaknesses.map((s, i) => <li key={i}><span className="marker"><Icons.X size={11} /></span><span>{s}</span></li>)}</ul></div>
              </div>
            )}
            {/* Interview questions */}
            {c.pre.questions?.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">{t('candidate.cv.questions')}</span><Badge kind="ai">{c.pre.questions.length}</Badge></div>
                <div style={{ padding: 14 }}><ul className="ai-list questions">{c.pre.questions.map((s, i) => <li key={i}><span className="marker">{i + 1}</span><span>{s}</span></li>)}</ul></div>
              </div>
            )}
          </div>

          <div className="col gap-12">
            {/* Role fit scores */}
            {c.pre.role_fits?.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Role fit</span>
                  <span className="card-sub">Scored against open positions</span>
                  <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 11, marginLeft: "auto" }}
                    disabled={busy} onClick={() => runAnalysis()}>
                    <Icons.RotateCcw size={11} /> {stage === "analyzing" ? "Reanalysing…" : "Retest"}
                  </button>
                </div>
                <div style={{ padding: "10px 16px" }}>
                  {c.pre.role_fits.map((rf, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: i < c.pre.role_fits.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span className="text-13 weight-500">{rf.title}</span>
                        <div className="row gap-6" style={{ alignItems: "center" }}>
                          <StarScore score={rf.score} />
                          <span className="text-12 text-mono text-muted">{Number(rf.score).toFixed(1)}</span>
                        </div>
                      </div>
                      {rf.reason && <span className="text-12 text-secondary">{rf.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CV text */}
            {displayCvText && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">CV text</span>
                  <span className="card-sub">{displayCvText.split(/\s+/).filter(Boolean).length} words</span>
                  <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 11, marginLeft: "auto" }}
                    onClick={() => setCvModalOpen(true)}>
                    <Icons.Eye size={11} /> View
                  </button>
                </div>
                <div style={{ padding: 14, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>{displayCvText}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        !busy && !displayCvText && (
          <div className="card card-pad" style={{ textAlign: "center", padding: 40 }}>
            <Icons.FileText size={22} style={{ color: "var(--ink-muted)", marginBottom: 8 }} />
            <div className="weight-500">No CV uploaded</div>
            <div className="text-13 text-secondary mt-4" style={{ marginBottom: 14 }}>Upload a PDF or DOCX to extract skills, generate analysis, and score against open roles.</div>
            <Btn kind="ai" icon={<Icons.Upload size={14} />} onClick={() => fileInputRef.current?.click()}>Upload CV</Btn>
          </div>
        )
      )}

      {/* CV full-view modal */}
      {cvModalOpen && displayCvText && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 700 }}
          onClick={() => setCvModalOpen(false)}>
          <div className="card col" style={{ width: "min(860px, 90vw)", maxHeight: "85vh", overflow: "hidden", padding: 0 }}
            onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span className="card-title">CV — {c.first} {c.last}</span>
              <span className="card-sub">{displayCvText.split(/\s+/).filter(Boolean).length} words</span>
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setCvModalOpen(false)}>
                <Icons.X size={14} />
              </button>
            </div>
            <div style={{ padding: "20px 28px", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.75, whiteSpace: "pre-wrap", overflowY: "auto", color: "var(--ink-secondary)" }}>
              {displayCvText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Interviews Tab ────────────────────────────────────────────────────────────

const InterviewsTab = ({ c, onRoute, onRefresh, t }) => {
  const [creating, setCreating] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [title, setTitle] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [saving, setSaving] = useState(false);

  const addInterview = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${window.API_BASE}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: c.id, title, interviewer, raw_content: rawContent, type: "Manual Paste" }),
      });
      if (res.ok) { onRefresh(); setCreating(false); setRawContent(""); setTitle(""); setInterviewer(""); }
    } catch { /* offline */ }
    setSaving(false);
  };

  return (
    <div className="col gap-12">
      {(c.interviews || []).map(iv => (
        <div key={iv.id} className="card card-pad row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="row gap-12">
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-sunken)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icons.Mic size={16} />
            </div>
            <div className="col">
              <div className="row gap-8"><span className="weight-500">{iv.title || iv.type}</span><Badge>{iv.type}</Badge></div>
              <span className="text-12 text-muted">
                {[iv.date, iv.duration && `${iv.duration}`, iv.interviewer && `with ${iv.interviewer}`].filter(Boolean).join(" · ")}
              </span>
              {iv.summary && <span className="text-13 text-secondary" style={{ marginTop: 4, lineHeight: 1.5 }}>{iv.summary}</span>}
            </div>
          </div>
          <Btn>{t('common.open')}</Btn>
        </div>
      ))}

      {creating ? (
        <div className="card card-pad col gap-10">
          <span className="weight-500">{t('candidate.iv.addTitle')}</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="label">{t('candidate.iv.title')}</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Recruiter Screen" /></div>
            <div><label className="label">{t('candidate.iv.interviewer')}</label><input className="input" value={interviewer} onChange={e => setInterviewer(e.target.value)} placeholder="Name" /></div>
          </div>
          <div><label className="label">{t('candidate.iv.rawLabel')}</label><textarea className="textarea" rows={6} value={rawContent} onChange={e => setRawContent(e.target.value)} placeholder={t('candidate.iv.rawPh')} /></div>
          <div className="row gap-8">
            <Btn onClick={() => setCreating(false)}>{t('common.cancel')}</Btn>
            <Btn kind="primary" onClick={addInterview} disabled={!rawContent || saving}>{saving ? t('common.saving') : t('common.save')}</Btn>
          </div>
        </div>
      ) : (
        <div className="card card-pad row" style={{ justifyContent: "space-between", borderStyle: "dashed", background: "var(--bg-sunken)" }}>
          <div className="col">
            <span className="weight-500">{t('candidate.iv.add')}</span>
            <span className="text-12 text-muted">{t('candidate.iv.hint')}</span>
          </div>
          <div className="row gap-8">
            <Btn onClick={() => setCreating(true)}>{t('candidate.iv.paste')}</Btn>
            <Btn kind="primary" icon={<Icons.Mic size={14} />} onClick={() => onRoute && onRoute("liveroom", { candidateName: `${c.first} ${c.last}`, candidateId: c.id, title: "Interview", type: "Live" })}>{t('candidate.iv.join')}</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Evaluation Tab ────────────────────────────────────────────────────────────

const EvaluationTab = ({ c, onSaved, t }) => {
  const evalData = c.evaluation || {};
  const [human, setHuman] = useState(evalData.human_skills || {});
  const [technical, setTechnical] = useState(evalData.technical_skills || {});
  const [recommendation, setRecommendation] = useState(evalData.final_recommendation || "Pending");
  const [notes, setNotes] = useState(evalData.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${window.API_BASE}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: c.id,
          human_skills: human,
          technical_skills: technical,
          final_recommendation: recommendation,
          notes: notes || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch { /* offline */ }
    setSaving(false);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div className="col gap-12">
        <div className="card">
          <div className="card-header"><span className="card-title">{t('candidate.eval.human')}</span><span className="card-sub">{t('candidate.eval.scale')}</span></div>
          <div style={{ padding: "8px 18px" }}>
            {HUMAN_SKILLS.map(s => (
              <SkillRow key={s} label={s} value={human[s] || 0} onChange={v => setHuman(prev => ({ ...prev, [s]: v }))} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">{t('candidate.eval.technical')}</span><span className="card-sub">{t('candidate.eval.scale')}</span></div>
          <div style={{ padding: "8px 18px" }}>
            {TECH_SKILLS.map(s => (
              <SkillRow key={s} label={s} value={technical[s] || 0} onChange={v => setTechnical(prev => ({ ...prev, [s]: v }))} />
            ))}
          </div>
        </div>
      </div>
      <div className="col gap-12">
        <div className="card card-pad col gap-12">
          <span className="weight-500">{t('candidate.eval.recommendation')}</span>
          <div className="seg" style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
            {["No Hire", "Lean No", "Lean Hire", "Strong Hire"].map(opt => (
              <button key={opt} className={recommendation === opt ? "on" : ""} onClick={() => setRecommendation(opt)}>{opt}</button>
            ))}
          </div>
        </div>
        <div className="card card-pad col gap-8">
          <span className="weight-500">{t('candidate.eval.notes')}</span>
          <textarea className="textarea" rows={6} placeholder={t('candidate.eval.notesPh')} value={notes} onChange={e => setNotes(e.target.value)} />
          <Btn kind="primary" icon={<Icons.Save size={14} />} style={{ alignSelf: "flex-start" }} onClick={save} disabled={saving}>
            {saving ? t('common.saving') : saved ? t('common.saved') + ' ✓' : t('candidate.eval.save')}
          </Btn>
        </div>
      </div>
    </div>
  );
};

const SkillRow = ({ label, value, onChange }) => (
  <div className="skill-row">
    <span className="text-13">{label}</span>
    <div className="skill-bar"><div className="fill" style={{ width: `${(value / 5) * 100}%` }} /></div>
    <Rating value={value} onChange={onChange} />
  </div>
);

// ── Activity Tab ──────────────────────────────────────────────────────────────

const STATUS_LABELS = Object.fromEntries(
  (window.CANDID_DATA.STATUS || []).map(s => [s.id, s.label])
);

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso.slice(0, 10); }
};

const ActivityTab = ({ c }) => {
  const raw = [
    { type: "system", when: c.appliedAt, what: "Candidate added to pipeline", sort: c.appliedAt || "0000" },
    ...(c.statusHistory || []).map(h => ({
      type: "status",
      when: h.at,
      what: `Stage moved to ${STATUS_LABELS[h.status] || h.status}`,
      who: h.by || null,
      sort: h.at,
    })),
    ...(c.pre ? [{ type: "ai", when: c.appliedAt, what: "CV analysis generated", sort: c.appliedAt || "0001" }] : []),
    ...(c.evaluation ? [{ type: "eval", when: c.appliedAt, what: "Evaluation saved", sort: c.appliedAt || "0002" }] : []),
    ...(c.interviews || []).map(iv => ({
      type: "interview",
      who: iv.interviewer,
      when: iv.date,
      what: `${iv.title || iv.type || "Interview"} recorded`,
      sort: iv.date || "0003",
    })),
  ].sort((a, b) => (b.sort || "").localeCompare(a.sort || ""));

  return (
    <div className="card">
      <div style={{ padding: 4 }}>
        {raw.map((a, i) => (
          <div key={i} className="row gap-12" style={{ padding: "12px 18px", borderBottom: i === raw.length - 1 ? 0 : "1px solid var(--border-soft)" }}>
            {a.type === "ai" || a.type === "system" || a.type === "status" || a.type === "eval"
              ? <span className="ai-tag" style={{ padding: "2px 6px", flexShrink: 0 }}>
                  {a.type === "status" ? <Icons.ArrowRight size={10} /> : <Icons.Sparkles size={10} />}
                </span>
              : <Avatar name={a.who || "Interviewer"} />}
            <div className="col" style={{ flex: 1 }}>
              <span className="text-13">{a.what}</span>
              <span className="text-12 text-muted">
                {a.who ? `${a.who} · ` : ""}{fmtDate(a.when)}
              </span>
            </div>
          </div>
        ))}
        {raw.length === 0 && (
          <div style={{ padding: "24px 18px", color: "var(--ink-muted)", fontSize: 13 }}>No activity yet.</div>
        )}
      </div>
    </div>
  );
};

window.CandidateScreen = CandidateScreen;
