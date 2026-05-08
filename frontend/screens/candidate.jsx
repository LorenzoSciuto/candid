// Candidate Detail Hub — full profile with tabs
const { HUMAN_SKILLS, TECH_SKILLS } = window.CANDID_DATA;

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
  jobDescription: c.job_description,
  pre: c.ai_pre_analysis || null,
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
});

const CandidateScreen = ({ id, onRoute }) => {
  const t = window.useT();
  const mockC = window.CANDID_DATA.CANDIDATES.find(x => x.id === id) || window.CANDID_DATA.CANDIDATES[0];
  const [c, setC] = useState(mockC);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [hiring, setHiring] = useState(false);
  const [hired, setHired] = useState(false);

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
          <Btn icon={<Icons.Mail size={14} />}>{t('candidate.email')}</Btn>
          <Btn icon={<Icons.Calendar size={14} />}>{t('candidate.schedule')}</Btn>
          <Btn kind="primary" icon={<Icons.Mic size={14} />} onClick={() => onRoute("liveroom")}>{t('candidate.startInterview')}</Btn>
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
      {tab === "cv-analysis" && <CVAnalysisTab c={c} t={t} />}
      {tab === "interviews"  && <InterviewsTab c={c} onRoute={onRoute} onRefresh={refreshCandidate} t={t} />}
      {tab === "evaluation"  && <EvaluationTab c={c} onSaved={refreshCandidate} t={t} />}
      {tab === "activity"    && <ActivityTab c={c} />}
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

// ── Overview ──────────────────────────────────────────────────────────────────

const OverviewTab = ({ c, onTab, t }) => {
  if (!c.pre) return <EmptyOverview c={c} t={t} />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 20 }}>
      <div className="col gap-16">
        <div className="ai-panel card-pad">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <span className="ai-tag"><Icons.Sparkles size={11} /> {t('candidate.overview.aiSummary')}</span>
            <button className="link text-12" onClick={() => onTab("cv-analysis")}>{t('candidate.overview.fullAnalysis')}</button>
          </div>
          <div className="text-13" style={{ lineHeight: 1.6 }}>
            {c.pre?.strengths?.[0] || "AI analysis completed."}
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
      </div>

      <div className="col gap-16">
        <div className="card card-pad">
          <div className="weight-500 mb-8" style={{ marginBottom: 12 }}>{t('candidate.overview.pipeline')}</div>
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
};

const EmptyOverview = ({ c, t }) => (
  <div className="card card-pad" style={{ textAlign: "center", padding: 48 }}>
    <Icons.Sparkles size={24} style={{ color: "var(--ai)", marginBottom: 8 }} />
    <div className="weight-600">{t('candidate.overview.noAnalysis')}</div>
    <div className="text-13 text-secondary mt-4" style={{ marginBottom: 16 }}>Upload a CV to generate strengths, gaps, and tailored questions for {c.first}.</div>
    <Btn kind="ai" icon={<Icons.Upload size={14} />}>{t('candidate.overview.runAnalysis')}</Btn>
  </div>
);

// ── CV Analysis ───────────────────────────────────────────────────────────────

const CVAnalysisTab = ({ c, t }) => {
  if (!c.pre) return <EmptyOverview c={c} t={t} />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 20 }}>
      <div className="col gap-12">
        {c.pre.strengths?.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">{t('candidate.cv.strengths')}</span><Badge kind="positive">{c.pre.strengths.length}</Badge></div>
            <div style={{ padding: 14 }}><ul className="ai-list strengths">{c.pre.strengths.map((s, i) => <li key={i}><span className="marker"><Icons.Check size={11} /></span><span>{s}</span></li>)}</ul></div>
          </div>
        )}
        {c.pre.weaknesses?.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">{t('candidate.cv.weaknesses')}</span><Badge kind="warn">{c.pre.weaknesses.length}</Badge></div>
            <div style={{ padding: 14 }}><ul className="ai-list weaknesses">{c.pre.weaknesses.map((s, i) => <li key={i}><span className="marker"><Icons.X size={11} /></span><span>{s}</span></li>)}</ul></div>
          </div>
        )}
        {c.pre.questions?.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">{t('candidate.cv.questions')}</span><Badge kind="ai">{c.pre.questions.length}</Badge></div>
            <div style={{ padding: 14 }}><ul className="ai-list questions">{c.pre.questions.map((s, i) => <li key={i}><span className="marker">{i + 1}</span><span>{s}</span></li>)}</ul></div>
          </div>
        )}
      </div>
      <div className="col gap-12">
        {c.jobDescription && (
          <div className="card">
            <div className="card-header"><span className="card-title">{t('candidate.cv.jd')}</span><span className="card-sub">{t('candidate.cv.jdSub')}</span></div>
            <div style={{ padding: 14, fontSize: 12.5, color: "var(--ink-secondary)", lineHeight: 1.55, whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto" }}>{c.jobDescription}</div>
          </div>
        )}
        {c.cvText && (
          <div className="card">
            <div className="card-header"><span className="card-title">{t('candidate.cv.extracted')}</span><span className="card-sub">{c.cvText.split(/\s+/).length} words</span></div>
            <div style={{ padding: 14, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto" }}>{c.cvText}</div>
          </div>
        )}
      </div>
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
            <Btn kind="primary" icon={<Icons.Mic size={14} />} onClick={() => onRoute && onRoute("liveroom")}>{t('candidate.iv.join')}</Btn>
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

const ActivityTab = ({ c }) => {
  const activities = [
    ...(c.interviews || []).map(iv => ({
      who: iv.interviewer || "Interviewer",
      when: iv.date || "—",
      what: `${iv.title || iv.type} interview recorded`,
    })),
    ...(c.pre ? [{ who: "AI", when: c.appliedAt || "—", what: "Generated pre-interview analysis" }] : []),
    { who: "System", when: c.appliedAt || "—", what: "Candidate added to pipeline" },
  ];

  return (
    <div className="card">
      <div style={{ padding: 4 }}>
        {activities.map((a, i) => (
          <div key={i} className="row gap-12" style={{ padding: "12px 18px", borderBottom: i === activities.length - 1 ? 0 : "1px solid var(--border-soft)" }}>
            {a.who === "AI" || a.who === "System"
              ? <span className="ai-tag" style={{ padding: "2px 6px" }}><Icons.Sparkles size={10} /></span>
              : <Avatar name={a.who} />}
            <div className="col" style={{ flex: 1 }}>
              <span className="text-13">{a.what}</span>
              <span className="text-12 text-muted">{a.who} · {a.when}</span>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div style={{ padding: "24px 18px", color: "var(--ink-muted)", fontSize: 13 }}>No activity yet.</div>
        )}
      </div>
    </div>
  );
};

window.CandidateScreen = CandidateScreen;
