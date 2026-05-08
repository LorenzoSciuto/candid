// Interviews schedule screen — API-backed
const InterviewsScreen = ({ onRoute }) => {
  const t = window.useT();
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    Promise.all([
      fetch(`${window.API_BASE}/interviews`).then(r => r.ok ? r.json() : []),
      fetch(`${window.API_BASE}/candidates`).then(r => r.ok ? r.json() : []),
    ]).then(([ivs, cands]) => {
      setInterviews(Array.isArray(ivs) ? ivs : []);
      const map = {};
      if (Array.isArray(cands)) cands.forEach(c => { map[c.id] = `${c.first_name} ${c.last_name}`; });
      setCandidates(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = interviews.filter(iv => iv.date && iv.date >= today);
  const past = interviews.filter(iv => !iv.date || iv.date < today);

  // Fallback mock data when backend has no interviews yet
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

  const candName = (iv) => iv.candidateName || candidates[iv.candidate_id] || iv.candidate_id || "Unknown";

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('interviews.title')}</h1>
          <div className="page-sub">{displayUpcoming.length} upcoming · {interviews.length} total</div>
        </div>
        <div className="row gap-8">
          <SegControl value="list" onChange={() => {}} options={[{ value: "list", label: "List" }, { value: "week", label: "Week" }]} />
          <Btn kind="primary" icon={<Icons.Plus size={14} />}>{t('interviews.schedule')}</Btn>
        </div>
      </div>

      {displayUpcoming.length > 0 && (
        <>
          <div className="weight-600 text-13 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>{t('interviews.upcoming')}</div>
          <div className="col gap-8" style={{ marginBottom: 28 }}>
            {displayUpcoming.map(iv => (
              <div key={iv.id} className="card row" style={{ padding: 14, alignItems: "center", justifyContent: "space-between" }}>
                <div className="row gap-16" style={{ minWidth: 0 }}>
                  <div style={{ width: 56, textAlign: "center", padding: "6px 8px", background: "var(--bg-sunken)", borderRadius: 6, flexShrink: 0 }}>
                    <div className="text-mono text-12 text-muted">{iv.date || "TBD"}</div>
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
    </div>
  );
};

window.InterviewsScreen = InterviewsScreen;
