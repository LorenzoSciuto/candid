// Inbox / activity feed
const InboxScreen = ({ onRoute }) => {
  const items = [
    { id: 1, kind: "ai", who: "Co-pilot", when: "5m ago", title: "Pre-interview analysis ready for Hana Ito", body: "3 strengths, 4 gaps, 3 questions. Strongest match on accessibility and component API design.", action: "Open analysis" },
    { id: 2, kind: "interview", who: "Sasha Rivera", when: "2h ago", title: "Hiring manager round complete — Maya Chen", body: "Transcript and summary attached. AI suggests Strong Hire.", action: "Open candidate" },
    { id: 3, kind: "ai", who: "Co-pilot", when: "3h ago", title: "Daniel Park ranked Lean No after tech screen", body: "Weak signal on perf and observability. Confidence 0.81.", action: "Review" },
    { id: 4, kind: "system", who: "System", when: "Yesterday", title: "Olivia Bauer moved to Pre-Interview", body: "Devon Park advanced candidate after recruiter screen.", action: "View" },
    { id: 5, kind: "mention", who: "Avi Chen", when: "Yesterday", title: "@Sasha — can you take the May 11 deep dive?", body: "Tomás Rivera's tech screen is on my calendar but I'm out. Let me know.", action: "Reply" },
    { id: 6, kind: "ai", who: "Co-pilot", when: "2 days ago", title: "Pipeline anomaly detected", body: "Pre-Interview stage has 3 candidates idle for 7+ days. Want me to nudge recruiters?", action: "See suggestion" },
  ];

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">Inbox</h1>
          <div className="page-sub">6 updates · 2 require your attention</div>
        </div>
        <div className="row gap-8">
          <SegControl value="all" onChange={() => {}} options={[{ value: "all", label: "All" }, { value: "ai", label: "AI" }, { value: "mentions", label: "Mentions" }]} />
          <Btn>Mark all read</Btn>
        </div>
      </div>

      <div className="col gap-8">
        {items.map(it => (
          <div key={it.id} className="card row" style={{ padding: 14, gap: 14, alignItems: "flex-start" }}>
            {it.kind === "ai" ? (
              <span style={{ width: 36, height: 36, borderRadius: 8, background: "var(--ai-soft)", color: "var(--ai)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icons.Sparkles size={16} /></span>
            ) : it.kind === "system" ? (
              <span style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-sunken)", color: "var(--ink-secondary)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icons.Settings size={14} /></span>
            ) : (
              <Avatar name={it.who} size="lg" />
            )}
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <div className="row gap-8" style={{ marginBottom: 4 }}>
                <span className="weight-500">{it.title}</span>
                {it.kind === "ai" && <Badge kind="ai">AI</Badge>}
                {it.kind === "mention" && <Badge kind="info">Mention</Badge>}
              </div>
              <span className="text-13 text-secondary" style={{ marginBottom: 6 }}>{it.body}</span>
              <span className="text-12 text-muted">{it.who} · {it.when}</span>
            </div>
            <Btn onClick={() => onRoute && onRoute("preinterview")}>{it.action}</Btn>
          </div>
        ))}
      </div>
    </div>
  );
};

window.InboxScreen = InboxScreen;
