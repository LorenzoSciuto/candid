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

const fmtDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Schedule Modal ────────────────────────────────────────────────────────────

const ScheduleModal = ({ onClose, onSaved, initialCandidateId = "" }) => {
  const t = window.useT();
  const [candidateId, setCandidateId] = useState(initialCandidateId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Video");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [interviewer, setInterviewer] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const allCandidates = window.useApiData ? window.useApiData("/candidates", []) : [];
  const candidates = allCandidates.filter(c => c.status !== "hired" && c.status !== "archived");
  const team = window.getTeamMembers ? window.getTeamMembers() : [];

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
            {team.map(m => (
              <option key={m.name} value={m.name}>{m.name}{(m.title || m.department) ? ` · ${m.title || m.department}` : ""}</option>
            ))}
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
  const [weekStart, setWeekStart] = useState(() => {
    // Jump to first upcoming interview's week instead of always showing current week
    const sorted = [...interviews].filter(iv => iv.date).sort((a, b) => a.date < b.date ? -1 : 1);
    if (sorted.length > 0) return getMondayOf(new Date(sorted[0].date + "T12:00:00"));
    return getMondayOf(new Date());
  });

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

  const thisWeekHasInterviews = days.some(d => (byDay[fmtDate(d)] || []).length > 0);
  const hasAnyInterviews = interviews.some(iv => iv.date);

  return (
    <div>
      <div className="row" style={{ alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(w => addDays(w, -7))}>
          <Icons.ChevronLeft size={14} /> Prev
        </button>
        <span className="text-13 weight-500" style={{ flex: 1, textAlign: "center" }}>{weekLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(getMondayOf(new Date()))}>Today</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(w => addDays(w, 7))}>
          Next <Icons.ChevronRight size={14} />
        </button>
      </div>
      {!thisWeekHasInterviews && hasAnyInterviews && (
        <div className="text-13 text-muted" style={{ textAlign: "center", padding: "8px 0 12px" }}>
          No interviews this week · <button className="btn btn-ghost btn-sm" style={{ padding: "2px 8px", fontSize: 12 }}
            onClick={() => {
              const next = interviews.filter(iv => iv.date).sort((a, b) => a.date < b.date ? -1 : 1)[0];
              if (next) setWeekStart(getMondayOf(new Date(next.date + "T12:00:00")));
            }}>Jump to next →</button>
        </div>
      )}
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

// ── Transcript Modal ──────────────────────────────────────────────────────────

const TranscriptModal = ({ interview, onClose }) => {
  const t = window.useT();
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");

  const text = interview.raw_content || interview.cleaned_transcript || "";

  const summarize = async () => {
    if (!text.trim()) return;
    setSummarizing(true);
    setSummaryError("");
    try {
      const res = await fetch(`${window.API_BASE}/interviews/${interview.id}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSummary(data);
    } catch {
      setSummaryError("AI summarize failed — check provider settings.");
    }
    setSummarizing(false);
  };

  return (
    <Modal open title={interview.title || interview.type || "Transcript"} onClose={onClose} width={720} disableBackdropClose={false}
      footer={
        <div className="row gap-8" style={{ flex: 1, justifyContent: "space-between", alignItems: "center" }}>
          <div className="row gap-8">
            {!summary && (
              <Btn kind="ai" icon={<Icons.Sparkles size={14} />} onClick={summarize} disabled={summarizing || !text.trim()}>
                {summarizing ? "Summarizing…" : "AI Summarize"}
              </Btn>
            )}
            {summaryError && <span className="text-12" style={{ color: "var(--danger)" }}>{summaryError}</span>}
          </div>
          <Btn onClick={onClose}>{t('common.close')}</Btn>
        </div>
      }>
      <div className="col gap-16">
        {summary && (
          <div className="col gap-10">
            <div className="col gap-6">
              <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Key Points</span>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(summary.bullets || []).map((b, i) => (
                  <li key={i} className="text-13" style={{ marginBottom: 4 }}>{b}</li>
                ))}
              </ul>
            </div>
            {summary.summary && (
              <div className="col gap-4">
                <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Summary</span>
                <p className="text-13" style={{ margin: 0, lineHeight: 1.65 }}>{summary.summary}</p>
              </div>
            )}
            <div style={{ height: 1, background: "var(--border)" }} />
          </div>
        )}
        {text ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.75, whiteSpace: "pre-wrap", color: "var(--ink-secondary)", maxHeight: 480, overflowY: "auto" }}>
            {text}
          </div>
        ) : (
          <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>No transcript recorded for this interview.</div>
        )}
      </div>
    </Modal>
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
  const [transcriptIv, setTranscriptIv] = useState(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [interviewerFilter, setInterviewerFilter] = useState("all");

  const reload = () => {
    Promise.all([
      fetch(`${window.API_BASE}/interviews`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${window.API_BASE}/candidates`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([ivs, cands]) => {
      setInterviews(Array.isArray(ivs) ? ivs : []);
      const map = {};
      if (Array.isArray(cands)) cands.forEach(candidate => { map[candidate.id] = `${candidate.first_name} ${candidate.last_name}`; });
      setCandidates(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(reload, []);

  const today = new Date().toISOString().slice(0, 10);
  const candName = (iv) => candidates[iv.candidate_id] || "—";

  const upcomingAll = interviews.filter(iv => iv.date && iv.date >= today);
  const pastAll = interviews.filter(iv => iv.date && iv.date < today).sort((a, b) => b.date.localeCompare(a.date));

  const interviewers = useMemo(() => {
    const set = new Set();
    upcomingAll.forEach(iv => { if (iv.interviewer) set.add(iv.interviewer); });
    return [...set].sort();
  }, [interviews]);

  const types = useMemo(() => {
    const set = new Set();
    upcomingAll.forEach(iv => { if (iv.type) set.add(iv.type); });
    return [...set].sort();
  }, [interviews]);

  const applyFilters = (list) => list.filter(iv => {
    if (q) {
      const ql = q.toLowerCase();
      const name = candName(iv).toLowerCase();
      const title = (iv.title || iv.type || "").toLowerCase();
      const iwr = (iv.interviewer || "").toLowerCase();
      if (!name.includes(ql) && !title.includes(ql) && !iwr.includes(ql)) return false;
    }
    if (typeFilter !== "all" && iv.type !== typeFilter) return false;
    if (interviewerFilter !== "all" && iv.interviewer !== interviewerFilter) return false;
    return true;
  });

  const displayUpcoming = useMemo(() => applyFilters(upcomingAll), [interviews, q, typeFilter, interviewerFilter, candidates]);
  const displayPast     = useMemo(() => applyFilters(pastAll),     [interviews, q, typeFilter, interviewerFilter, candidates]);

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('interviews.title')}</h1>
          <div className="page-sub">{displayUpcoming.length} upcoming</div>
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

      <div className="card" style={{ padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="row gap-6" style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", flex: "1 1 200px" }}>
          <Icons.Search size={14} style={{ color: "var(--ink-muted)" }} />
          <input className="input" style={{ border: 0, padding: "4px 0", background: "transparent" }} placeholder="Search candidate, title, interviewer…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 140 }}>
          <option value="all">All types</option>
          {types.map(tp => <option key={tp} value={tp}>{tp}</option>)}
        </select>
        <select className="select" value={interviewerFilter} onChange={e => setInterviewerFilter(e.target.value)} style={{ width: 160 }}>
          <option value="all">All interviewers</option>
          {interviewers.map(iv => <option key={iv} value={iv}>{iv}</option>)}
        </select>
        {(q || typeFilter !== "all" || interviewerFilter !== "all") && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setTypeFilter("all"); setInterviewerFilter("all"); }}>{t('common.clear')}</button>
        )}
      </div>

      {view === "week" ? (
        <WeekView interviews={upcomingAll} candidates={candidates} onRoute={onRoute} />
      ) : (
        <>
          {displayUpcoming.length > 0 && (
            <div className="col gap-8" style={{ marginBottom: 24 }}>
              <div className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 2px", marginBottom: 4 }}>Upcoming</div>
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
                      </div>
                      <div className="text-12 text-secondary">
                        {candName(iv)}{iv.interviewer ? ` · with ${iv.interviewer}` : ""}{iv.duration ? ` · ${iv.duration}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="row gap-8">
                    <Btn kind="primary" icon={<Icons.Mic size={14} />}
                      onClick={() => onRoute("liveroom", { ...iv, candidateName: candName(iv) })}>
                      Record
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
          {displayPast.length > 0 && (
            <div className="col gap-8">
              <div className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 2px", marginBottom: 4 }}>Past</div>
              {displayPast.map(iv => (
                <div key={iv.id} className="card row" style={{ padding: 14, alignItems: "center", justifyContent: "space-between", opacity: 0.8 }}>
                  <div className="row gap-16" style={{ minWidth: 0 }}>
                    <div style={{ width: 56, textAlign: "center", padding: "6px 8px", background: "var(--bg-sunken)", borderRadius: 6, flexShrink: 0 }}>
                      <div className="text-mono text-12 text-muted">{iv.date}</div>
                      {iv.time && <div className="text-mono text-11 text-muted">{iv.time}</div>}
                    </div>
                    <div className="col" style={{ minWidth: 0 }}>
                      <div className="row gap-8">
                        <span className="weight-500">{iv.title || iv.type}</span>
                        <Badge>{iv.type || "Interview"}</Badge>
                      </div>
                      <div className="text-12 text-secondary">
                        {candName(iv)}{iv.interviewer ? ` · with ${iv.interviewer}` : ""}{iv.duration ? ` · ${iv.duration}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="row gap-8">
                    {iv.raw_content || iv.cleaned_transcript ? (
                      <Btn icon={<Icons.FileText size={14} />} onClick={() => setTranscriptIv(iv)}>Transcript</Btn>
                    ) : (
                      <Btn icon={<Icons.Mic size={14} />} onClick={() => onRoute("liveroom", { ...iv, candidateName: candName(iv) })}>Record</Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {displayUpcoming.length === 0 && displayPast.length === 0 && !loading && (
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
      {transcriptIv && (
        <TranscriptModal
          interview={transcriptIv}
          onClose={() => setTranscriptIv(null)}
        />
      )}
    </div>
  );
};

window.InterviewsScreen = InterviewsScreen;
window.ScheduleModal = ScheduleModal;
