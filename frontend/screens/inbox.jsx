// Inbox — real-time notifications from the API
const { useState, useEffect, useCallback } = React;

const CATEGORY_ICON = {
  candidate: () => <Icons.Users size={16} />,
  analysis:  () => <Icons.Sparkles size={16} />,
  interview: () => <Icons.Calendar size={16} />,
  invitation: () => <Icons.Mail size={16} />,
  system:    () => <Icons.Settings size={14} />,
};

const CATEGORY_STYLE = {
  candidate:  { background: "var(--bg-sunken)",   color: "var(--ink-secondary)" },
  analysis:   { background: "var(--ai-soft)",     color: "var(--ai)" },
  interview:  { background: "var(--bg-sunken)",   color: "var(--ink-secondary)" },
  invitation: { background: "var(--bg-sunken)",   color: "var(--ink-secondary)" },
  system:     { background: "var(--bg-sunken)",   color: "var(--ink-muted)" },
};

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

const NotificationRow = ({ notification, onMarkRead }) => {
  const iconStyle = {
    width: 36, height: 36, borderRadius: 8,
    display: "grid", placeItems: "center", flexShrink: 0,
    ...(CATEGORY_STYLE[notification.category] || CATEGORY_STYLE.system),
  };
  const CategoryIcon = CATEGORY_ICON[notification.category] || CATEGORY_ICON.system;

  const rowStyle = {
    padding: 14, gap: 14, alignItems: "flex-start",
    opacity: notification.is_read ? 0.65 : 1,
    cursor: notification.is_read ? "default" : "pointer",
  };

  const handleClick = () => {
    if (!notification.is_read) onMarkRead(notification.id);
  };

  return (
    <div className="card row" style={rowStyle} onClick={handleClick}>
      <span style={iconStyle}><CategoryIcon /></span>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <div className="row gap-8" style={{ marginBottom: 4, alignItems: "center" }}>
          <span className="weight-500">{notification.title}</span>
          {!notification.is_read && (
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--accent)", flexShrink: 0,
            }} />
          )}
          <Badge kind={notification.category === "analysis" ? "ai" : "neutral"} style={{ marginLeft: "auto" }}>
            {notification.category}
          </Badge>
        </div>
        <span className="text-13 text-secondary" style={{ marginBottom: 6 }}>
          {notification.body}
        </span>
        <span className="text-12 text-muted">
          {_relativeTime(notification.created_at)}
        </span>
      </div>
    </div>
  );
};

const InboxScreen = ({ onRoute }) => {
  const t = window.useT ? window.useT() : k => k;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const loadNotifications = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${window.API_BASE}/notifications`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const handleMarkRead = useCallback((notificationId) => {
    fetch(`${window.API_BASE}/notifications/${notificationId}/read`, { method: "PATCH" })
      .then(r => r.ok ? r.json() : null)
      .then(updated => {
        if (!updated) return;
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      })
      .catch(() => {});
  }, []);

  const handleMarkAllRead = useCallback(() => {
    fetch(`${window.API_BASE}/notifications/read-all`, { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        if (!result) return;
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      })
      .catch(() => {});
  }, []);

  const visibleNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.is_read;
    if (filter === "analysis") return n.category === "analysis";
    return true;
  });

  const subtitle = loading
    ? t("common.loading")
    : error
    ? `Error: ${error}`
    : `${unreadCount} unread`;

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t("nav.inbox")}</h1>
          <div className="page-sub">{subtitle}</div>
        </div>
        <div className="row gap-8">
          <SegControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all",      label: "All" },
              { value: "unread",   label: "Unread" },
              { value: "analysis", label: "AI" },
            ]}
          />
          <Btn onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            Mark all read
          </Btn>
        </div>
      </div>

      {loading && (
        <div className="text-secondary" style={{ padding: 32, textAlign: "center" }}>
          {t("common.loading")}
        </div>
      )}

      {!loading && error && (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--error)" }}>
          Failed to load notifications: {error}
        </div>
      )}

      {!loading && !error && visibleNotifications.length === 0 && (
        <div className="card col" style={{ padding: 48, alignItems: "center", gap: 12 }}>
          <Icons.Inbox size={32} style={{ color: "var(--ink-muted)" }} />
          <span className="text-secondary">
            {filter === "unread" ? "No unread notifications." : "No notifications yet."}
          </span>
        </div>
      )}

      {!loading && !error && visibleNotifications.length > 0 && (
        <div className="col gap-8">
          {visibleNotifications.map(notification => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      )}
    </div>
  );
};

window.InboxScreen = InboxScreen;
