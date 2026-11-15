// 404 — recruiting-themed not-found screen.
// With onRoute it renders inside the app shell; without it, standalone (logged out / unknown public link).

const EmptyChair = () => (
  <svg width="132" height="112" viewBox="0 0 132 112" fill="none" aria-hidden="true">
    <ellipse cx="62" cy="104" rx="44" ry="5" fill="var(--bg-sunken)" />
    {/* Chair */}
    <g stroke="var(--ink-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="40" y="18" width="40" height="40" rx="8" fill="var(--surface)" />
      <path d="M34 62h52" />
      <path d="M40 62l-4 38M80 62l4 38M48 62l-1 22M72 62l1 22" />
    </g>
    {/* Magnifying glass */}
    <g stroke="var(--ai)" strokeWidth="3" strokeLinecap="round">
      <circle cx="100" cy="34" r="14" fill="var(--ai-soft)" />
      <path d="M110 44l12 12" />
    </g>
    <text x="100" y="39" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fontWeight="600" fill="var(--ai)">?</text>
  </svg>
);

const NotFoundScreen = ({ onRoute }) => {
  const t = window.useT();
  const inApp = !!onRoute;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: inApp ? "calc(100vh - 120px)" : "100vh",
      padding: "40px 16px", background: "var(--bg)", fontFamily: "var(--font-sans)",
    }}>
      <div className="card" style={{ maxWidth: 460, width: "100%", padding: "36px 28px 28px", textAlign: "center", boxShadow: "var(--shadow-md)" }}>
        <EmptyChair />

        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <span className="badge" style={{ fontFamily: "var(--font-mono)", color: "var(--danger)", background: "var(--danger-soft)", borderColor: "transparent" }}>
            404 · {t('notfound.status')}
          </span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: "14px 0 8px", color: "var(--ink)" }}>
          {t('notfound.title')}
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-secondary)", margin: "0 auto 24px", lineHeight: 1.6, maxWidth: 360 }}>
          {t('notfound.body')}
        </p>

        <div className="row gap-8" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          {inApp ? (
            <>
              <Btn kind="primary" icon={<Icons.Layout size={14} />} onClick={() => onRoute("pipeline")}>{t('notfound.toPipeline')}</Btn>
              <Btn icon={<Icons.Users size={14} />} onClick={() => onRoute("candidates")}>{t('notfound.toCandidates')}</Btn>
            </>
          ) : (
            <Btn kind="primary" onClick={() => { window.location.hash = ""; window.location.reload(); }}>{t('notfound.toHome')}</Btn>
          )}
        </div>

        <div style={{ marginTop: 20, fontSize: 12, color: "var(--ink-muted)" }}>
          {inApp ? t('notfound.hintApp') : t('notfound.hintPublic')}
        </div>
      </div>
    </div>
  );
};

window.NotFoundScreen = NotFoundScreen;
