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
  jobDescriptionId: c.job_description_id || null,
  jdTitle: c.jd_title || null,
  pre: c.ai_pre_analysis || null,
  analysisAt: c.analysis_at || null,
  activityLog: c.activity_log || [],
  careerHistory: c.career_history || null,
  interviews: (c.interviews || []).map(iv => ({
    id: iv.id,
    title: iv.title || iv.type,
    type: iv.type,
    date: iv.date,
    duration: iv.duration,
    interviewer: iv.interviewer,
    summary: iv.ai_summary,
    raw_content: iv.raw_content,
    cleaned_transcript: iv.cleaned_transcript,
    transcript_raw: iv.transcript_raw || null,
    transcript_status: iv.transcript_status || null,
    transcript_language: iv.transcript_language || null,
    ai_evaluation: iv.ai_evaluation ? (typeof iv.ai_evaluation === "string" ? JSON.parse(iv.ai_evaluation) : iv.ai_evaluation) : null,
  })),
  evaluation: c.evaluation || null,
  statusHistory: c.status_history || [],
});

// ── Email Modal ───────────────────────────────────────────────────────────────

const EmailModal = ({ candidate, onClose }) => {
  const t = window.useT();
  const orgName = window.CANDID_ORG?.name || "us";
  const position = candidate.jdTitle || candidate.role || "the position";
  const [subject, setSubject] = useState(`Re: ${position} at ${orgName}`);
  const [body, setBody] = useState(`Hi ${candidate.first},\n\n`);
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
      setRewriteError(t('jobs.ai.unavailable'));
    }
    setRewriting(false);
  };

  const sendEmail = async () => {
    if (!candidate.email) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`${window.API_BASE}/ai/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: candidate.email, subject, body, candidate_id: candidate.id }),
      });
      if (res.status === 503) {
        window.open(`mailto:${encodeURIComponent(candidate.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        onClose();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setSendError(err?.detail || t('candidate.email.sendFailed'));
        setSending(false);
        return;
      }
    } catch {
      setSendError(t('candidate.email.backendUnreachable'));
      setSending(false);
      return;
    }
    onClose();
  };

  return (
    <Modal open title={t('candidate.email.title').replace('{name}', `${candidate.first} ${candidate.last}`)} onClose={onClose}
      width={560}
      footer={
        <>
          {sendError && <span className="text-12" style={{ color: "var(--danger)", marginRight: "auto" }}>{sendError}</span>}
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" icon={<Icons.Mail size={14} />} onClick={sendEmail} disabled={!candidate.email || sending}>
            {sending ? t('compose.sending') : t('compose.send')}
          </Btn>
        </>
      }>
      <div className="col gap-12">
        {!candidate.email && <div className="text-12" style={{ color: "var(--warn)" }}>{t('candidate.email.noEmail')}</div>}
        <div>
          <label className="label">{t('compose.to')}</label>
          <input className="input" value={candidate.email || t('candidate.email.none')} disabled style={{ opacity: 0.6 }} />
        </div>
        <div>
          <label className="label">{t('compose.subject')}</label>
          <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ margin: 0 }}>{t('candidate.email.body')}</label>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              {rewriteError && <span className="text-12" style={{ color: "var(--danger)" }}>{rewriteError}</span>}
              <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 12 }}
                onClick={rewriteWithAI} disabled={rewriting || !body.trim()}>
                {rewriting
                  ? <span className="badge ai" style={{ padding: "1px 6px", fontSize: 10 }}><span className="dot" /> {t('compose.rewriting')}</span>
                  : <>{t('compose.rewrite')}</>}
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

  const sources = window.CANDID_DATA.SOURCES || [];

  return (
    <Modal open title={t('candidates.edit')} onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" onClick={save} disabled={saving || !first || !last}>{saving ? t('common.saving') : t('common.save')}</Btn>
        </>
      }>
      <div className="col gap-12">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="label">{t('candidates.form.first')}</label><input className="input" value={first} onChange={e => setFirst(e.target.value)} /></div>
          <div><label className="label">{t('candidates.form.last')}</label><input className="input" value={last} onChange={e => setLast(e.target.value)} /></div>
          <div><label className="label">{t('candidates.form.email')}</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label className="label">{t('candidates.form.phone')}</label><input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label className="label">{t('candidates.form.role')}</label><input className="input" value={role} onChange={e => setRole(e.target.value)} /></div>
          <div><label className="label">{t('candidates.form.location')}</label><input className="input" value={location} onChange={e => setLocation(e.target.value)} /></div>
          <div><label className="label">{t('candidates.form.experience')}</label><input className="input" type="number" min={0} value={experience} onChange={e => setExperience(e.target.value)} /></div>
          <div>
            <label className="label">{t('candidates.form.source')}</label>
            <select className="select" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">—</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {!isPrePipeline(candidate) && (
          <div>
            <label className="label">{t('candidates.form.stage')}</label>
            <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
              {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ── Rejection Modal ───────────────────────────────────────────────────────────

const RejectionModal = ({ candidate, onClose, onRejected }) => {
  const t = window.useT();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const draftRejection = async () => {
    setDrafting(true);
    setDraftError("");
    try {
      const res = await fetch(`${window.API_BASE}/candidates/${candidate.id}/rejection-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_title: candidate.role || "", notes: "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSubject(data.subject);
      setBody(data.body);
    } catch {
      setDraftError(t('jobs.ai.unavailable'));
    }
    setDrafting(false);
  };

  const reject = async (sendEmail) => {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`${window.API_BASE}/candidates/${candidate.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, send_email: sendEmail }),
      });
      if (!res.ok) throw new Error(await res.text());
      onRejected();
      onClose();
    } catch {
      setSendError(t('candidate.reject.failed'));
      setSending(false);
    }
  };

  return (
    <Modal open title={t('candidate.reject.title').replace('{name}', `${candidate.first} ${candidate.last}`)} onClose={onClose} width={560}
      footer={
        <>
          {sendError && <span className="text-12" style={{ color: "var(--danger)", marginRight: "auto" }}>{sendError}</span>}
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn onClick={() => reject(false)} disabled={sending}>
            {t('candidate.reject.withoutEmail')}
          </Btn>
          <Btn kind="danger" icon={<Icons.Mail size={14} />} onClick={() => reject(true)} disabled={sending || !body.trim() || !candidate.email}>
            {sending ? t('compose.sending') : t('candidate.reject.sendAndReject')}
          </Btn>
        </>
      }>
      <div className="col gap-12">
        {!candidate.email && (
          <div className="text-12" style={{ color: "var(--warn)" }}>{t('candidate.reject.noEmail')}</div>
        )}
        <div>
          <label className="label">{t('compose.subject')}</label>
          <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="label" style={{ margin: 0 }}>{t('candidate.email.body')}</label>
                <div className="row gap-8" style={{ alignItems: "center" }}>
                  {draftError && <span className="text-12" style={{ color: "var(--danger)" }}>{draftError}</span>}
                  <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 12 }}
                    onClick={draftRejection} disabled={drafting}>
                    {drafting
                      ? <span className="badge ai" style={{ padding: "1px 6px", fontSize: 10 }}><span className="dot" /> {t('roles.modal.generating')}</span>
                      : <><Icons.Sparkles size={12} /> {t('candidate.ai.generate')}</>}
                  </button>
                </div>
              </div>
              <textarea className="textarea" rows={9} value={body} onChange={e => setBody(e.target.value)} placeholder={t('candidate.reject.bodyPh')} />
            </div>
      </div>
    </Modal>
  );
};

const TERMINAL_STATUSES = new Set(["Rejected", "hired"]);
const isPrePipeline = (c) => !c.jobDescriptionId && !TERMINAL_STATUSES.has(c.status);
const isInPipeline  = (c) => !!c.jobDescriptionId && !TERMINAL_STATUSES.has(c.status);
const isTerminal    = (c) => TERMINAL_STATUSES.has(c.status);

// ── Assign Job Modal ──────────────────────────────────────────────────────────

const AssignJobModal = ({ candidateId, onClose, onAssigned }) => {
  const t = window.useT();
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setJobs(data); setLoadingJobs(false); })
      .catch(() => setLoadingJobs(false));
  }, []);

  const assign = async () => {
    if (!selectedJobId) return;
    setSaving(true);
    try {
      await fetch(`${window.API_BASE}/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description_id: selectedJobId }),
      });
      onAssigned();
    } catch { /* offline */ }
    setSaving(false);
  };

  return (
    <Modal open title={t('assignJob.title')} onClose={onClose} width={480}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" onClick={assign} disabled={saving || !selectedJobId || loadingJobs}>
            {saving ? t('assignJob.saving') : t('assignJob.confirm')}
          </Btn>
        </>
      }>
      <div className="col gap-12">
        {loadingJobs ? (
          <span className="text-13 text-muted">{t('assignJob.loading')}</span>
        ) : jobs.length === 0 ? (
          <span className="text-13 text-muted">{t('assignJob.noJobs')}</span>
        ) : (
          <div>
            <label className="label">{t('candidates.col.position')}</label>
            <select className="select" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
              <option value="">{t('assignJob.selectPh')}</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}{j.department ? ` · ${j.department}` : ""}</option>
              ))}
            </select>
          </div>
        )}
        <p className="text-12 text-muted" style={{ margin: 0 }}>{t('assignJob.hint')}</p>
      </div>
    </Modal>
  );
};

const CandidateScreen = ({ id, onRoute, initialTab, onMount }) => {
  const t = window.useT();
  const [c, setC] = useState({ id: null, first: "", last: "", email: null, phone: null, role: null, experience: null, location: null, status: "new", source: null, pre: null, interviews: [], evaluation: null, score: null, cvText: null, jobDescriptionId: null, jdTitle: null });
  const [tab, setTab] = useState(initialTab || "overview");
  const [loading, setLoading] = useState(true);
  const [hiring, setHiring] = useState(false);
  const [hired, setHired] = useState(false);
  const [hireConfirmOpen, setHireConfirmOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assignJobOpen, setAssignJobOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    onMount && onMount();
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

  const changeStatus = async (newStatus) => {
    setC(prev => ({ ...prev, status: newStatus }));
    await fetch(`${window.API_BASE}/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => refreshCandidate());
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
          candidate_id: id,
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
    { id: "video",       label: t('candidate.tab.video') },
    { id: "evaluation",  label: t('candidate.tab.evaluation') },
    { id: "activity",    label: t('candidate.tab.activity') },
    { id: "emails",      label: t('candidate.tab.emails') },
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
            {c.jdTitle && (
              <div className="row gap-6 mt-4" style={{ alignItems: "center" }}>
                <Icons.Briefcase size={13} style={{ color: "var(--ai)" }} />
                <span className="text-13 weight-500" style={{ color: "var(--ai)" }}>{c.jdTitle}</span>
              </div>
            )}
            <div className="row gap-12 mt-8">
              {c.email && <span className="row gap-6 text-12 text-secondary"><Icons.Mail size={12} />{c.email}</span>}
              {c.phone && <span className="row gap-6 text-12 text-secondary"><Icons.Phone size={12} />{c.phone}</span>}
              {c.experience != null && <span className="row gap-6 text-12 text-secondary"><Icons.Briefcase size={12} />{t('candidate.experienceYears').replace('{n}', c.experience)}</span>}
              {c.source && <span className="row gap-6 text-12 text-secondary"><Icons.User size={12} />{c.source}</span>}
            </div>
          </div>
        </div>
        <div className="row gap-8">
          {isTerminal(c) ? (
            <Btn icon={<Icons.RotateCcw size={14} />} onClick={() => setReactivateOpen(true)}>{t('candidate.action.reactivate')}</Btn>
          ) : isPrePipeline(c) ? (
            <>
              <Btn icon={<Icons.Edit size={14} />} onClick={() => setEditOpen(true)}>{t('common.edit')}</Btn>
              <Btn icon={<Icons.Mail size={14} />} onClick={() => setEmailOpen(true)}>{t('candidate.email')}</Btn>
              <Btn kind="primary" icon={<Icons.Briefcase size={14} />} onClick={() => setAssignJobOpen(true)}>{t('candidate.action.assignToJob')}</Btn>
            </>
          ) : (
            <>
              <Btn icon={<Icons.Edit size={14} />} onClick={() => setEditOpen(true)}>{t('common.edit')}</Btn>
              <Btn icon={<Icons.Mail size={14} />} onClick={() => setEmailOpen(true)}>{t('candidate.email')}</Btn>
              <Btn icon={<Icons.Calendar size={14} />} onClick={() => setScheduleOpen(true)}>{t('candidate.schedule')}</Btn>
              <Btn icon={<Icons.X size={14} />} onClick={() => setRejectOpen(true)}>{t('candidates.reject.confirm')}</Btn>
            </>
          )}
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
          {isInPipeline(c) && (
            <>
              {c.status === "offer" && !hired && (
                <Btn kind="primary" icon={<Icons.UserCheck size={14} />} onClick={() => setHireConfirmOpen(true)} disabled={hiring}>
                  {hiring ? t('common.saving') : t('candidate.action.hire')}
                </Btn>
              )}
              {hired && <Badge kind="positive"><Icons.Check size={11} /> {t('candidate.movedToEmployees')}</Badge>}
              <Btn kind="primary" icon={<Icons.Mic size={14} />} onClick={() => onRoute("liveroom", { candidateName: `${c.first} ${c.last}`, candidateId: c.id, title: "Interview", type: "Live" })}>{t('candidate.startInterview')}</Btn>
            </>
          )}
        </div>
      </div>

      {hireConfirmOpen && (
        <ConfirmDialog
          title={t('candidate.hire.title')}
          message={`${t('candidate.hire.messagePre')} ${fullName} ${t('candidate.hire.messagePost')}`}
          confirmLabel={t('candidate.hire.confirm')}
          onConfirm={() => { setHireConfirmOpen(false); convertToEmployee(); }}
          onCancel={() => setHireConfirmOpen(false)}
        />
      )}

      {reactivateOpen && (
        <ConfirmDialog
          title={t('candidate.reactivate.title')}
          message={`${t('candidate.reactivate.messagePre')} ${fullName} ${t('candidate.reactivate.messagePost')}`}
          confirmLabel={t('candidate.reactivate.confirm')}
          onConfirm={async () => {
            setReactivateOpen(false);
            await fetch(`${window.API_BASE}/candidates/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "new", job_description_id: null }),
            }).catch(() => {});
            refreshCandidate();
          }}
          onCancel={() => setReactivateOpen(false)}
        />
      )}

      {c.status === "hired" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--success-soft, #f0fdf4)", border: "1px solid var(--success, #22c55e)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "var(--success-dark, #15803d)", fontSize: 13 }}>
          <Icons.Check size={15} />
          <span>{t('candidate.banner.hired')} <strong>{t('candidate.banner.reactivateSuffix')}</strong></span>
        </div>
      )}

      {c.status === "Rejected" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--danger-soft, #fef2f2)", border: "1px solid var(--danger, #ef4444)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "var(--danger, #dc2626)", fontSize: 13 }}>
          <Icons.X size={15} />
          <span>{t('candidate.banner.rejected')} <strong>{t('candidate.banner.reactivateSuffix')}</strong></span>
        </div>
      )}

      {isPrePipeline(c) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--info-soft, #eff6ff)", border: "1px solid var(--info, #3b82f6)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "var(--info-dark, #1d4ed8)", fontSize: 13 }}>
          <Icons.Briefcase size={15} />
          <span>{t('candidate.banner.prePipeline')} <strong>{t('candidate.banner.assignSuffix')}</strong></span>
        </div>
      )}

      {(() => {
        const evalScores = [];
        if (c.evaluation) {
          for (const skillMap of [c.evaluation.human_skills, c.evaluation.technical_skills]) {
            if (skillMap) Object.values(skillMap).forEach(v => { if (typeof v === "number" && v > 0) evalScores.push(v); });
          }
        }
        const evalAvg = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
        if (c.score == null && evalAvg == null) return null;
        return (
          <div className="card" style={{ padding: 0, display: "grid", gridTemplateColumns: `repeat(${c.score != null && evalAvg != null ? 5 : 4}, 1fr)`, marginBottom: 20 }}>
            {c.score != null && <Stat label={t('candidate.stat.score')} value={c.score.toFixed(1)} unit="/ 5" />}
            {evalAvg != null && <Stat label={t('candidate.stat.evalAvg')} value={evalAvg.toFixed(1)} unit="/ 5" />}
            <Stat label={t('candidate.stat.interviews')} value={String((c.interviews || []).length)} sub={t('candidate.stat.completed')} />
            <Stat label={t('candidate.stat.recommendation')} value={c.evaluation?.final_recommendation || t('common.pending')} mono={false} />
            <Stat label={t('candidate.stat.stage')} value={window.CANDID_DATA.STATUS.find(s => s.id === c.status)?.label || c.status} small />
          </div>
        );
      })()}

      <div className="tabs">
        {TABS.map(tb => (
          <button key={tb.id} className={`tab ${tab === tb.id ? "active" : ""}`} onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview"    && <OverviewTab c={c} onTab={setTab} onStatusChange={isInPipeline(c) ? changeStatus : null} t={t} />}
      {tab === "cv-analysis" && <CVAnalysisTab c={c} t={t} onRefresh={refreshCandidate} />}
      {tab === "interviews"  && <InterviewsTab c={c} onRoute={onRoute} onRefresh={refreshCandidate} t={t} />}
      {tab === "video"       && <VideoInterviewsTab c={c} />}
      {tab === "evaluation"  && <EvaluationTab c={c} onSaved={refreshCandidate} t={t} />}
      {tab === "activity"    && <ActivityTab c={c} />}
      {tab === "emails"      && <EmailsTab candidateId={c.id} />}

      {scheduleOpen && (
        <window.ScheduleModal
          initialCandidateId={c.id}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => { setScheduleOpen(false); refreshCandidate(); }}
        />
      )}
      {emailOpen && <EmailModal candidate={c} onClose={() => setEmailOpen(false)} />}
      {editOpen && (
        <EditCandidateModal
          candidate={c}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); refreshCandidate(); }}
        />
      )}
      {rejectOpen && (
        <RejectionModal
          candidate={c}
          onClose={() => setRejectOpen(false)}
          onRejected={() => { setC(prev => ({ ...prev, status: "Rejected" })); refreshCandidate(); }}
        />
      )}
      {assignJobOpen && (
        <AssignJobModal
          candidateId={id}
          onClose={() => setAssignJobOpen(false)}
          onAssigned={() => { setAssignJobOpen(false); refreshCandidate(); }}
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

const PipelineTracker = ({ status, onStatusChange, t }) => {
  const stages = window.CANDID_DATA.STATUS;
  const myIdx = stages.findIndex(s => s.id === status);
  const currentStage = stages[myIdx];

  return (
    <div className="card card-pad">
      <div style={{ marginBottom: 16 }}>
        <span className="weight-600" style={{ fontSize: 13 }}>{t('candidate.overview.pipeline')}</span>
        {onStatusChange && (
          <span className="text-11 text-muted" style={{ marginLeft: 8 }}>{t('candidate.overview.clickStage')}</span>
        )}
      </div>
      <div style={{ position: "relative", padding: "0 0 8px" }}>
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, height: 2, background: "var(--border)", zIndex: 0 }} />
        {myIdx > 0 && (
          <div style={{
            position: "absolute", top: 12, left: 12, height: 2, zIndex: 1,
            background: currentStage?.dot || "var(--ai)",
            width: `calc(${(myIdx / Math.max(stages.length - 1, 1)) * 100}% - 12px)`,
            transition: "width 0.4s ease",
          }} />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
          {stages.map((s, i) => {
            const done = i < myIdx;
            const here = i === myIdx;
            return (
              <div
                key={s.id}
                className="col"
                style={{ alignItems: "center", gap: 8, flex: 1, cursor: onStatusChange && !here ? "pointer" : "default" }}
                onClick={() => onStatusChange && !here && onStatusChange(s.id)}
                title={onStatusChange && !here ? t('candidate.overview.moveTo').replace('{stage}', s.label) : undefined}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 999,
                  background: done ? s.dot : here ? s.dot : "var(--surface)",
                  border: `2px solid ${done || here ? s.dot : "var(--border)"}`,
                  display: "grid", placeItems: "center",
                  boxShadow: here ? `0 0 0 3px ${s.dot}33` : "none",
                  transition: "all 0.2s",
                }}>
                  {done
                    ? <Icons.Check size={11} style={{ color: "white" }} />
                    : here
                    ? <span style={{ width: 7, height: 7, borderRadius: 999, background: "white" }} />
                    : <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--border)" }} />
                  }
                </div>
                <span style={{
                  fontSize: 10, textAlign: "center", lineHeight: 1.3, maxWidth: 64,
                  fontWeight: here ? 700 : 400,
                  color: here ? "var(--ink)" : done ? "var(--ink-secondary)" : "var(--ink-muted)",
                }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const OverviewTab = ({ c, onTab, onStatusChange, t }) => (
  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 20 }}>
    <div className="col gap-16">

      {/* Pipeline — only for in-pipeline candidates */}
      {isInPipeline(c) && <PipelineTracker status={c.status} onStatusChange={onStatusChange} t={t} />}

      {/* Career history */}
      {c.careerHistory?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('candidate.overview.careerHistory')}</span>
            <span className="text-12 text-muted">{t(c.careerHistory.length !== 1 ? 'candidate.overview.positionsCount' : 'candidate.overview.positionCount').replace('{n}', c.careerHistory.length)}</span>
          </div>
          <div className="col" style={{ padding: "4px 0 8px" }}>
            {c.careerHistory.map((role, i) => {
              const isLast = i === c.careerHistory.length - 1;
              return (
                <div key={i} className="row gap-0" style={{ alignItems: "stretch" }}>
                  <div className="col" style={{ alignItems: "center", width: 40, flexShrink: 0, paddingTop: 16 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--ai)", flexShrink: 0, zIndex: 1 }} />
                    {!isLast && <div style={{ width: 1, flex: 1, background: "var(--border-soft)", marginTop: 4 }} />}
                  </div>
                  <div className="col" style={{ flex: 1, minWidth: 0, padding: `14px 20px 14px 0`, borderBottom: isLast ? "none" : "1px solid var(--border-soft)" }}>
                    <div className="row gap-8" style={{ alignItems: "baseline", flexWrap: "wrap", marginBottom: 2 }}>
                      <span className="weight-600" style={{ fontSize: 13.5 }}>{role.title}</span>
                      {role.company && <span className="text-12" style={{ color: "var(--ink-secondary)" }}>{role.company}</span>}
                    </div>
                    {role.period && (
                      <span className="text-11 text-mono text-muted" style={{ letterSpacing: "0.02em", marginBottom: role.description ? 6 : 0 }}>{role.period}</span>
                    )}
                    {role.description && (
                      <span className="text-12 text-secondary" style={{ lineHeight: 1.55, marginTop: 4 }}>{role.description}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

    <div className="col gap-16">
      {/* Contact */}
      {(c.email || c.phone) && (
        <div className="card card-pad col gap-8">
          <span className="weight-600" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-muted)" }}>{t('candidate.overview.contact')}</span>
          {c.email && (
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <Icons.Mail size={13} style={{ color: "var(--ink-muted)", flexShrink: 0 }} />
              <a href={`mailto:${encodeURIComponent(c.email)}`} className="text-13 link" style={{ wordBreak: "break-all" }}>{c.email}</a>
            </div>
          )}
          {c.phone && (
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <Icons.Phone size={13} style={{ color: "var(--ink-muted)", flexShrink: 0 }} />
              <span className="text-13">{c.phone}</span>
            </div>
          )}
        </div>
      )}

      {/* AI summary */}
      {c.pre ? (
        <div className="ai-panel card-pad">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <span className="ai-tag"><Icons.Sparkles size={11} /> {t('candidate.overview.aiSummary')}</span>
            <button className="link text-12" onClick={() => onTab("cv-analysis")}>{t('candidate.overview.fullAnalysis')}</button>
          </div>
          <div className="text-13" style={{ lineHeight: 1.6 }}>
            {c.pre.overview || c.pre.strengths?.[0] || t('candidate.overview.analysisCompleted')}
          </div>
        </div>
      ) : (
        <div className="card card-pad" style={{ textAlign: "center", padding: 40 }}>
          <Icons.Sparkles size={22} style={{ color: "var(--ai)", marginBottom: 8 }} />
          <div className="weight-600">{t('candidate.overview.noAnalysis')}</div>
          <div className="text-13 text-secondary" style={{ marginBottom: 14, marginTop: 4 }}>{t('candidate.overview.goToCv')}</div>
          <Btn kind="ai" icon={<Icons.Upload size={14} />} onClick={() => onTab("cv-analysis")}>{t('candidate.overview.runAnalysis')}</Btn>
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
      setError(t('candidate.cv.analysisFailed').replace('{error}', err.message));
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
      onRefresh && onRefresh(); // update hasCvFile immediately
      await runAnalysis(data.text);
    } catch (err) {
      setError(t('quickadd.uploadError').replace('{error}', err.message));
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
          <span className="ai-tag" style={{ display: "inline-flex" }}><Icons.Sparkles size={11} /> {t('candidate.cv.aiOverview')}</span>
          <div className="text-13" style={{ lineHeight: 1.6 }}>
            {c.pre?.overview || <span className="text-muted">{t('candidate.cv.noAnalysis')}</span>}
          </div>
        </div>
        <div className="col gap-6" style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{ display: "none" }} onChange={handleFileChange} />
          {!displayCvText ? (
            <Btn kind="ai" icon={<Icons.Upload size={14} />} disabled={busy} onClick={() => fileInputRef.current?.click()}>
              {stage === "uploading" ? t('quickadd.uploading') : t('candidate.cv.upload')}
            </Btn>
          ) : (
            <Btn kind="ai" icon={<Icons.Sparkles size={14} />} disabled={busy} onClick={() => runAnalysis()}>
              {stage === "analyzing" ? t('candidate.cv.analyzing') : c.pre ? t('candidate.cv.rerun') : t('candidate.cv.run')}
            </Btn>
          )}
          {displayCvText && (
            <button className="text-12 text-muted link" onClick={() => fileInputRef.current?.click()}>
              {stage === "uploading" ? t('quickadd.uploading') : t('candidate.cv.replace')}
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
                  <span className="card-title">{t('candidate.cv.roleFit')}</span>
                  <span className="card-sub">{t('candidate.cv.roleFitSub')}</span>
                  <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 11, marginLeft: "auto" }}
                    disabled={busy} onClick={() => runAnalysis()}>
                    <Icons.RotateCcw size={11} /> {stage === "analyzing" ? t('candidate.cv.retesting') : t('candidate.cv.retest')}
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
                  <span className="card-title">{t('candidate.cv.cvText')}</span>
                  <span className="card-sub">{t('candidate.cv.words').replace('{n}', displayCvText.split(/\s+/).filter(Boolean).length)}</span>
                  <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 11, marginLeft: "auto" }}
                    onClick={() => setCvModalOpen(true)}>
                    <Icons.Eye size={11} /> {t('candidate.cv.view')}
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
            <div className="weight-500">{t('candidate.cv.noCv')}</div>
            <div className="text-13 text-secondary mt-4" style={{ marginBottom: 14 }}>{t('candidate.cv.noCvHint')}</div>
            <Btn kind="ai" icon={<Icons.Upload size={14} />} onClick={() => fileInputRef.current?.click()}>{t('candidate.cv.upload')}</Btn>
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
              <span className="card-sub">{t('candidate.cv.words').replace('{n}', displayCvText.split(/\s+/).filter(Boolean).length)}</span>
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

// ── Transcript Status Badge ───────────────────────────────────────────────────

const TranscriptStatusBadge = ({ status }) => {
  const t = window.useT();
  if (!status) return null;
  const configByStatus = {
    pending:    { kind: "neutral", label: t('common.pending') },
    processing: { kind: "ai",     label: t('candidate.iv.processing') },
    done:       { kind: "positive", label: t('candidate.iv.transcribed') },
    failed:     { kind: "danger", label: t('candidate.iv.failed') },
  };
  const config = configByStatus[status] || { kind: "neutral", label: status };
  return <Badge kind={config.kind}>{config.label}</Badge>;
};

// ── AI Evaluation Card ────────────────────────────────────────────────────────

const AiEvaluationCard = ({ evaluation }) => {
  const t = window.useT();
  if (!evaluation) return null;

  const recommendationColors = {
    strong_yes: "var(--positive)",
    yes:        "var(--ai)",
    maybe:      "var(--warn)",
    no:         "var(--danger)",
  };
  const recommendationColor = recommendationColors[evaluation.recommendation] || "var(--ink-secondary)";
  const scorePercent = Math.round(((evaluation.score || 0) / 10) * 100);

  return (
    <div className="ai-panel col gap-12" style={{ marginTop: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="ai-tag"><Icons.Sparkles size={11} /> {t('candidate.iv.aiEvaluation')}</span>
        <div className="row gap-10" style={{ alignItems: "center" }}>
          {evaluation.recommendation && (
            <span className="text-12 weight-600" style={{ color: recommendationColor, textTransform: "capitalize" }}>
              {evaluation.recommendation.replace("_", " ")}
            </span>
          )}
          {evaluation.score != null && (
            <span className="text-12 text-mono weight-600">{evaluation.score}/10</span>
          )}
        </div>
      </div>

      {evaluation.score != null && (
        <div style={{ height: 5, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${scorePercent}%`, background: scorePercent >= 70 ? "var(--positive)" : scorePercent >= 40 ? "var(--warn)" : "var(--danger)", borderRadius: 999, transition: "width 0.4s ease" }} />
        </div>
      )}

      {evaluation.summary && (
        <div className="text-13" style={{ lineHeight: 1.6, color: "var(--ink-secondary)" }}>{evaluation.summary}</div>
      )}

      {evaluation.strengths?.length > 0 && (
        <div>
          <div className="text-12 weight-600" style={{ marginBottom: 4, color: "var(--positive)" }}>{t('candidate.cv.strengths')}</div>
          <ul className="ai-list strengths">
            {evaluation.strengths.map((strength, index) => (
              <li key={index}><span className="marker"><Icons.Check size={11} /></span><span className="text-12">{strength}</span></li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.concerns?.length > 0 && (
        <div>
          <div className="text-12 weight-600" style={{ marginBottom: 4, color: "var(--warn)" }}>{t('candidate.iv.concerns')}</div>
          <ul className="ai-list weaknesses">
            {evaluation.concerns.map((concern, index) => (
              <li key={index}><span className="marker"><Icons.X size={11} /></span><span className="text-12">{concern}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Interview Card ────────────────────────────────────────────────────────────

const InterviewCard = ({ interview, onOpenTranscript, onUploadRecording, onRefresh, t }) => {
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const audioInputRef = useRef(null);
  const hasWhisperTranscript = interview.transcript_status === "done" && interview.transcript_raw;

  const handleFileSelected = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    await onUploadRecording(interview.id, selectedFile, onRefresh);
    event.target.value = "";
  };

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-pad row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="row gap-12">
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-sunken)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icons.Mic size={16} />
          </div>
          <div className="col">
            <div className="row gap-8" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <span className="weight-500">{interview.title || interview.type}</span>
              <Badge>{interview.type}</Badge>
              {interview.transcript_status && <TranscriptStatusBadge status={interview.transcript_status} />}
            </div>
            <span className="text-12 text-muted">
              {[interview.date, interview.duration && `${interview.duration}`, interview.interviewer && t('interviews.withInterviewer').replace('{name}', interview.interviewer)].filter(Boolean).join(" · ")}
            </span>
            {interview.summary && (
              <span className="text-13 text-secondary" style={{ marginTop: 4, lineHeight: 1.5 }}>{interview.summary}</span>
            )}
          </div>
        </div>
        <div className="row gap-8">
          <input ref={audioInputRef} type="file" accept=".mp3,.mp4,.wav,.webm,.m4a" style={{ display: "none" }} onChange={handleFileSelected} />
          <Btn icon={<Icons.Upload size={13} />} onClick={() => audioInputRef.current?.click()}>
            {interview.transcript_status === "processing" ? t('candidate.iv.processing') : t('candidate.iv.uploadRecording')}
          </Btn>
          <Btn onClick={() => onOpenTranscript(interview)}>{t('common.open')}</Btn>
        </div>
      </div>

      {hasWhisperTranscript && (
        <div style={{ borderTop: "1px solid var(--border-soft)" }}>
          <button
            className="row gap-8 text-12 text-secondary"
            style={{ width: "100%", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            onClick={() => setTranscriptExpanded(prev => !prev)}
          >
            <Icons.ChevronRight size={12} style={{ transform: transcriptExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            {t('candidate.iv.transcript')}
            {interview.transcript_language && (
              <span className="text-11 text-mono text-muted" style={{ marginLeft: 4 }}>[{interview.transcript_language}]</span>
            )}
          </button>
          {transcriptExpanded && (
            <div style={{ padding: "0 16px 14px", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, color: "var(--ink-secondary)", whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto" }}>
              {interview.transcript_raw}
            </div>
          )}
        </div>
      )}

      {interview.transcript_status === "done" && interview.ai_evaluation && (
        <div style={{ borderTop: "1px solid var(--border-soft)", padding: "0 16px 14px" }}>
          <AiEvaluationCard evaluation={interview.ai_evaluation} />
        </div>
      )}
    </div>
  );
};

// ── Transcript View Modal ─────────────────────────────────────────────────────

const TranscriptViewModal = ({ interview, onClose, t }) => {
  const [activeSection, setActiveSection] = useState(
    interview.cleaned_transcript ? "cleaned" : interview.raw_content ? "raw" : "summary"
  );

  const sections = [
    interview.raw_content      && { id: "raw",     label: t('candidate.iv.rawLabel') },
    interview.cleaned_transcript && { id: "cleaned", label: t('candidate.iv.cleaned') },
    interview.summary           && { id: "summary",  label: t('candidate.iv.synthesis') },
  ].filter(Boolean);

  const content = {
    raw:     interview.raw_content,
    cleaned: interview.cleaned_transcript,
    summary: interview.summary,
  }[activeSection];

  return (
    <Modal open title={interview.title || interview.type || t('candidate.iv.transcript')} onClose={onClose} width={760} disableBackdropClose={false}
      footer={<Btn onClick={onClose}>{t('common.close')}</Btn>}>
      {sections.length > 1 && (
        <div className="row gap-4" style={{ marginBottom: 16, borderBottom: "1px solid var(--border-soft)", paddingBottom: 12 }}>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`tab ${activeSection === s.id ? "active" : ""}`}
              style={{ fontSize: 13 }}
            >{s.label}</button>
          ))}
        </div>
      )}
      {content ? (
        activeSection === "summary" ? (
          <div className="ai-panel card-pad" style={{ maxHeight: 520, overflowY: "auto" }}>
            <div className="row gap-6" style={{ marginBottom: 10 }}>
              <span className="ai-tag"><Icons.Sparkles size={11} /> {t('candidate.iv.synthesis')}</span>
            </div>
            <div className="text-13" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</div>
          </div>
        ) : (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.75, whiteSpace: "pre-wrap", color: "var(--ink-secondary)", maxHeight: 520, overflowY: "auto" }}>
            {content}
          </div>
        )
      ) : (
        <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>{t('candidate.iv.noTranscript')}</div>
      )}
    </Modal>
  );
};

// ── Interviews Tab ────────────────────────────────────────────────────────────

const InterviewsTab = ({ c, onRoute, onRefresh, t }) => {
  const [creating, setCreating] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [title, setTitle] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [saving, setSaving] = useState(false);
  const [transcriptInterview, setTranscriptInterview] = useState(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => { onRefresh(); }, []);

  const addInterview = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${window.API_BASE}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: c.id, title, interviewer, raw_content: rawContent, type: "Manual Paste" }),
      });
      if (response.ok) { onRefresh(); setCreating(false); setRawContent(""); setTitle(""); setInterviewer(""); }
    } catch { /* offline */ }
    setSaving(false);
  };

  const uploadRecording = async (interviewId, selectedFile, afterUpload) => {
    setUploadError("");
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const response = await fetch(`${window.API_BASE}/interviews/${interviewId}/upload-audio`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(await response.text());
      afterUpload && afterUpload();
    } catch (uploadException) {
      setUploadError(t('quickadd.uploadError').replace('{error}', uploadException.message));
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const allInterviews = c.interviews || [];
  const upcoming = allInterviews.filter(iv => iv.date && iv.date >= today);
  const past = allInterviews.filter(iv => !iv.date || iv.date < today);

  const renderInterviews = (list) => list.map(interview => (
    <InterviewCard
      key={interview.id}
      interview={interview}
      onOpenTranscript={setTranscriptInterview}
      onUploadRecording={uploadRecording}
      onRefresh={onRefresh}
      t={t}
    />
  ));

  return (
    <div className="col gap-12">
      {uploadError && (
        <div className="text-12" style={{ color: "var(--danger)", padding: "8px 0" }}>{uploadError}</div>
      )}

      {upcoming.length > 0 && (
        <div className="col gap-8">
          <span className="text-11 weight-600 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{t('interviews.upcoming')}</span>
          {renderInterviews(upcoming)}
        </div>
      )}

      {past.length > 0 && (
        <div className="col gap-8">
          <span className="text-11 weight-600 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{t('interviews.past')}</span>
          {renderInterviews(past)}
        </div>
      )}

      {creating ? (
        <div className="card card-pad col gap-10">
          <span className="weight-500">{t('candidate.iv.addTitle')}</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="label">{t('candidate.iv.title')}</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Recruiter Screen" /></div>
            <div><label className="label">{t('candidate.iv.interviewer')}</label><input className="input" value={interviewer} onChange={e => setInterviewer(e.target.value)} placeholder={t('candidate.iv.interviewerPh')} /></div>
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

      {transcriptInterview && (
        <TranscriptViewModal interview={transcriptInterview} onClose={() => setTranscriptInterview(null)} t={t} />
      )}
    </div>
  );
};

// ── Video interviews Tab ──────────────────────────────────────────────────────
// Recruiter side of async video interviews: the candidate records answers at #video/<token>.

const VIDEO_STATUS_BADGE = { pending: "neutral", in_progress: "warn", completed: "positive", expired: "danger" };

const videoInviteUrl = (iv) => new URL(iv.invite_link, window.location.href.split("#")[0]).href;

// <video> cannot send the bearer token, so the answer is fetched as a blob (the fetch interceptor adds auth).
const VideoAnswerPlayer = ({ interviewId, response }) => {
  const t = window.useT();
  const [src, setSrc] = React.useState(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let objectUrl = null;
    fetch(`${window.API_BASE}/video-interviews/${interviewId}/responses/${response.id}/video`)
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); })
      .catch(() => setFailed(true));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [interviewId, response.id]);

  if (failed) return <span className="text-12 text-muted">{t('candidate.video.noRecording')}</span>;
  if (!src) return <span className="text-12 text-muted">{t('common.loading')}</span>;
  return <video src={src} controls preload="metadata" style={{ width: "100%", maxWidth: 560, borderRadius: 8, background: "#000" }} />;
};

const VideoInterviewCard = ({ interview, candidate }) => {
  const t = window.useT();
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [notice, setNotice] = React.useState("");
  const questions = JSON.parse(interview.questions || "[]");
  const url = videoInviteUrl(interview);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      fetch(`${window.API_BASE}/video-interviews/${interview.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(setDetail)
        .catch(() => {});
    }
  };

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(""), 2500); };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); flash(t('candidate.video.copied')); } catch { flash(url); }
  };

  const emailLink = async () => {
    const res = await fetch(`${window.API_BASE}/ai/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: candidate.email,
        candidate_id: candidate.id,
        subject: t('candidate.video.emailSubject').replace('{org}', window.CANDID_ORG?.name || "Candid"),
        body: t('candidate.video.emailBody').replace('{name}', candidate.first).replace('{url}', url),
      }),
    }).catch(() => null);
    flash(res && res.ok ? t('candidate.video.emailSent') : t('candidate.video.emailFailed'));
  };

  const responseFor = (index) => (detail?.responses || []).find(r => r.question_index === index);

  return (
    <div className="card card-pad col gap-10">
      <div className="row gap-10" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <Icons.Play size={14} />
        <span className="weight-500">{t('candidate.video.questionsCount').replace('{n}', questions.length)}</span>
        <Badge kind={VIDEO_STATUS_BADGE[interview.status] || "neutral"}>{t(`candidate.video.status.${interview.status}`)}</Badge>
        <span className="text-12 text-muted">{t('candidate.video.expires').replace('{date}', window.formatDate ? window.formatDate(interview.expires_at) : interview.expires_at.slice(0, 10))}</span>
        <div className="row gap-6" style={{ marginLeft: "auto" }}>
          <Btn size="sm" icon={<Icons.Copy size={12} />} onClick={copyLink}>{t('candidate.video.copyLink')}</Btn>
          {candidate.email && <Btn size="sm" icon={<Icons.Mail size={12} />} onClick={emailLink}>{t('candidate.video.sendEmail')}</Btn>}
          <Btn size="sm" icon={open ? <Icons.ChevronDown size={12} /> : <Icons.ChevronRight size={12} />} onClick={toggle}>{t('candidate.video.answers')}</Btn>
        </div>
      </div>
      {notice && <span className="text-12 text-secondary">{notice}</span>}
      {open && (
        <div className="col gap-12" style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 12 }}>
          {questions.map((question, index) => {
            const response = responseFor(index);
            return (
              <div key={index} className="col gap-6">
                <span className="text-13 weight-500">{index + 1}. {question}</span>
                {response && response.received_chunks > 0
                  ? <VideoAnswerPlayer interviewId={interview.id} response={response} />
                  : <span className="text-12 text-muted">{t('candidate.video.notAnswered')}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const VideoInterviewsTab = ({ c }) => {
  const t = window.useT();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [questionsText, setQuestionsText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`${window.API_BASE}/video-interviews?candidate_id=${encodeURIComponent(c.id)}`)
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [c.id]);

  React.useEffect(() => { load(); }, [load]);

  const questions = questionsText.split("\n").map(q => q.trim()).filter(Boolean);

  const create = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`${window.API_BASE}/video-interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: c.id, questions }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCreating(false); setQuestionsText(""); load();
    } catch (err) {
      setError(t('candidate.video.createFailed').replace('{error}', err.message));
    }
    setSaving(false);
  };

  return (
    <div className="col gap-12">
      {loading && <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-muted)", fontSize: 13 }}>{t('common.loading')}</div>}
      {!loading && items.map(iv => <VideoInterviewCard key={iv.id} interview={iv} candidate={c} />)}

      {creating ? (
        <div className="card card-pad col gap-10">
          <span className="weight-500">{t('candidate.video.newTitle')}</span>
          <div>
            <label className="label">{t('candidate.video.questionsLabel')}</label>
            <textarea className="textarea" rows={5} value={questionsText} onChange={e => setQuestionsText(e.target.value)} placeholder={t('candidate.video.questionsPh')} />
            <span className="text-12 text-muted">{t('candidate.video.questionsHint')}</span>
          </div>
          {error && <span className="text-12" style={{ color: "var(--danger)" }}>{error}</span>}
          <div className="row gap-8">
            <Btn onClick={() => setCreating(false)}>{t('common.cancel')}</Btn>
            <Btn kind="primary" onClick={create} disabled={!questions.length || saving}>{saving ? t('common.saving') : t('candidate.video.create')}</Btn>
          </div>
        </div>
      ) : (
        <div className="card card-pad row" style={{ justifyContent: "space-between", borderStyle: "dashed", background: "var(--bg-sunken)" }}>
          <div className="col">
            <span className="weight-500">{t('candidate.video.add')}</span>
            <span className="text-12 text-muted">{t('candidate.video.hint')}</span>
          </div>
          <Btn kind="primary" icon={<Icons.Play size={14} />} onClick={() => setCreating(true)}>{t('candidate.video.new')}</Btn>
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
    if (!c.id) return;
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

  const avgOf = (map, keys) => {
    const rated = keys.filter(k => (map[k] || 0) > 0);
    if (!rated.length) return 0;
    return rated.reduce((s, k) => s + (map[k] || 0), 0) / rated.length;
  };
  const humanAvg   = avgOf(human, HUMAN_SKILLS);
  const techAvg    = avgOf(technical, TECH_SKILLS);
  const overallAvg = (humanAvg + techAvg) / (humanAvg && techAvg ? 2 : humanAvg ? 1 : techAvg ? 1 : 1) || 0;
  const overallPct = Math.round((overallAvg / 5) * 100);

  const recColor = { "No Hire": "var(--danger)", "Lean No": "var(--warn)", "Lean Hire": "var(--ai)", "Strong Hire": "var(--positive)" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div className="col gap-12">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('candidate.eval.human')}</span>
            <div className="row gap-6" style={{ alignItems: "center" }}>
              <span className="card-sub">{t('candidate.eval.scale')}</span>
              {humanAvg > 0 && <span className="text-12 text-mono weight-600" style={{ color: "var(--ai)" }}>{humanAvg.toFixed(1)}</span>}
            </div>
          </div>
          <div style={{ padding: "8px 18px" }}>
            {HUMAN_SKILLS.map(s => (
              <SkillRow key={s} label={s} value={human[s] || 0} onChange={v => setHuman(prev => ({ ...prev, [s]: v }))} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('candidate.eval.technical')}</span>
            <div className="row gap-6" style={{ alignItems: "center" }}>
              <span className="card-sub">{t('candidate.eval.scale')}</span>
              {techAvg > 0 && <span className="text-12 text-mono weight-600" style={{ color: "var(--ai)" }}>{techAvg.toFixed(1)}</span>}
            </div>
          </div>
          <div style={{ padding: "8px 18px" }}>
            {TECH_SKILLS.map(s => (
              <SkillRow key={s} label={s} value={technical[s] || 0} onChange={v => setTechnical(prev => ({ ...prev, [s]: v }))} />
            ))}
          </div>
        </div>
      </div>
      <div className="col gap-12">
        {/* Score summary */}
        {overallAvg > 0 && (
          <div className="card card-pad col gap-12">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <div className="col gap-1">
                <span className="weight-600" style={{ fontSize: 13 }}>{t('candidate.eval.overall')}</span>
                <span className="text-12 text-secondary">{t('candidate.eval.overallSub')}</span>
              </div>
              <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: overallPct >= 70 ? "var(--positive)" : overallPct >= 45 ? "var(--warn)" : "var(--danger)" }}>
                {overallAvg.toFixed(1)}<span className="text-14 text-muted weight-400">/5</span>
              </span>
            </div>
            <div style={{ height: 6, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${overallPct}%`, borderRadius: 999, background: overallPct >= 70 ? "var(--positive)" : overallPct >= 45 ? "var(--warn)" : "var(--danger)", transition: "width 0.4s ease" }} />
            </div>
            <div className="row gap-16">
              {humanAvg > 0 && (
                <div className="col gap-1">
                  <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('candidate.eval.soft')}</span>
                  <span className="text-13 weight-600 text-mono">{humanAvg.toFixed(1)}</span>
                </div>
              )}
              {techAvg > 0 && (
                <div className="col gap-1">
                  <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('candidate.eval.technicalShort')}</span>
                  <span className="text-13 weight-600 text-mono">{techAvg.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card card-pad col gap-12">
          <span className="weight-500">{t('candidate.eval.recommendation')}</span>
          <div className="col gap-6">
            {["Strong Hire", "Lean Hire", "Lean No", "No Hire"].map(opt => (
              <button key={opt} onClick={() => setRecommendation(opt)}
                style={{
                  padding: "10px 14px", borderRadius: 8, textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: recommendation === opt ? 600 : 400,
                  border: `1.5px solid ${recommendation === opt ? recColor[opt] : "var(--border)"}`,
                  background: recommendation === opt ? `color-mix(in oklch, ${recColor[opt]} 8%, var(--surface))` : "var(--bg-sunken)",
                  color: recommendation === opt ? recColor[opt] : "var(--ink-secondary)",
                  transition: "all 0.15s",
                }}>
                {t({ "Strong Hire": 'candidate.eval.rec.strongHire', "Lean Hire": 'candidate.eval.rec.leanHire', "Lean No": 'candidate.eval.rec.leanNo', "No Hire": 'candidate.eval.rec.noHire' }[opt])}
              </button>
            ))}
          </div>
        </div>

        <div className="card card-pad col gap-8">
          <span className="weight-500">{t('candidate.eval.notes')}</span>
          <textarea className="textarea" rows={5} placeholder={t('candidate.eval.notesPh')} value={notes} onChange={e => setNotes(e.target.value)} />
          <Btn kind="primary" icon={<Icons.Save size={14} />} style={{ alignSelf: "flex-start" }} onClick={save} disabled={saving}>
            {saving ? t('common.saving') : saved ? t('common.saved') + ' ✓' : t('candidate.eval.save')}
          </Btn>
        </div>
      </div>
    </div>
  );
};

const SkillRow = ({ label, value, onChange }) => {
  const t = window.useT();
  const key = window.CANDID_DATA.SKILL_KEYS?.[label];
  const displayLabel = key ? t(key) : label;
  const descKey = key ? `${key}.desc` : null;
  const desc = descKey ? t(descKey) : null;
  const labelEl = <span className="text-13">{displayLabel}</span>;
  return (
    <div className="skill-row">
      {desc ? <Tooltip text={desc}>{labelEl}</Tooltip> : labelEl}
      <div className="skill-bar"><div className="fill" style={{ width: `${(value / 5) * 100}%` }} /></div>
      <Rating value={value} onChange={onChange} />
    </div>
  );
};

// ── Activity Tab ──────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso.slice(0, 10); }
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const hasTime = iso.includes("T") || iso.includes(" ");
    if (!hasTime) return date;
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${date} · ${time}`;
  } catch { return iso.slice(0, 16).replace("T", " "); }
};

const ActivityTab = ({ c }) => {
  const t = window.useT();
  const statusLabels = Object.fromEntries((window.CANDID_DATA.STATUS || []).map(s => [s.id, s.label]));

  const typeIcon = (type) => {
    if (type === "analysis") return <Icons.Sparkles size={10} />;
    if (type === "cv_upload") return <Icons.Upload size={10} />;
    if (type === "stage") return <Icons.ArrowRight size={10} />;
    if (type === "eval") return <Icons.Star size={10} />;
    if (type === "interview") return <Icons.Mic size={10} />;
    return <Icons.Check size={10} />;
  };

  // Build unified event list: activity_log (backend) + synthetic fallbacks for legacy data
  const fromLog = (c.activityLog || []).map(e => ({
    type: e.type,
    when: e.at,
    what: e.type === "stage"
      ? t('candidate.activity.stage').replace('{stage}', statusLabels[e.note?.replace("Stage moved to ", "")] || e.note)
      : e.note,
    who: e.by || null,
    sort: e.at,
  }));

  const logTypes = new Set((c.activityLog || []).map(e => e.type));

  const synthetic = [
    { type: "system", when: c.appliedAt, what: t('candidate.activity.added'), sort: c.appliedAt || "0000" },
    // Only show legacy status history entries not already in activity_log
    ...(!logTypes.has("stage") ? (c.statusHistory || []).map(h => ({
      type: "stage",
      when: h.at,
      what: t('candidate.activity.stage').replace('{stage}', statusLabels[h.status] || h.status),
      who: h.by || null,
      sort: h.at,
    })) : []),
    // Only show legacy analysis entry if no activity_log entries for analysis
    ...(!logTypes.has("analysis") && c.pre
      ? [{ type: "analysis", when: c.analysisAt || c.appliedAt, what: t('candidate.activity.analysis'), sort: c.analysisAt || c.appliedAt || "0001" }]
      : []),
    ...(!logTypes.has("eval") && c.evaluation
      ? [{ type: "eval", when: c.evaluation.updated_at || c.appliedAt, what: t('candidate.activity.evalSaved'), sort: c.evaluation.updated_at || c.appliedAt || "0002" }]
      : []),
    ...(c.interviews || []).map(iv => ({
      type: "interview",
      who: iv.interviewer,
      when: iv.date,
      what: t('candidate.activity.interviewRecorded').replace('{title}', iv.title || iv.type || t('interviews.interview')),
      sort: iv.date || "0003",
    })),
  ];

  const raw = [...fromLog, ...synthetic]
    .sort((a, b) => (b.sort || "").localeCompare(a.sort || ""));

  return (
    <div className="card">
      <div style={{ padding: 4 }}>
        {raw.map((a, i) => (
          <div key={i} className="row gap-12" style={{ padding: "12px 18px", borderBottom: i === raw.length - 1 ? 0 : "1px solid var(--border-soft)", alignItems: "flex-start" }}>
            {a.type === "interview" && a.who
              ? <Avatar name={a.who} />
              : <span className="ai-tag" style={{ padding: "4px 6px", flexShrink: 0, marginTop: 1 }}>{typeIcon(a.type)}</span>
            }
            <div className="col" style={{ flex: 1 }}>
              <span className="text-13">{a.what}</span>
              <span className="text-12 text-muted">
                {a.who ? `${a.who} · ` : ""}{fmtDateTime(a.when)}
              </span>
            </div>
          </div>
        ))}
        {raw.length === 0 && (
          <div style={{ padding: "24px 18px", color: "var(--ink-muted)", fontSize: 13 }}>{t('candidate.activity.empty')}</div>
        )}
      </div>
    </div>
  );
};

// ── Emails Tab ────────────────────────────────────────────────────────────────

const _relativeTimeEmail = (iso, t) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return t('inbox.time.justNow');
  if (minutes < 60) return t('inbox.time.minutesAgo').replace('{n}', minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return t('inbox.time.hoursAgo').replace('{n}', hours);
  const days = Math.floor(hours / 24);
  if (days === 1)   return t('inbox.time.yesterday');
  return t('inbox.time.daysAgo').replace('{n}', days);
};

const EmailsTab = ({ candidateId }) => {
  const t = window.useT();
  const [emails, setEmails]               = React.useState([]);
  const [loading, setLoading]             = React.useState(true);
  const [error, setError]                 = React.useState(null);
  const [selectedEmail, setSelectedEmail] = React.useState(null);

  const load = React.useCallback(() => {
    setLoading(true); setError(null);
    fetch(`${window.API_BASE}/emails?candidate_id=${candidateId}&direction=sent`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setEmails(d.emails || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [candidateId]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span className="text-13 text-secondary">
          {loading ? t('common.loading') : error ? t('inbox.error').replace('{error}', error) : t('candidate.emails.sentCount').replace('{n}', emails.length)}
        </span>
      </div>

      {loading && <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-muted)", fontSize: 13 }}>{t('common.loading')}</div>}
      {!loading && error && <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--error)" }}>{t('inbox.failedToLoad').replace('{error}', error)}</div>}

      {!loading && !error && emails.length === 0 && (
        <div className="card col" style={{ padding: 48, alignItems: "center", gap: 12 }}>
          <Icons.Mail size={28} style={{ color: "var(--ink-muted)" }} />
          <span className="text-13 text-secondary">{t('candidate.emails.empty')}</span>
        </div>
      )}

      {!loading && !error && emails.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {emails.map((email, index) => (
            <div
              key={email.id} className="row gap-14"
              style={{ padding: "14px 18px", borderBottom: index === emails.length - 1 ? 0 : "1px solid var(--border-soft)", alignItems: "flex-start", cursor: "pointer" }}
              onClick={() => setSelectedEmail(email)}
            >
              <span style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, background: "var(--bg-sunken)", color: "var(--ink-secondary)" }}>
                <Icons.Mail size={14} />
              </span>
              <div className="col" style={{ flex: 1, minWidth: 0 }}>
                <div className="row gap-8" style={{ marginBottom: 3, alignItems: "center" }}>
                  <span className="text-13 weight-500" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {email.subject || t('inbox.noSubject')}
                  </span>
                  <Badge kind={email.email_type === "rejection" ? "error" : "neutral"} style={{ marginLeft: "auto", flexShrink: 0 }}>{email.email_type}</Badge>
                </div>
                <span className="text-12 text-secondary" style={{ marginBottom: 2 }}>{t('inbox.to').replace('{email}', email.to_email || "—")}</span>
                <span className="text-12 text-muted">{_relativeTimeEmail(email.sent_at, t)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <window.EmailDetailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </div>
  );
};

window.CandidateScreen = CandidateScreen;
