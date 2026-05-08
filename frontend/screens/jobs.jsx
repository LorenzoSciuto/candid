// Jobs / Positions screen

const getLocations = () => {
  try {
    const stored = localStorage.getItem("candid_locations");
    if (stored) return JSON.parse(stored);
  } catch {}
  return ["Remote", "SF / Remote", "SF", "NYC", "London", "Berlin", "Austin", "Toronto"];
};

// ── Multi-owner select ────────────────────────────────────────────────────────

const OwnerSelect = ({ value, onChange }) => {
  // value: string[] of names
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const team = (window.getTeamMembers ? window.getTeamMembers() : []);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (name) => {
    const next = value.includes(name) ? value.filter(n => n !== name) : [...value, name];
    onChange(next);
  };

  const label = value.length === 0
    ? "— No owner —"
    : value.length === 1
    ? value[0]
    : `${value[0]} +${value.length - 1}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="select row" style={{ justifyContent: "space-between", cursor: "pointer", width: "100%" }}
        onClick={() => setOpen(v => !v)}>
        <span className={value.length === 0 ? "text-muted" : ""}>{label}</span>
        <Icons.ChevronDown size={12} style={{ color: "var(--ink-muted)" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", padding: 4, zIndex: 50 }}>
          {team.length === 0 && (
            <div className="text-12 text-muted" style={{ padding: "8px 12px" }}>No team members. Add them in Settings → Team.</div>
          )}
          {team.map(m => (
            <label key={m.name} className="row gap-8" style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 5, alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <input type="checkbox" checked={value.includes(m.name)} onChange={() => toggle(m.name)} style={{ accentColor: "var(--ink)" }} />
              <Avatar name={m.name} />
              <div className="col" style={{ minWidth: 0 }}>
                <span className="text-13 weight-500">{m.name}</span>
                {m.role && <span className="text-11 text-muted">{m.role}</span>}
              </div>
              {value.includes(m.name) && <Icons.Check size={12} style={{ marginLeft: "auto", color: "var(--positive)" }} />}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────

const JobsScreen = ({ onRoute }) => {
  const t = window.useT();
  const [jds, setJds] = useState(window.CANDID_DATA.JDS_DATA);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editJd, setEditJd] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const reload = () => {
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d)) setJds(d); })
      .catch(() => {});
  };
  useEffect(reload, []);

  const openMenu = (e, id) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(menuOpen === id ? null : id);
  };

  const changeStatus = (id, newStatus) => {
    setMenuOpen(null);
    setJds(prev => prev.map(j => j.id === id ? { ...j, status: newStatus } : j));
    fetch(`${window.API_BASE}/job-descriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
  };

  const deleteJd = (id) => {
    setMenuOpen(null);
    if (!confirm("Delete this position? This cannot be undone.")) return;
    setJds(prev => prev.filter(j => j.id !== id));
    fetch(`${window.API_BASE}/job-descriptions/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const roles = useMemo(() => {
    const map = {};
    (window.CANDID_DATA.ROLES || []).forEach(r => { map[r.id] = r; });
    return map;
  }, []);

  const rows = useMemo(() => jds.filter(j => {
    if (roleFilter && j.role_id !== roleFilter) return false;
    if (statusFilter && j.status !== statusFilter) return false;
    if (q) {
      const ql = q.toLowerCase();
      if (!(j.title + " " + (j.owner || "")).toLowerCase().includes(ql)) return false;
    }
    return true;
  }), [jds, roleFilter, statusFilter, q]);

  const activeCount = jds.filter(j => j.status === "Active").length;
  const totalOpenings = rows.reduce((s, j) => s + (j.openings || 1), 0);

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('jobs.title')}</h1>
          <div className="page-sub">{rows.length} of {jds.length} positions · {activeCount} active</div>
        </div>
        <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('jobs.new')}</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{t('jobs.kpi.total')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{jds.length}</span>
        </div>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{t('jobs.kpi.active')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--positive)" }}>{activeCount}</span>
        </div>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{t('jobs.kpi.openings')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{totalOpenings}</span>
        </div>
      </div>

      <div className="card" style={{ padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="row gap-6" style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", flex: "1 1 220px" }}>
          <Icons.Search size={14} style={{ color: "var(--ink-muted)" }} />
          <input className="input" style={{ border: 0, padding: "4px 0", background: "transparent" }} placeholder={t('jobs.searchPh')} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <RoleSelect value={roleFilter} onChange={setRoleFilter} placeholder={t('jobs.allRoles')} style={{ width: 220 }} />
        <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
          <option value="">{t('jobs.allStatuses')}</option>
          <option value="Active">{t('status.active')}</option>
          <option value="On hold">{t('status.onHold')}</option>
          <option value="Draft">{t('status.draft')}</option>
          <option value="Closed">{t('status.closed')}</option>
        </select>
        {(roleFilter || statusFilter || q) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setRoleFilter(""); setStatusFilter(""); setQ(""); }}>{t('common.clear')}</button>
        )}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-sunken)", borderBottom: "1px solid var(--border)" }}>
              <JdTh>{t('jobs.col.position')}</JdTh>
              <JdTh>{t('jobs.col.role')}</JdTh>
              <JdTh>{t('jobs.col.location')}</JdTh>
              <JdTh>{t('jobs.col.status')}</JdTh>
              <JdTh align="right">{t('jobs.col.openings')}</JdTh>
              <JdTh>{t('jobs.col.owner')}</JdTh>
              <JdTh align="right">{t('jobs.col.actions')}</JdTh>
            </tr>
          </thead>
          <tbody>
            {rows.map(j => {
              const owners = j.owner ? j.owner.split(",").map(s => s.trim()).filter(Boolean) : [];
              return (
                <tr key={j.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <JdTd>
                    <div className="col">
                      <span className="weight-500">{j.title}</span>
                      <span className="text-12 text-muted">{j.id}</span>
                    </div>
                  </JdTd>
                  <JdTd><span className="text-13 text-secondary">{roles[j.role_id]?.name || "—"}</span></JdTd>
                  <JdTd><span className="text-13 text-secondary">{j.location || "—"}{j.remote_ok ? " · Remote OK" : ""}</span></JdTd>
                  <JdTd>
                    <Badge kind={j.status === "Active" ? "positive" : j.status === "Draft" ? undefined : "warn"}>{j.status}</Badge>
                  </JdTd>
                  <JdTd align="right"><span className="text-mono text-13">{j.openings || 1}</span></JdTd>
                  <JdTd>
                    {owners.length > 0
                      ? <div className="row gap-4">
                          {owners.slice(0, 2).map(n => <Avatar key={n} name={n} />)}
                          {owners.length > 2 && <span className="text-12 text-muted">+{owners.length - 2}</span>}
                          <span className="text-13" style={{ marginLeft: 4 }}>{owners[0]}{owners.length > 1 ? ` +${owners.length - 1}` : ""}</span>
                        </div>
                      : <span className="text-muted">—</span>}
                  </JdTd>
                  <JdTd align="right">
                    <button className="icon-btn" onClick={(e) => openMenu(e, j.id)}
                      style={{ color: menuOpen === j.id ? "var(--ink)" : "var(--ink-muted)" }}>
                      <Icons.MoreH size={16} />
                    </button>
                  </JdTd>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>{t('jobs.noMatch')}</div>
        )}
      </div>

      {menuOpen && (() => {
        const j = jds.find(x => x.id === menuOpen);
        if (!j) return null;
        const s = j.status;
        return (
          <div ref={menuRef} onMouseDown={e => e.stopPropagation()} style={{
            position: "fixed", top: menuPos.top, right: menuPos.right,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 8, boxShadow: "var(--shadow-md)", padding: 4, zIndex: 200,
            minWidth: 160,
          }}>
            <button className="btn btn-ghost btn-sm row gap-6" style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => { setMenuOpen(null); setEditJd(j); }}>
              <Icons.Edit size={13} /> {t('common.edit')}
            </button>
            <div style={{ height: 1, background: "var(--border-soft)", margin: "4px 0" }} />
            {(s === "Draft" || s === "Closed" || s === "On hold") && (
              <button className="btn btn-ghost btn-sm row gap-6" style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => changeStatus(j.id, "Active")}>
                <Icons.Check size={13} /> {s === "Draft" ? t('jobs.action.open') : t('jobs.action.reopen')}
              </button>
            )}
            {s === "Active" && (
              <button className="btn btn-ghost btn-sm row gap-6" style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => changeStatus(j.id, "On hold")}>
                <Icons.Pause size={13} /> {t('jobs.action.suspend')}
              </button>
            )}
            {s !== "Closed" && (
              <button className="btn btn-ghost btn-sm row gap-6" style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => changeStatus(j.id, "Closed")}>
                <Icons.X size={13} /> {t('jobs.action.close')}
              </button>
            )}
            <div style={{ height: 1, background: "var(--border-soft)", margin: "4px 0" }} />
            <button className="btn btn-ghost btn-sm row gap-6" style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
              onClick={() => deleteJd(j.id)}>
              <Icons.X size={13} /> {t('common.delete')}
            </button>
          </div>
        );
      })()}

      {createOpen && (
        <JdModal onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); reload(); }} />
      )}
      {editJd && (
        <JdModal jd={editJd} onClose={() => setEditJd(null)} onSaved={() => { setEditJd(null); reload(); }} />
      )}
    </div>
  );
};

const JdTh = ({ children, align = "left" }) => (
  <th style={{ textAlign: align, padding: "10px 14px", fontSize: 11.5, fontWeight: 500, color: "var(--ink-secondary)", letterSpacing: "0.02em", textTransform: "uppercase" }}>{children}</th>
);
const JdTd = ({ children, align = "left" }) => (
  <td style={{ textAlign: align, padding: "12px 14px", verticalAlign: "middle" }}>{children}</td>
);

// ── JD Create/Edit Modal ──────────────────────────────────────────────────────

const JdModal = ({ jd, onClose, onSaved }) => {
  const t = window.useT();
  const isEdit = !!jd;
  const [roleId, setRoleId] = useState(jd?.role_id || "");
  const [title, setTitle] = useState(jd?.title || "");
  const [description, setDescription] = useState(jd?.description || "");
  const [location, setLocation] = useState(jd?.location || "");
  const [remoteOk, setRemoteOk] = useState(jd?.remote_ok || false);
  const [status, setStatus] = useState(jd?.status || "Draft");
  const [openings, setOpenings] = useState(jd?.openings || 1);
  // owners: string[] — serialized as comma-separated string to backend
  const [owners, setOwners] = useState(() =>
    jd?.owner ? jd.owner.split(",").map(s => s.trim()).filter(Boolean) : []
  );
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState("");

  const locations = useMemo(() => getLocations(), []);
  const allRoles = window.useApiData ? window.useApiData("/roles", window.CANDID_DATA.ROLES || []) : [];

  useEffect(() => {
    if (!roleId || title) return;
    const role = allRoles.find(r => r.id === roleId);
    if (role) setTitle(role.name);
  }, [roleId]);

  const save = async () => {
    if (!roleId || !title) return;
    setSaving(true);
    const body = {
      role_id: roleId, title,
      description: description || null,
      requirements: null,
      location: location || null,
      remote_ok: remoteOk,
      status, openings: parseInt(openings) || 1,
      owner: owners.length > 0 ? owners.join(", ") : null,
    };
    try {
      const url = isEdit ? `${window.API_BASE}/job-descriptions/${jd.id}` : `${window.API_BASE}/job-descriptions`;
      const method = isEdit ? "PATCH" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {}
    onSaved();
  };

  const improveWithAI = async () => {
    if (!description.trim()) return;
    setImproving(true);
    setImproveError("");
    try {
      const roleName = window.CANDID_DATA.ROLES?.find(r => r.id === roleId)?.name || title;
      const res = await fetch(`${window.API_BASE}/job-descriptions/improve-jd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: description, role_name: roleName }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setDescription(d.improved_text);
    } catch {
      setImproveError("AI unavailable — check provider settings.");
    }
    setImproving(false);
  };

  return (
    <Modal open title={isEdit ? t('jobs.modal.edit') : t('jobs.modal.new')} onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" onClick={save} disabled={!roleId || !title || saving}>{saving ? t('common.saving') : t('common.save')}</Btn>
        </>
      }>
      <div className="col gap-12">
        <div><label className="label">{t('jobs.modal.role')}</label><RoleSelect value={roleId} onChange={setRoleId} placeholder="Select role…" /></div>
        <div><label className="label">{t('jobs.modal.title')}</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" /></div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="label">{t('jobs.modal.location')}</label>
            <select className="select" value={location} onChange={e => setLocation(e.target.value)}>
              <option value="">— Select —</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div><label className="label">{t('jobs.modal.status')}</label>
            <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="Draft">{t('status.draft')}</option>
              <option value="Active">{t('status.active')}</option>
              <option value="On hold">{t('status.onHold')}</option>
              <option value="Closed">{t('status.closed')}</option>
            </select>
          </div>
          <div><label className="label">{t('jobs.modal.openings')}</label><input className="input" type="number" min={1} value={openings} onChange={e => setOpenings(e.target.value)} style={{ width: 80 }} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22 }}>
            <input type="checkbox" id="remote_ok" checked={remoteOk} onChange={e => setRemoteOk(e.target.checked)} />
            <label htmlFor="remote_ok" className="text-13">{t('jobs.modal.remoteOk')}</label>
          </div>
        </div>

        <div>
          <label className="label">{t('jobs.modal.owner')}</label>
          <OwnerSelect value={owners} onChange={setOwners} />
        </div>

        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ margin: 0 }}>{t('jobs.modal.description')}</label>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              {improveError && <span className="text-12" style={{ color: "var(--danger)" }}>{improveError}</span>}
              <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 12 }}
                onClick={improveWithAI} disabled={improving || !description.trim()}>
                {improving
                  ? <span className="badge ai" style={{ padding: "1px 6px", fontSize: 10 }}><span className="dot" /> generating…</span>
                  : t('jobs.improve')}
              </button>
            </div>
          </div>
          <textarea className="textarea" rows={8} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this role about? Include responsibilities, requirements, and what success looks like." />
        </div>
      </div>
    </Modal>
  );
};

window.JobsScreen = JobsScreen;
