// Inbox — notifications + email history
const { useState, useEffect, useCallback } = React;

const _relativeTime = (isoString) => {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1)   return "Yesterday";
  return `${days} days ago`;
};

// ── Notifications ─────────────────────────────────────────────────────────────

const NOTIF_ICON = {
  candidate:  () => <Icons.Users size={16} />,
  analysis:   () => <Icons.Sparkles size={16} />,
  interview:  () => <Icons.Calendar size={16} />,
  invitation: () => <Icons.Mail size={16} />,
  system:     () => <Icons.Settings size={14} />,
};

const NOTIF_STYLE = {
  candidate:  { background: "var(--bg-sunken)", color: "var(--ink-secondary)" },
  analysis:   { background: "var(--ai-soft)",   color: "var(--ai)" },
  interview:  { background: "var(--bg-sunken)", color: "var(--ink-secondary)" },
  invitation: { background: "var(--bg-sunken)", color: "var(--ink-secondary)" },
  system:     { background: "var(--bg-sunken)", color: "var(--ink-muted)" },
};

const NotificationRow = ({ notification, onMarkRead }) => {
  const CategoryIcon = NOTIF_ICON[notification.category] || NOTIF_ICON.system;
  const iconStyle = {
    width: 36, height: 36, borderRadius: 8,
    display: "grid", placeItems: "center", flexShrink: 0,
    ...(NOTIF_STYLE[notification.category] || NOTIF_STYLE.system),
  };
  return (
    <div
      className="card row"
      style={{ padding: 14, gap: 14, alignItems: "flex-start", opacity: notification.is_read ? 0.65 : 1, cursor: notification.is_read ? "default" : "pointer" }}
      onClick={() => { if (!notification.is_read) onMarkRead(notification.id); }}
    >
      <span style={iconStyle}><CategoryIcon /></span>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <div className="row gap-8" style={{ marginBottom: 4, alignItems: "center" }}>
          <span className="weight-500">{notification.title}</span>
          {!notification.is_read && (
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
          )}
          <Badge kind={notification.category === "analysis" ? "ai" : "neutral"} style={{ marginLeft: "auto" }}>
            {notification.category}
          </Badge>
        </div>
        <span className="text-13 text-secondary" style={{ marginBottom: 6 }}>{notification.body}</span>
        <span className="text-12 text-muted">{_relativeTime(notification.created_at)}</span>
      </div>
    </div>
  );
};

const NotificationsPane = () => {
  const t = window.useT ? window.useT() : k => k;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [filter, setFilter]               = useState("all");

  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetch(`${window.API_BASE}/notifications`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setNotifications(d.notifications || []); setUnreadCount(d.unread_count || 0); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = useCallback((id) => {
    fetch(`${window.API_BASE}/notifications/${id}/read`, { method: "PATCH" })
      .then(r => r.ok ? r.json() : null)
      .then(updated => {
        if (!updated) return;
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }).catch(() => {});
  }, []);

  const handleMarkAllRead = useCallback(() => {
    fetch(`${window.API_BASE}/notifications/read-all`, { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        if (!result) return;
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }).catch(() => {});
  }, []);

  const visible = notifications.filter(n => {
    if (filter === "unread")   return !n.is_read;
    if (filter === "analysis") return n.category === "analysis";
    return true;
  });

  return (
    <div>
      <div className="row gap-8" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <span className="text-13 text-secondary">{loading ? t("common.loading") : error ? `Error: ${error}` : `${unreadCount} unread`}</span>
        <div className="row gap-8">
          <SegControl
            value={filter} onChange={setFilter}
            options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }, { value: "analysis", label: "AI" }]}
          />
          <Btn onClick={handleMarkAllRead} disabled={unreadCount === 0}>Mark all read</Btn>
        </div>
      </div>

      {loading && <div className="text-secondary" style={{ padding: 32, textAlign: "center" }}>{t("common.loading")}</div>}
      {!loading && error && <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--error)" }}>Failed to load: {error}</div>}
      {!loading && !error && visible.length === 0 && (
        <div className="card col" style={{ padding: 48, alignItems: "center", gap: 12 }}>
          <Icons.Inbox size={32} style={{ color: "var(--ink-muted)" }} />
          <span className="text-secondary">{filter === "unread" ? "No unread notifications." : "No notifications yet."}</span>
        </div>
      )}
      {!loading && !error && visible.length > 0 && (
        <div className="col gap-8">
          {visible.map(n => <NotificationRow key={n.id} notification={n} onMarkRead={handleMarkRead} />)}
        </div>
      )}
    </div>
  );
};

// ── Email history ─────────────────────────────────────────────────────────────

const EMAIL_TYPE_BADGE = {
  rejection:  "error",
  invitation: "neutral",
  otp:        "neutral",
  general:    "neutral",
  manual:     "neutral",
};

const EmailRow = ({ email }) => {
  const isSent = email.direction === "sent";
  const iconStyle = {
    width: 36, height: 36, borderRadius: 8,
    display: "grid", placeItems: "center", flexShrink: 0,
    background: isSent ? "var(--bg-sunken)" : "var(--ai-soft)",
    color: isSent ? "var(--ink-secondary)" : "var(--ai)",
  };
  const counterparty = isSent ? email.to_email : email.from_email;
  return (
    <div className="card row" style={{ padding: 14, gap: 14, alignItems: "flex-start" }}>
      <span style={iconStyle}>
        {isSent ? <Icons.Upload size={15} /> : <Icons.Mail size={15} />}
      </span>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <div className="row gap-8" style={{ marginBottom: 4, alignItems: "center" }}>
          <span className="weight-500" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email.subject || "(no subject)"}
          </span>
          <Badge kind={EMAIL_TYPE_BADGE[email.email_type] || "neutral"} style={{ marginLeft: "auto", flexShrink: 0 }}>
            {email.email_type}
          </Badge>
        </div>
        <span className="text-13 text-secondary" style={{ marginBottom: 4 }}>
          {isSent ? "To: " : "From: "}{counterparty || "—"}
        </span>
        <span className="text-12 text-muted">{_relativeTime(email.sent_at)}</span>
      </div>
    </div>
  );
};

const LogReceivedModal = ({ onClose, onSaved }) => {
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject]     = useState("");
  const [body, setBody]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  const handleSave = () => {
    if (!fromEmail.trim() || !subject.trim()) return;
    setSaving(true); setError(null);
    fetch(`${window.API_BASE}/emails/received`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_email: fromEmail.trim(), subject: subject.trim(), body: body.trim() }),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(() => { onSaved(); onClose(); })
      .catch(err => setError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <Modal title="Log received email" onClose={onClose}>
      <div className="col gap-12" style={{ padding: "0 0 4px" }}>
        <label className="col gap-4">
          <span className="text-13 text-secondary">From *</span>
          <input className="input" placeholder="sender@example.com" value={fromEmail} onChange={e => setFromEmail(e.target.value)} />
        </label>
        <label className="col gap-4">
          <span className="text-13 text-secondary">Subject *</span>
          <input className="input" placeholder="Email subject" value={subject} onChange={e => setSubject(e.target.value)} />
        </label>
        <label className="col gap-4">
          <span className="text-13 text-secondary">Body</span>
          <textarea className="input" rows={4} placeholder="Email content…" style={{ resize: "vertical" }} value={body} onChange={e => setBody(e.target.value)} />
        </label>
        {error && <span className="text-13" style={{ color: "var(--error)" }}>{error}</span>}
        <div className="row gap-8" style={{ justifyContent: "flex-end", marginTop: 4 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" onClick={handleSave} disabled={saving || !fromEmail.trim() || !subject.trim()}>
            {saving ? "Saving…" : "Log email"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

const EmailsPane = () => {
  const t = window.useT ? window.useT() : k => k;
  const [emails, setEmails]           = useState([]);
  const [counts, setCounts]           = useState({ sent: 0, received: 0 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [direction, setDirection]     = useState("all");
  const [showLogModal, setShowLogModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const query = direction !== "all" ? `?direction=${direction}` : "";
    fetch(`${window.API_BASE}/emails${query}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        setEmails(d.emails || []);
        setCounts({ sent: d.sent_count || 0, received: d.received_count || 0 });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [direction]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="row gap-8" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <span className="text-13 text-secondary">
          {loading ? t("common.loading") : error ? `Error: ${error}` : `${counts.sent} sent · ${counts.received} received`}
        </span>
        <div className="row gap-8">
          <SegControl
            value={direction} onChange={setDirection}
            options={[{ value: "all", label: "All" }, { value: "sent", label: "Sent" }, { value: "received", label: "Received" }]}
          />
          <Btn kind="primary" onClick={() => setShowLogModal(true)}>Log received</Btn>
        </div>
      </div>

      {loading && <div className="text-secondary" style={{ padding: 32, textAlign: "center" }}>{t("common.loading")}</div>}
      {!loading && error && <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--error)" }}>Failed to load: {error}</div>}
      {!loading && !error && emails.length === 0 && (
        <div className="card col" style={{ padding: 48, alignItems: "center", gap: 12 }}>
          <Icons.Mail size={32} style={{ color: "var(--ink-muted)" }} />
          <span className="text-secondary">No emails yet.</span>
          <Btn kind="primary" onClick={() => setShowLogModal(true)}>Log received email</Btn>
        </div>
      )}
      {!loading && !error && emails.length > 0 && (
        <div className="col gap-8">
          {emails.map(email => <EmailRow key={email.id} email={email} />)}
        </div>
      )}

      {showLogModal && (
        <LogReceivedModal onClose={() => setShowLogModal(false)} onSaved={load} />
      )}
    </div>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────

const InboxScreen = ({ onRoute }) => {
  const t = window.useT ? window.useT() : k => k;
  const [tab, setTab] = useState("notifications");

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t("nav.inbox")}</h1>
        </div>
        <SegControl
          value={tab} onChange={setTab}
          options={[
            { value: "notifications", label: "Notifications" },
            { value: "emails",        label: "Emails" },
          ]}
        />
      </div>

      {tab === "notifications" && <NotificationsPane />}
      {tab === "emails"        && <EmailsPane />}
    </div>
  );
};

window.InboxScreen = InboxScreen;
