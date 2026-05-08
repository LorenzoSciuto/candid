// Interviews schedule screen — API-backed

// ── Week helpers ──────────────────────────────────────────────────────────────

const getMondayOf = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const fmtDate = (date) => date.toISOString().slice(0, 10);

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Schedule Modal ────────────────────────────────────────────────────────────

const ScheduleModal = ({ onClose, onSaved }) => {
  const t = window.useT();
  const [candidateId, setCandidateId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Video");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [interviewer, setInterviewer] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = window.useApiData ? window.useApiData("/candidates", []) : [];
  const employees = window.useApiData ? window.useApiData("/employees", []) : [];

  const save = async () => {
    if (!date) return;
    setSaving(true);
    const body = {
      candidate_id: candidateId || null,
      title: title || `${type} Interview`,
      type,
      date,
      time: time || null,
      interviewer: interviewer || null,
      duration: duration ? `${duration}m` : null,
      raw_content: notes || null,
    };
    try {
      await fetch(`${window.API_BASE}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {}
    onSaved();
  };

  return (
    <Modal open title={t('interviews.modal.new')} onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" onClick={save} disabled={saving || !date}>{saving ? t('common.saving') : t('common.save')}</Btn>
        </>
      }>
      <div className="col gap-12">
        <div>
          <label className="label">{t('interviews.modal.candidate')}</label>
          <select className="select" value={candidateId} onChange={e => setCandidateId(e.target.value)}>
            <option value="">— {t('interviews.modal.candidate')} —</option>
            {candidates.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">{t('interviews.modal.titleField')}</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder={`e.g. ${type} Interview`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="label">{t('interviews.modal.type')}</label>
            <select className="select" value={type} onChange={e => setType(e.target.value)}>
              <option>Video</option>
              <option>Phone</option>
              <option>In-person</option>
              <option>Technical</option>
            </select>
          </div>
          <div>
            <label className="label">{t('interviews.modal.duration')}</label>
            <input className="input" type="number" min={15} step={15} value={duration} onChange={e => setDuration(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('interviews.modal.date')}</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('interviews.modal.time')}</label>
            <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">{t('interviews.modal.interviewer')}</label>
          <select className="select" value={interviewer} onChange={e => setInterviewer(e.target.value)}>
            <option value="">— {t('interviews.modal.interviewer')} —</option>
            {employees.map(e => {
              const name = `${e.first_name} ${e.last_name}`;
              return <option key={e.id} value={name}>{name}{e.role_name ? ` · ${e.role_name}` : ""}</option>;
            })}
          </select>
        </div>

        <div>
          <label className="label">{t('interviews.modal.notes')}</label>
          <textarea className="textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Agenda, links, instructions…" />
        </div>
      </div>
    </Modal>
  );
};

// ── Week View ─────────────────────────────────────────────────────────────────

const WeekView = ({ interviews, candidates, onRoute }) => {
  const t = window.useT();
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = fmtDate(new Date());

  const byDay = useMemo(() => {
    const map = {};
    days.forEach(d => { map[fmtDate(d)] = []; });
    interviews.forEach(iv => {
      if (iv.date && map[iv.date]) map[iv.date].push(iv);
    });
    return map;
  }, [interviews, weekStart]);

  const candName = (iv) => iv.candidateName || candidates[iv.candidate_id] || "—";

  const weekLabel = (() => {
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth()) return `${s.toLocaleString("default", { month: "long" })} ${s.getFullYear()}`;
    return `${s.toLocaleString("default", { month: "short" })} – ${e.toLocaleString("default", { month: "short" })} ${e.getFullYear()}`;
  })();

  return (
    <div>
      <div className="row" style={{ alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(w => addDays(w, -7))}>
          <Icons.ChevronLeft size={14} /> Prev
        </button>
        <span className="text-13 weight-500" style={{ flex: 1, textAlign: "center" }}>{weekLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(w => addDays(w, 7))}>
          Next <Icons.ChevronRight size={14} />
        </button>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
          {days.map((d, i) => {
            const ds = fmtDate(d);
            const isToday = ds === today;
            return (
              <div key={ds} style={{ borderRight: i < 6 ? "1px solid var(--border-soft)" : 0, padding: "8px 6px", textAlign: "center" }}>
                <div className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{DAY_LABELS[i]}</div>
                <div className="text-13 weight-500" style={{ marginTop: 2, width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: isToday ? "var(--ink)" : "transparent", color: isToday ? "white" : "inherit" }}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: 200 }}>
          {days.map((d, i) => {
            const ds = fmtDate(d);
            const dayIvs = byDay[ds] || [];
            return (
              <div key={ds} style={{ borderRight: i < 6 ? "1px solid var(--border-soft)" : 0, padding: 6, minHeight: 200 }}>
                {dayIvs.map(iv => (
                  <div key={iv.id} style={{ background: "var(--accent-subtle, oklch(0.95 0.04 285))", borderRadius: 5, padding: "5px 7px", marginBottom: 4, fontSize: 11.5, lineHeight: 1.4 }}>
                    <div className="weight-500" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{iv.title || iv.type}</div>
                    <div className="text-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{candName(iv)}</div>
                    {iv.time && <div className="text-muted">{iv.time}{iv.duration ? ` · ${iv.duration}` : ""}</div>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────

const InterviewsScreen = ({ onRoute }) => {
  const t = window.useT();
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const reload = () => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch(`${window.API_BASE}/interviews`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${window.API_BASE}/candidates`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([ivs, cands]) => {
      setInterviews(Array.isArray(ivs) ? ivs : []);
      const map = {};
      if (Array.isArray(cands)) cands.forEach(c => { map[c.id] = `${c.first_name} ${c.last_name}`; });
      setCandidates(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(reload, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = interviews.filter(iv => iv.date && iv.date >= today);
  const past = interviews.filter(iv => !iv.date || iv.date < today);

  const mockUpcoming = [
    { id: "iv-1", date: today, title: "Tech Deep Dive", candidate_id: null, candidateName: "Maya Chen", interviewer: "Priya Iyer", type: "Video", duration: "60m", live: true },
    { id: "iv-2", date: today, title: "Recruiter Screen", candidate_id: null, candidateName: "Kenji Watanabe", interviewer: "Devon Park", type: "Phone", duration: "45m" },
  ];
  const mockPast = [
    { id: "iv-p1", date: "Yesterday", title: "Hiring Manager", candidate_id: null, candidateName: "Maya Chen", interviewer: "Sasha Rivera", ai_summary: "Strong systems thinking. Asked sharp questions about DS governance.", duration: "62m" },
    { id: "iv-p2", date: "May 5", title: "Recruiter Screen", candidate_id: null, candidateName: "Maya Chen", interviewer: "Devon Park", ai_summary: "Comp aligned. 4-week notice.", duration: "47m" },
  ];

  const displayUpcoming = upcoming.length > 0 ? upcoming : (!loading ? mockUpcoming : []);
  const displayPast = past.length > 0 ? past : (!loading ? mockPast : []);
  const allDisplay = [...displayUpcoming, ...displayPast];

  const candName = (iv) => iv.candidateName || candidates[iv.candidate_id] || iv.candidate_id || "Unknown";

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('interviews.title')}</h1>
          <div className="page-sub">{displayUpcoming.length} upcoming · {interviews.length} total</div>
        </div>
        <div className="row gap-8">
          <SegControl
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t('interviews.view.list') },
              { value: "week", label: t('interviews.view.week') },
            ]}
          />
          <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setScheduleOpen(true)}>
            {t('interviews.schedule')}
          </Btn>
        </div>
      </div>

      {view === "week" ? (
        <WeekView interviews={allDisplay} candidates={candidates} onRoute={onRoute} />
      ) : (
        <>
          {displayUpcoming.length > 0 && (
            <>
              <div className="weight-600 text-13 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{t('interviews.upcoming')}</div>
              <div className="col gap-8" style={{ marginBottom: 28 }}>
                {displayUpcoming.map(iv => (
                  <div key={iv.id} className="card row" style={{ padding: 14, alignItems: "center", justifyContent: "space-between" }}>
                    <div className="row gap-16" style={{ minWidth: 0 }}>
                      <div style={{ width: 56, textAlign: "center", padding: "6px 8px", background: "var(--bg-sunken)", borderRadius: 6, flexShrink: 0 }}>
                        <div className="text-mono text-12 text-muted">{iv.date || "TBD"}</div>
                        {iv.time && <div className="text-mono text-11 text-muted">{iv.time}</div>}
                      </div>
                      <div className="col" style={{ minWidth: 0 }}>
                        <div className="row gap-8">
                          <span className="weight-500">{iv.title || iv.type}</span>
                          <Badge>{iv.type || "Interview"}</Badge>
                          {iv.live && <Badge kind="ai"><span className="dot" /> Live in 2h</Badge>}
                        </div>
                        <div className="text-12 text-secondary">
                          {candName(iv)}{iv.interviewer ? ` · with ${iv.interviewer}` : ""}{iv.duration ? ` · ${iv.duration}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="row gap-8">
                      <Btn>{t('interviews.reschedule')}</Btn>
                      {iv.live ? (
                        <Btn kind="primary" icon={<Icons.Mic size={14} />} onClick={() => onRoute("liveroom")}>{t('interviews.openLive')}</Btn>
                      ) : (
                        <Btn icon={<Icons.Calendar size={14} />}>{t('common.details')}</Btn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {displayPast.length > 0 && (
            <>
              <div className="weight-600 text-13 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{t('interviews.recent')}</div>
              <div className="card" style={{ overflow: "hidden" }}>
                {displayPast.map((iv, i) => (
                  <div key={iv.id} className="row" style={{ padding: "14px 18px", justifyContent: "space-between", borderBottom: i === displayPast.length - 1 ? 0 : "1px solid var(--border-soft)" }}>
                    <div className="row gap-12">
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-sunken)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icons.Mic size={14} />
                      </div>
                      <div className="col">
                        <div className="row gap-8">
                          <span className="weight-500">{iv.title || iv.type}</span>
                          <span className="text-12 text-muted">· {iv.date || "—"}{iv.duration ? ` · ${iv.duration}` : ""}</span>
                        </div>
                        <span className="text-12 text-secondary">{candName(iv)}{iv.interviewer ? ` · with ${iv.interviewer}` : ""}</span>
                      </div>
                    </div>
                    <div className="row gap-12" style={{ maxWidth: 480, alignItems: "center" }}>
                      {iv.ai_summary && <span className="text-12 text-secondary" style={{ flex: 1, textAlign: "right" }}>{iv.ai_summary}</span>}
                      <Btn>{t('interviews.transcript')}</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && displayUpcoming.length === 0 && displayPast.length === 0 && (
            <div className="card card-pad" style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>
              {t('interviews.empty')}
            </div>
          )}
        </>
      )}

      {scheduleOpen && (
        <ScheduleModal
          onClose={() => setScheduleOpen(false)}
          onSaved={() => { setScheduleOpen(false); reload(); }}
        />
      )}
    </div>
  );
};

window.InterviewsScreen = InterviewsScreen;
