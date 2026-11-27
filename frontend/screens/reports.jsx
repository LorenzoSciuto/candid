// Reports / analytics

const ReportsScreen = () => {
  const t = window.useT();
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

  const funnel = useMemo(() => {
    if (!stats) return [];
    const byStatus = stats.by_status || {};
    const rows = (window.CANDID_DATA.STATUS || [])
      .map(st => ({ stage: st.label, n: byStatus[st.id] || 0 }))
      .filter(f => f.n > 0);
    // "reached" counts everyone at this stage or beyond (hired included), so pass rates never exceed 100%.
    let reached = byStatus.hired || 0;
    for (let i = rows.length - 1; i >= 0; i--) { reached += rows[i].n; rows[i].reached = reached; }
    return rows;
  }, [stats]);

  const sources = useMemo(() => {
    if (!stats?.by_source) return [];
    return Object.entries(stats.by_source)
      .map(([source, n]) => ({ source, n }))
      .sort((a, b) => b.n - a.n);
  }, [stats]);

  const max = Math.max(1, ...funnel.map(f => f.n));
  const total = stats?.total ?? funnel.reduce((s, f) => s + f.n, 0);
  const last = funnel[funnel.length - 1]?.n ?? 0;
  const activeJDs = jobs.filter(j => j.status === "Active").length;
  const avgScore = stats?.avg_score;

  const exportCsv = () => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [[t('reports.csv.stage'), t('reports.csv.candidates')], ...funnel.map(f => [f.stage, f.n])];
    const blob = new Blob([rows.map(r => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candid-funnel-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('reports.title')}</h1>
          <div className="page-sub">{t('reports.sub')}</div>
        </div>
        <div className="row gap-8">
          <Btn icon={<Icons.Upload size={14} />} onClick={exportCsv} disabled={funnel.length === 0}>{t('reports.export')}</Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <Kpi label={t('reports.kpi.total')} value={String(total)} />
        <Kpi label={t('reports.kpi.active')} value={String(activeJDs)} />
        <Kpi label={t('reports.kpi.avgScore')} value={avgScore != null ? String(avgScore) : "—"} sub={t('reports.kpi.avgScoreSub')} />
        <Kpi label={t('reports.kpi.offer')} value={String(last)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('reports.funnel.title')}</span>
            <span className="card-sub">{total} → {last}</span>
          </div>
          <div style={{ padding: "14px 18px" }}>
            {loading && <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>{t('reports.loading')}</div>}
            {funnel.map((f, i) => {
              const next = funnel[i + 1];
              const conv = next ? Math.round((next.reached / f.reached) * 100) : null;
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
                    <div className="text-12 text-muted" style={{ marginTop: 2, marginLeft: 12 }}>↓ {conv}{t('reports.pass')}</div>
                  )}
                </div>
              );
            })}
            {!loading && funnel.length === 0 && (
              <div className="text-13 text-muted" style={{ padding: "24px 0", textAlign: "center" }}>{t('reports.noData')}</div>
            )}
          </div>
        </div>

        <div className="col gap-16">
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('reports.source.title')}</span>
              <span className="card-sub">{t('reports.source.sub')}</span>
            </div>
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
            <span className="ai-tag" style={{ display: "inline-flex", marginBottom: 8 }}><Icons.Sparkles size={11} /> {t('reports.insight')}</span>
            <div className="text-13" style={{ lineHeight: 1.55 }}>
              {sources.length > 0 && sources[0].n > 0
                ? <><strong>{sources[0].source}</strong> {t('reports.topSource').replace('{n}', sources[0].n)}</>
                : t('reports.addCandidates')}
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
