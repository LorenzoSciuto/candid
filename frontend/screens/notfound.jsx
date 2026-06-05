// 404 — job-themed not-found screen

const NotFoundScreen = ({ onRoute }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1800);
    return () => clearInterval(timer);
  }, []);

  const statuses = ["Under Review", "Screening", "On Hold", "Eliminated", "404 Not Found"];
  const currentStatus = statuses[tick % statuses.length];

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 40, background: "var(--bg)",
    }}>
      <div style={{ maxWidth: 560, width: "100%" }}>

        {/* Big 404 */}
        <div style={{
          fontFamily: "var(--font-mono, monospace)", fontSize: 96, fontWeight: 700,
          letterSpacing: "-0.06em", lineHeight: 1, color: "var(--ink)",
          opacity: 0.08, userSelect: "none", marginBottom: -16,
        }}>
          404
        </div>

        {/* Fake job card */}
        <div className="card" style={{ padding: "28px 28px 24px", position: "relative", overflow: "hidden" }}>

          {/* Watermark */}
          <div style={{
            position: "absolute", top: 16, right: 20,
            fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, fontWeight: 600,
            letterSpacing: "0.12em", color: "var(--danger)", opacity: 0.55,
            textTransform: "uppercase", border: "1.5px solid var(--danger)",
            borderRadius: 3, padding: "2px 6px",
          }}>
            Position Closed
          </div>

          {/* Company / org line */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "var(--bg-sunken)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-muted)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>Candid · Workspace</div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Page not found in our system</div>
            </div>
          </div>

          {/* Job title */}
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", margin: "0 0 8px", color: "var(--ink)" }}>
            This Page Has Left the Building
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-secondary)", margin: "0 0 22px", lineHeight: 1.6 }}>
            The route you followed didn't pass the screening round.
            It may have been moved, deleted, or never existed in the first place.
          </p>

          {/* Fake meta row */}
          <div style={{
            display: "flex", gap: 20, flexWrap: "wrap",
            padding: "14px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
            marginBottom: 22, fontSize: 12.5,
          }}>
            {[
              { icon: "📍", label: "Location", value: "Nowhere, Internet" },
              { icon: "💼", label: "Type", value: "Ghost Route" },
              { icon: "🕐", label: "Openings", value: "0" },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ minWidth: 100 }}>
                <div style={{ color: "var(--ink-muted)", fontSize: 11, marginBottom: 2 }}>{label}</div>
                <div style={{ color: "var(--ink)", fontWeight: 500 }}>{icon} {value}</div>
              </div>
            ))}
          </div>

          {/* Animated status pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>Application status:</span>
            <span style={{
              fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
              background: currentStatus === "404 Not Found" ? "color-mix(in srgb, var(--danger) 12%, transparent)" : "var(--bg-sunken)",
              color: currentStatus === "404 Not Found" ? "var(--danger)" : "var(--ink-secondary)",
              border: `1px solid ${currentStatus === "404 Not Found" ? "color-mix(in srgb, var(--danger) 30%, transparent)" : "var(--border)"}`,
              transition: "all 0.4s ease",
            }}>
              {currentStatus}
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => onRoute("pipeline")}
              style={{
                padding: "9px 20px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                background: "var(--ink)", color: "var(--bg)", border: "none",
                cursor: "pointer", letterSpacing: "-0.01em",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              Back to Pipeline
            </button>
            <button
              onClick={() => onRoute("candidates")}
              style={{
                padding: "9px 20px", borderRadius: 8, fontSize: 13.5, fontWeight: 500,
                background: "transparent", color: "var(--ink-secondary)",
                border: "1px solid var(--border)", cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-sunken)"; e.currentTarget.style.color = "var(--ink)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-secondary)"; }}
            >
              View Candidates
            </button>
          </div>
        </div>

        {/* Footer hint */}
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--ink-muted)", textAlign: "center" }}>
          If you believe this is a mistake, contact your workspace admin.
        </div>
      </div>
    </div>
  );
};

window.NotFoundScreen = NotFoundScreen;
