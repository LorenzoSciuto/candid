// Pipeline (Kanban) screen — with drag-and-drop between columns

const formatAppliedDate = (iso) => {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString("en", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const PipelineScreen = ({ onOpenCandidate, onQuickAdd }) => {
  const t = window.useT();
  const [stages, setStages] = useState(() => window.CANDID_DATA.STATUS || []);
  const [candidates, setCandidates] = useState([]);
  const [filter, setFilter] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const dragging = React.useRef(null);

  useEffect(() => {
    const onStages = (e) => setStages(e.detail);
    window.addEventListener("candid:stages", onStages);
    return () => window.removeEventListener("candid:stages", onStages);
  }, []);

  useEffect(() => {
    fetch(`${window.API_BASE}/candidates`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && Array.isArray(d) && d.length > 0) {
          setCandidates(d.map(c => ({
            id: c.id, first: c.first_name, last: c.last_name, email: c.email,
            experience: c.years_of_experience, status: c.status,
            source: c.source, appliedAt: c.applied_at, score: c.score,
            hasAI: !!(c.ai_pre_analysis),
          })));
        }
      })
      .catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    const out = {};
    stages.forEach(s => { out[s.id] = []; });
    candidates
      .filter(c => !filter || (`${c.first} ${c.last}`).toLowerCase().includes(filter.toLowerCase()))
      .forEach(c => { if (out[c.status]) out[c.status].push(c); });
    return out;
  }, [candidates, filter, stages]);

  const onDragStart = (e, candidate) => {
    dragging.current = { id: candidate.id, fromStatus: candidate.status };
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => e.target.classList.add("dragging"));
  };
  const onDragEnd = (e) => { e.target.classList.remove("dragging"); dragging.current = null; setDragOver(null); };
  const onColDragOver = (e, colId) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== colId) setDragOver(colId); };
  const onColDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); };
  const onColDrop = (e, toStatus) => {
    e.preventDefault(); setDragOver(null);
    const { id, fromStatus } = dragging.current || {};
    if (!id || fromStatus === toStatus) return;
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: toStatus } : c));
    fetch(`${window.API_BASE}/candidates/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: toStatus }),
    }).catch(() => setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: fromStatus } : c)));
  };

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('pipeline.title')}</h1>
          <div className="page-sub">{candidates.length} candidates · {t('pipeline.hint')}</div>
        </div>
        <div className="row gap-8">
          <div className="row gap-6" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px" }}>
            <Icons.Search size={14} style={{ color: "var(--ink-muted)" }} />
            <input className="input" style={{ border: 0, padding: "4px 0", background: "transparent", width: 200 }} placeholder={t('pipeline.filterName')} value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          <Btn icon={<Icons.Filter size={14} />}>{t('common.filter')}</Btn>
          <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={onQuickAdd}>{t('pipeline.add')}</Btn>
        </div>
      </div>

      <div className="kanban">
        {stages.map(col => (
          <div
            key={col.id}
            className={`kcol${dragOver === col.id ? " drag-over" : ""}`}
            onDragOver={e => onColDragOver(e, col.id)}
            onDragLeave={onColDragLeave}
            onDrop={e => onColDrop(e, col.id)}
          >
            <div className="kcol-head">
              <div className="lhs">
                <span className="kdot" style={{ background: col.dot }} />
                <span className="kpill">{col.label}</span>
                <span className="text-mono text-12 text-muted">{grouped[col.id]?.length ?? 0}</span>
              </div>
              <button className="icon-btn"><Icons.MoreH size={14} /></button>
            </div>
            <div className="kcol-body">
              {(grouped[col.id] || []).map(c => (
                <div key={c.id} className="k-card" draggable
                  onDragStart={e => onDragStart(e, c)} onDragEnd={onDragEnd}
                  onClick={() => onOpenCandidate(c.id)}>
                  <div className="row gap-8">
                    <Avatar name={`${c.first} ${c.last}`} />
                    <div className="col" style={{ minWidth: 0 }}>
                      <span className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.first} {c.last}</span>
                      <span className="role">{c.experience ? `${c.experience}y · ` : ""}{c.source || ""}</span>
                    </div>
                  </div>
                  <div className="meta">
                    <span className="text-12 text-muted">{formatAppliedDate(c.appliedAt)}</span>
                    {c.score != null ? (
                      <span className="score row gap-4" style={{ flexShrink: 0 }}>
                        <Icons.Star size={11} style={{ color: "var(--warn)" }} fill="currentColor" stroke="none" /> {c.score.toFixed(1)}
                      </span>
                    ) : c.hasAI ? (
                      <span className="badge ai" style={{ fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 }}><span className="dot" /> AI screening</span>
                    ) : null}
                  </div>
                </div>
              ))}
              {(grouped[col.id] || []).length === 0 && (
                <div className="kcol-empty">{t('pipeline.drop')}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

window.PipelineScreen = PipelineScreen;
