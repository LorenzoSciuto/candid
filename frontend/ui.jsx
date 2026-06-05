// Candid — UI primitives, icons, sidebar
const { useState, useEffect, useRef, useMemo, useCallback, useContext } = React;

// ---- Icons (Lucide-style, hand-tuned 16px) ----
const Icon = ({ d, size = 16, stroke = 1.6, fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d}
  </svg>
);

const Icons = {
  Search: (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>} />,
  Plus: (p) => <Icon {...p} d={<><path d="M12 5v14M5 12h14" /></>} />,
  ChevronDown: (p) => <Icon {...p} d={<path d="m6 9 6 6 6-6" />} />,
  ChevronRight: (p) => <Icon {...p} d={<path d="m9 6 6 6-6 6" />} />,
  ChevronLeft: (p) => <Icon {...p} d={<path d="m15 6-6 6 6 6" />} />,
  X: (p) => <Icon {...p} d={<><path d="M18 6 6 18M6 6l12 12" /></>} />,
  Layout: (p) => <Icon {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M3 9h18" /></>} />,
  Users: (p) => <Icon {...p} d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />,
  User: (p) => <Icon {...p} d={<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />,
  Briefcase: (p) => <Icon {...p} d={<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>} />,
  FileText: (p) => <Icon {...p} d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></>} />,
  Mic: (p) => <Icon {...p} d={<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" /></>} />,
  Calendar: (p) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />,
  Inbox: (p) => <Icon {...p} d={<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>} />,
  BarChart: (p) => <Icon {...p} d={<><path d="M3 3v18h18" /><path d="M7 16V9M12 16V5M17 16v-4" /></>} />,
  Bell: (p) => <Icon {...p} d={<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>} />,
  BellOff: (p) => <Icon {...p} d={<><path d="M8.7 3A6 6 0 0 1 18 8a21 21 0 0 0 .6 5" /><path d="M17 17H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20" /></>} />,
  Settings: (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>} />,
  Sparkles: (p) => <Icon {...p} d={<><path d="m12 3 1.9 5.5L19 10l-5.1 1.5L12 17l-1.9-5.5L5 10l5.1-1.5z" /><path d="M19 3v4M21 5h-4M5 17v3M6.5 18.5h-3" /></>} />,
  Upload: (p) => <Icon {...p} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8 12 3 7 8M12 3v12" /></>} />,
  Mail: (p) => <Icon {...p} d={<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 7L2 7" /></>} />,
  Phone: (p) => <Icon {...p} d={<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 13 13 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 13 13 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />} />,
  MapPin: (p) => <Icon {...p} d={<><path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>} />,
  Filter: (p) => <Icon {...p} d={<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />} />,
  MoreH: (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>} />,
  Check: (p) => <Icon {...p} d={<path d="M20 6 9 17l-5-5" />} />,
  Pause: (p) => <Icon {...p} d={<><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>} fill="currentColor" stroke="none" />,
  Play: (p) => <Icon {...p} d={<path d="M5 3v18l15-9z" />} fill="currentColor" stroke="none" />,
  Square: (p) => <Icon {...p} d={<rect x="5" y="5" width="14" height="14" rx="1" />} fill="currentColor" stroke="none" />,
  Save: (p) => <Icon {...p} d={<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>} />,
  Edit: (p) => <Icon {...p} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" /></>} />,
  Star: (p) => <Icon {...p} d={<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />} />,
  ArrowRight: (p) => <Icon {...p} d={<><path d="M5 12h14M13 5l7 7-7 7" /></>} />,
  Copy: (p) => <Icon {...p} d={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>} />,
  ClipPaste: (p) => <Icon {...p} d={<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>} />,
  Lock: (p) => <Icon {...p} d={<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>} />,
  Eye: (p) => <Icon {...p} d={<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>} />,
  Download: (p) => <Icon {...p} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>} />,
  TrendUp: (p) => <Icon {...p} d={<><path d="m23 6-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></>} />,
  Building: (p) => <Icon {...p} d={<><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-5h6v5M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01" /></>} />,
  Award: (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></>} />,
  UserCheck: (p) => <Icon {...p} d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></>} />,
  EyeOff: (p) => <Icon {...p} d={<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>} />,
  Archive: (p) => <Icon {...p} d={<><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" rx="1" /><line x1="10" y1="12" x2="14" y2="12" /></>} />,
  RotateCcw: (p) => <Icon {...p} d={<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" /></>} />,
  Trash: (p) => <Icon {...p} d={<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" /></>} />,
  UserX: (p) => <Icon {...p} d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="8" x2="23" y2="14" /><line x1="23" y1="8" x2="17" y2="14" /></>} />,
  Link: (p) => <Icon {...p} d={<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>} />,
  ExternalLink: (p) => <Icon {...p} d={<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>} />,
};

// ---- ConfirmDialog ----
const ConfirmDialog = ({ title, message, confirmLabel, onConfirm, onCancel }) => {
  const t = window.useT ? window.useT() : (k) => k;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 700 }}
      onClick={onCancel}>
      <div className="card col" style={{ width: 420, padding: 28, gap: 20 }} onClick={e => e.stopPropagation()}>
        <div className="col gap-6">
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>{title}</span>
          {message && <span className="text-13 text-secondary">{message}</span>}
        </div>
        <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
          <Btn onClick={onCancel}>{t('common.cancel')}</Btn>
          <Btn kind="danger" onClick={onConfirm}>{confirmLabel || t('common.delete')}</Btn>
        </div>
      </div>
    </div>
  );
};

// ---- Primitives ----
const Btn = ({ kind = "secondary", size, icon, children, onClick, disabled, type, title, style }) => (
  <button
    type={type || "button"}
    title={title}
    disabled={disabled}
    onClick={onClick}
    style={style}
    className={`btn btn-${kind} ${size ? "btn-" + size : ""} ${!children ? "btn-icon" : ""}`}
  >
    {icon}
    {children}
  </button>
);

const Badge = ({ children, kind, dot, style }) => (
  <span className={`badge${kind ? " " + kind : ""}`} style={style}>
    {dot && <span className="dot" style={{ background: dot }} />}
    {children}
  </span>
);

const _TERMINAL_BADGE = {
  hired:    { dot: "#22c55e", label: "Hired" },
  Rejected: { dot: "#ef4444", label: "Rejected" },
  archived: { dot: "#94a3b8", label: "Archived" },
};
const StatusBadge = ({ status }) => {
  const s = window.CANDID_DATA.STATUS.find(x => x.id === status) || _TERMINAL_BADGE[status];
  if (!s) return null;
  return <Badge dot={s.dot}>{s.label}</Badge>;
};

const Avatar = ({ name, size = "", src }) => {
  if (src) return <img src={src} className={`avatar ${size}`} style={{ objectFit: "cover" }} referrerPolicy="no-referrer" />;
  const init = window.CANDID_DATA.initials(name || "?");
  const hue = [...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <span className={`avatar ${size}`} style={{ background: `oklch(0.93 0.04 ${hue})`, color: `oklch(0.4 0.08 ${hue})` }}>{init}</span>;
};

const Modal = ({ open, onClose, title, children, footer, width, disableBackdropClose = true }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={disableBackdropClose ? undefined : onClose}>
      <div className="modal" style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="weight-600">{title}</div>
          <button className="icon-btn" onClick={onClose}><Icons.X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

const Rating = ({ value, onChange, max = 5 }) => (
  <span className="rating">
    {Array.from({ length: max }).map((_, i) => (
      <button key={i} className={i < value ? "on" : ""} onClick={() => onChange && onChange(i + 1)}>{i + 1}</button>
    ))}
  </span>
);

const SegControl = ({ value, onChange, options }) => (
  <div className="seg">
    {options.map((o) => (
      <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

// ---- Sidebar ----
const SIDE_NAV = [
  { id: "pipeline", key: "nav.pipeline", icon: Icons.Layout },
  { id: "candidates", key: "nav.candidates", icon: Icons.Users },
  { id: "jobs", key: "nav.positions", icon: Icons.Briefcase },
  { id: "roles", key: "nav.roles", icon: Icons.Award },
  { id: "employees", key: "nav.employees", icon: Icons.UserCheck },
  { id: "interviews", key: "nav.interviews", icon: Icons.Calendar },
  { id: "inbox", key: "nav.inbox", icon: Icons.Inbox },
  { id: "reports", key: "nav.reports", icon: Icons.BarChart },
];

const Sidebar = ({ route, onRoute, counts, onQuickAdd, user, onLogout, onSwitchOrg, onCreateOrg }) => {
  const t = window.useT ? window.useT() : (k) => k;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [userMenuOpen]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">C</span>
        Candid
      </div>
      {SIDE_NAV.map((it) => {
        const I = it.icon;
        return (
          <div key={it.id} className={`side-item ${route === it.id ? "active" : ""}`} onClick={() => onRoute(it.id)}>
            <I size={15} />
            <span>{t(it.key)}</span>
            {counts && counts[it.id] != null && <span className="count">{counts[it.id]}</span>}
          </div>
        );
      })}

      <div className="side-spacer" />

      {/* User card with popover */}
      <div ref={menuRef} style={{ position: "relative" }}>
        {userMenuOpen && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: 8, right: 8,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden",
          }}>
            {/* User info */}
            <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border-soft)" }}>
              <div className="row gap-10" style={{ alignItems: "center" }}>
                <Avatar name={user?.name || "User"} src={user?.picture} size="lg" />
                <div className="col" style={{ minWidth: 0 }}>
                  <span className="text-13 weight-600" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "Guest"}</span>
                  <span className="text-12 text-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || "—"}</span>
                  {(user?.title || user?.role) && <span className="text-11 text-muted" style={{ marginTop: 1 }}>{user.title || user.role}</span>}
                </div>
              </div>
            </div>
            {/* Org section */}
            {(user?.orgs?.length > 0) && (
              <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border-soft)" }}>
                <div className="text-11 text-muted" style={{ padding: "2px 16px 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Organization</div>
                {user.orgs.map(org => (
                  <button key={org.id} className="btn btn-ghost" style={{ width: "100%", justifyContent: "space-between", padding: "6px 16px", borderRadius: 0, fontSize: 13 }}
                    onClick={() => { setUserMenuOpen(false); org.id !== user.org_id && onSwitchOrg && onSwitchOrg(org.id); }}>
                    <span className="row gap-8">
                      <span style={{ width: 18, height: 18, borderRadius: 4, background: "var(--ink)", display: "grid", placeItems: "center", color: "white", fontSize: 9, fontWeight: 700 }}>
                        {org.name[0].toUpperCase()}
                      </span>
                      {org.name}
                    </span>
                    {org.id === user.org_id && <Icons.Check size={12} />}
                  </button>
                ))}
                <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", padding: "6px 16px", borderRadius: 0, fontSize: 13, color: "var(--ink-secondary)" }}
                  onClick={() => { setUserMenuOpen(false); onCreateOrg && onCreateOrg(); }}>
                  <Icons.Plus size={12} style={{ marginRight: 8 }} /> New organization
                </button>
              </div>
            )}
            <div style={{ padding: "6px 0" }}>
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", padding: "8px 16px", borderRadius: 0, fontSize: 13, color: "var(--danger)" }}
                onClick={() => { setUserMenuOpen(false); onLogout && onLogout(); }}>
                <Icons.ArrowRight size={14} style={{ marginRight: 8, transform: "rotate(180deg)" }} />
                {t('user.signOut')}
              </button>
            </div>
          </div>
        )}
        <div className="user-card" onClick={() => setUserMenuOpen(v => !v)} style={{ cursor: "pointer" }}>
          <Avatar name={user?.name || "User"} src={user?.picture} />
          <div className="col" style={{ minWidth: 0 }}>
            <span className="text-13 weight-500" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "Guest"}</span>
            <span className="text-12 text-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.role || user?.email || "—"}</span>
          </div>
          <Icons.ChevronDown size={12} style={{ color: "var(--ink-muted)", flexShrink: 0, transform: userMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </div>
    </aside>
  );
};

// ---- Topbar ----
const Topbar = ({ crumbs, actions }) => (
  <div className="topbar">
    <div className="crumbs">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="sep"><Icons.ChevronRight size={14} /></span>}
          <span className={i === crumbs.length - 1 ? "here" : ""}>{c}</span>
        </React.Fragment>
      ))}
    </div>
    <div className="topbar-actions">{actions}</div>
  </div>
);

// ---- RoleSelect / JDSelect — API-backed dropdowns with mock fallback ----

const useApiData = (endpoint, fallback) => {
  const [data, setData] = useState(fallback);
  useEffect(() => {
    fetch(`${window.API_BASE}${endpoint}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d)) setData(d); })
      .catch(() => {});
  }, [endpoint]);
  return data;
};

const RoleSelect = ({ value, onChange, placeholder = "Select role…", style, className }) => {
  const roles = useApiData("/roles", window.CANDID_DATA.ROLES || []);
  return (
    <select
      className={className || "select"}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      style={style}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {roles.map(r => <option key={r.id} value={r.id}>{r.name}{r.department ? ` · ${r.department}` : ""}</option>)}
    </select>
  );
};

const JDSelect = ({ value, onChange, roleId, placeholder = "Select position…", style, className }) => {
  const allJds = useApiData(`/job-descriptions${roleId ? `?role_id=${roleId}` : ""}`, window.CANDID_DATA.JDS_DATA || []);
  const jds = roleId ? allJds.filter(j => j.role_id === roleId) : allJds;
  return (
    <select
      className={className || "select"}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      style={style}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {jds.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
    </select>
  );
};

const Tooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const show = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
    setVisible(true);
  };

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={show} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "8px 12px", maxWidth: 260,
          fontSize: 12, lineHeight: 1.55, color: "var(--ink-secondary)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)", pointerEvents: "none",
        }}>
          {text}
        </div>
      )}
    </span>
  );
};

Object.assign(window, { Icons, Icon, Btn, Badge, StatusBadge, Avatar, Modal, ConfirmDialog, Rating, SegControl, Sidebar, Topbar, RoleSelect, JDSelect, Tooltip, useContext, useApiData });
