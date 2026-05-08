// Reports / analytics
const PIPELINE_STAGES = window.CANDID_DATA.STATUS;

const ReportsScreen = () => {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${window.API_BASE}/candidates/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${window.API_BASE}/job-descriptions`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([s, j]) => {
      setStats(s);
      if (j) setJobs(j);
      setLoading(false);
    });
  }, []);

  // Build funnel from real status counts
  const funnel = useMemo(() => {
    if (!stats) {
      return [
        { stage: "Applied", n: 142 }, { stage: "Screened", n: 38 },
        { stage: "Pre-Interview", n: 18 }, { stage: "In Evaluation", n: 11 },
        { stage: "Final", n: 4 }, { stage: "Offer", n: 2 },
      ];
    }
    const byStatus = stats.by_status || {};
    return [
      { stage: "New", n: byStatus.new || 0 },
      { stage: "Screening", n: byStatus.screening || 0 },
      { stage: "Pre-Interview", n: byStatus.pre || 0 },
      { stage: "In Evaluation", n: byStatus.eval || 0 },
      { stage: "Final Round", n: byStatus.final || 0 },
      { stage: "Offer", n: byStatus.offer || 0 },
    ].filter(f => f.n > 0 || !stats);
  }, [stats]);

  // Build source mix from real data
  const sources = useMemo(() => {
    if (!stats?.by_source) {
      return [
        { source: "Referral", n: 38, hire: 4 }, { source: "Inbound", n: 42, hire: 2 },
        { source: "LinkedIn", n: 35, hire: 1 }, { source: "Job board", n: 27, hire: 0 },
      ];
    }
    return Object.entries(stats.by_source)
      .map(([source, n]) => ({ source, n, hire: 0 }))
      .sort((a, b) => b.n - a.n);
  }, [stats]);

  const max = funnel.length > 0 ? funnel[0].n : 1;
  const total = stats?.total ?? funnel.reduce((s, f) => s + f.n, 0);
  const last = funnel[funnel.length - 1]?.n ?? 0;
  const activeJDs = jobs.filter(j => j.status === "Active").length;
  const avgScore = stats?.avg_score;

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">Reports</h1>
          <div className="page-sub">All time · all positions</div>
        </div>
        <div className="row gap-8">
          <Btn icon={<Icons.Upload size={14} />}>Export</Btn>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <Kpi label="Total candidates" value={String(total)} />
        <Kpi label="Active positions" value={String(activeJDs)} />
        <Kpi label="Avg AI score" value={avgScore != null ? String(avgScore) : "—"} sub="of 5" />
        <Kpi label="In offer stage" value={String(last)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Funnel</span>
            <span className="card-sub">{total} → {last}</span>
          </div>
          <div style={{ padding: "14px 18px" }}>
            {loading && <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>Loading…</div>}
            {funnel.map((f, i) => {
              const next = funnel[i + 1];
              const conv = next && f.n > 0 ? Math.round((next.n / f.n) * 100) : null;
              return (
                <div key={f.stage} style={{ marginBottom: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <span className="text-13 weight-500">{f.stage}</span>
                    <span className="text-mono text-13">{f.n}</span>
                  </div>
                  <div style={{ height: 22, background: "var(--bg-sunken)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                    <div style={{ width: max > 0 ? `${(f.n / max) * 100}%` : "0%", height: "100%", background: `oklch(${0.5 + i * 0.04} 0.08 285)`, borderRadius: 4 }} />
                  </div>
                  {conv != null && (
                    <div className="text-12 text-muted" style={{ marginTop: 2, marginLeft: 12 }}>↓ {conv}% pass</div>
                  )}
                </div>
              );
            })}
            {!loading && funnel.length === 0 && (
              <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>No candidate data yet.</div>
            )}
          </div>
        </div>

        <div className="col gap-16">
          <div className="card">
            <div className="card-header"><span className="card-title">Source mix</span><span className="card-sub">applies</span></div>
            <div style={{ padding: "14px 18px" }}>
              {sources.map(s => (
                <div key={s.source} style={{ marginBottom: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="text-13">{s.source}</span>
                    <span className="text-mono text-12">{s.n}</span>
                  </div>
                  <div style={{ height: 4, background: "var(--bg-sunken)", borderRadius: 999, marginTop: 4, position: "relative" }}>
                    <div style={{ width: sources[0]?.n > 0 ? `${(s.n / sources[0].n) * 100}%` : "0%", height: "100%", background: "var(--ink)", borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ai-panel card-pad">
            <span className="ai-tag" style={{ display: "inline-flex", marginBottom: 8 }}><Icons.Sparkles size={11} /> Insight</span>
            <div className="text-13" style={{ lineHeight: 1.55 }}>
              {sources.length > 0 && sources[0].n > 0
                ? <><strong>{sources[0].source}</strong> is the top source with {sources[0].n} candidates. Consider investing there to accelerate hiring.</>
                : "Add candidates to see sourcing insights."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Kpi = ({ label, value, trend, trendDir, sub }) => (
  <div className="card card-pad col gap-4">
    <span className="text-12 text-muted">{label}</span>
    <div className="row gap-8" style={{ alignItems: "baseline" }}>
      <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{value}</span>
      {trend && (
        <span className="text-12" style={{ color: trendDir === "up" ? "var(--positive)" : trendDir === "down" ? "var(--positive)" : "var(--ink-muted)" }}>
          {trend}
        </span>
      )}
    </div>
    {sub && <span className="text-12 text-muted">{sub}</span>}
  </div>
);

window.ReportsScreen = ReportsScreen;
