// Roles configuration screen
const RolesScreen = ({ onRoute }) => {
  const t = window.useT();
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [liveJds, setLiveJds] = useState([]);
  const [editRole, setEditRole] = useState(null);
  const [viewRole, setViewRole] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = () => {
    fetch(`${window.API_BASE}/roles`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRoles(d); })
      .catch(() => {});
  };

  useEffect(() => {
    reload();
    fetch(`${window.API_BASE}/employees`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setEmployees(d); })
      .catch(() => {});
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setLiveJds(d); })
      .catch(() => {});
  }, []);

  const empByRole = useMemo(() => {
    const m = {};
    employees.forEach(e => { if (e.role_id) m[e.role_id] = (m[e.role_id] || 0) + 1; });
    return m;
  }, [employees]);

  const jdByRole = useMemo(() => {
    const m = {};
    liveJds.forEach(j => { if (j.status === "Active") m[j.role_id] = (m[j.role_id] || 0) + 1; });
    return m;
  }, [liveJds]);

  const deleteRole = async (id) => {
    await fetch(`${window.API_BASE}/roles/${id}`, { method: "DELETE" }).catch(() => {});
    setRoles(prev => prev.filter(r => r.id !== id));
    setDeleteTarget(null);
  };

  const depts = useMemo(() => [...new Set(roles.map(r => r.department).filter(Boolean))].sort(), [roles]);

  return (
    <div className="page page-wide">
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 className="page-h1">{t('roles.title')}</h1>
          <div className="page-sub">{roles.length} {t('roles.countRoles')} · {depts.length} {t('roles.countDepts')}</div>
        </div>
        <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('roles.new')}</Btn>
      </div>

      {/* Dept groups */}
      {roles.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: 64 }}>
          <Icons.Briefcase size={28} style={{ color: "var(--ink-muted)", marginBottom: 12 }} />
          <div className="weight-600" style={{ marginBottom: 6 }}>{t('roles.empty')}</div>
          <div className="text-13 text-secondary" style={{ marginBottom: 20 }}>{t('roles.emptyDesc')}</div>
          <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('roles.addFirst')}</Btn>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-sunken)" }}>
                <th style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t('roles.modal.name')}</th>
                <th style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t('roles.modal.dept')}</th>
                <th style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em", width: 200 }}>{t('roles.headcount')}</th>
                <th style={{ padding: "9px 16px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t('roles.openSeats')}</th>
                <th style={{ padding: "9px 16px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t('roles.activeJDs')}</th>
                <th style={{ padding: "9px 16px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t('roles.inEmployees')}</th>
                <th style={{ padding: "9px 16px", width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {(depts.length > 0 ? [...depts, null] : [null]).map(dept => {
                const deptRoles = dept ? roles.filter(r => r.department === dept) : roles.filter(r => !r.department);
                if (deptRoles.length === 0) return null;
                return [
                  dept && (
                    <tr key={`dept-${dept}`} style={{ background: "var(--bg-subtle, var(--bg-sunken))" }}>
                      <td colSpan={7} style={{ padding: "6px 16px" }}>
                        <span className="text-11 weight-600" style={{ color: "var(--ink-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{dept}</span>
                        <span className="text-11 text-muted" style={{ marginLeft: 8 }}>{deptRoles.length}</span>
                      </td>
                    </tr>
                  ),
                  ...deptRoles.map((role, rowIndex) => {
                    const filled = empByRole[role.id] || 0;
                    const total  = role.headcount || 1;
                    const gap    = Math.max(0, total - filled);
                    const openJds = jdByRole[role.id] || 0;
                    const pct = Math.min(100, Math.round((filled / total) * 100));
                    const hiring = gap > 0;
                    const isLast = rowIndex === deptRoles.length - 1;
                    return (
                      <tr key={role.id} style={{ borderBottom: isLast ? "none" : "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover, var(--bg-sunken))"}
                        onMouseLeave={e => e.currentTarget.style.background = ""}
                        onClick={() => setViewRole({ role, filled, total, gap, openJds, pct, hiring })}>
                        {/* Name + status */}
                        <td style={{ padding: "12px 16px" }}>
                          <div className="row gap-8" style={{ alignItems: "center" }}>
                            <span className="weight-600" style={{ fontSize: 13.5 }}>{role.name}</span>
                            {hiring ? (
                              <span className="badge ai" style={{ fontSize: 10 }}><span className="dot" /> {t('roles.hiring')}</span>
                            ) : (
                              <span className="badge" style={{ fontSize: 10, background: "var(--positive-soft)", color: "var(--positive)" }}>{t('roles.full')}</span>
                            )}
                          </div>
                        </td>
                        {/* Dept */}
                        <td style={{ padding: "12px 16px" }}>
                          <span className="text-13 text-secondary">{role.department || "—"}</span>
                        </td>
                        {/* Headcount bar */}
                        <td style={{ padding: "12px 16px" }}>
                          <div className="row gap-10" style={{ alignItems: "center" }}>
                            <div style={{ flex: 1, height: 5, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden", minWidth: 60 }}>
                              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: hiring ? "var(--ai)" : "var(--positive)", transition: "width 0.4s ease" }} />
                            </div>
                            <span className="text-12 text-mono weight-500" style={{ flexShrink: 0 }}>{filled}/{total}</span>
                          </div>
                        </td>
                        {/* Open seats */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span className="text-13 weight-600" style={{ color: hiring ? "var(--warn)" : "var(--positive)" }}>{gap}</span>
                        </td>
                        {/* Active JDs */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                          <span className="text-13 weight-600"
                            style={{ cursor: openJds > 0 ? "pointer" : "default", color: openJds > 0 ? "var(--ai)" : undefined, textDecoration: openJds > 0 ? "underline dotted" : "none" }}
                            onClick={() => openJds > 0 && onRoute && onRoute("jobs", { roleFilter: role.id })}>
                            {openJds}
                          </span>
                        </td>
                        {/* Employees */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                          <span className="text-13 weight-600"
                            style={{ cursor: filled > 0 ? "pointer" : "default", color: filled > 0 ? "var(--ai)" : undefined, textDecoration: filled > 0 ? "underline dotted" : "none" }}
                            onClick={() => filled > 0 && onRoute && onRoute("employees", { roleFilter: role.id })}>
                            {filled}
                          </span>
                        </td>
                        {/* Actions */}
                        <td style={{ padding: "12px 16px" }} onClick={e => e.stopPropagation()}>
                          <div className="row gap-4" style={{ justifyContent: "flex-end" }}>
                            <button className="icon-btn" onClick={() => setEditRole(role)} title={t('common.edit')}><Icons.Edit size={14} /></button>
                            <button className="icon-btn" onClick={() => setDeleteTarget(role)} title={t('common.delete')} style={{ color: "var(--ink-muted)" }}><Icons.X size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}
          onClick={() => setDeleteTarget(null)}>
          <div className="card col" style={{ width: 380, padding: 24, gap: 18 }} onClick={e => e.stopPropagation()}>
            <div className="col gap-4">
              <span style={{ fontWeight: 600, fontSize: 15 }}>{t('roles.deleteTitle')} "{deleteTarget.name}"?</span>
              <span className="text-13 text-secondary">{t('roles.deleteBody')}</span>
            </div>
            <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
              <Btn onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Btn>
              <Btn kind="danger" onClick={() => deleteRole(deleteTarget.id)}>{t('roles.deleteRole')}</Btn>
            </div>
          </div>
        </div>
      )}

      {viewRole && (
        <RoleViewModal
          {...viewRole}
          onClose={() => setViewRole(null)}
          onEdit={() => { setEditRole(viewRole.role); setViewRole(null); }}
          onNavigateJobs={() => { setViewRole(null); onRoute && onRoute("jobs", { roleFilter: viewRole.role.id }); }}
          onNavigateEmployees={() => { setViewRole(null); onRoute && onRoute("employees", { roleFilter: viewRole.role.id }); }}
        />
      )}

      {(editRole || createOpen) && (
        <RoleModal
          role={editRole}
          depts={depts}
          onClose={() => { setEditRole(null); setCreateOpen(false); }}
          onSaved={() => { setEditRole(null); setCreateOpen(false); reload(); }}
        />
      )}
    </div>
  );
};

const RoleViewModal = ({ role, filled, total, gap, openJds, pct, hiring, onClose, onEdit, onNavigateJobs, onNavigateEmployees }) => {
  const t = window.useT();
  return (
    <Modal open title={role.name} onClose={onClose}
      footer={<><Btn onClick={onClose}>{t('common.cancel')}</Btn><Btn kind="primary" onClick={onEdit}>{t('common.edit')}</Btn></>}>
      <div className="col gap-16">
        {/* Meta row */}
        <div className="row gap-12" style={{ alignItems: "center", flexWrap: "wrap" }}>
          {role.department && (
            <span className="badge" style={{ fontSize: 11 }}>{role.department}</span>
          )}
          {hiring ? (
            <span className="badge ai" style={{ fontSize: 11 }}><span className="dot" /> {t('roles.hiring')}</span>
          ) : (
            <span className="badge" style={{ fontSize: 11, background: "var(--positive-soft)", color: "var(--positive)" }}>{t('roles.full')}</span>
          )}
        </div>

        {/* Headcount bar */}
        <div className="col gap-6">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="text-12 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{t('roles.headcount')}</span>
            <span className="text-13 text-mono weight-600">{filled} / {total}</span>
          </div>
          <div style={{ height: 8, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: hiring ? "var(--ai)" : "var(--positive)", transition: "width 0.4s ease" }} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
            <div className="text-20 weight-700" style={{ color: hiring ? "var(--warn)" : "var(--positive)" }}>{gap}</div>
            <div className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{t('roles.openSeats')}</div>
          </div>
          <div className="card" style={{ padding: "12px 14px", textAlign: "center", cursor: openJds > 0 ? "pointer" : "default" }}
            onClick={() => openJds > 0 && onNavigateJobs()}>
            <div className="text-20 weight-700" style={{ color: openJds > 0 ? "var(--ai)" : undefined }}>{openJds}</div>
            <div className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{t('roles.activeJDs')}</div>
          </div>
          <div className="card" style={{ padding: "12px 14px", textAlign: "center", cursor: filled > 0 ? "pointer" : "default" }}
            onClick={() => filled > 0 && onNavigateEmployees()}>
            <div className="text-20 weight-700" style={{ color: filled > 0 ? "var(--ai)" : undefined }}>{filled}</div>
            <div className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{t('roles.inEmployees')}</div>
          </div>
        </div>

        {/* Description */}
        {role.description && (
          <div className="col gap-4">
            <span className="text-12 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{t('roles.modal.description')}</span>
            <p className="text-13" style={{ lineHeight: 1.6, margin: 0, color: "var(--ink-secondary)" }}>{role.description}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

const RoleModal = ({ role, depts, onClose, onSaved }) => {
  const t = window.useT();
  const [name, setName] = useState(role?.name || "");
  const [dept, setDept] = useState(role?.department || "");
  const [desc, setDesc] = useState(role?.description || "");
  const [headcount, setHeadcount] = useState(role?.headcount || 1);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState("");

  const save = async () => {
    setSaving(true);
    const body = { name, department: dept || null, description: desc || null, headcount: parseInt(headcount) || 1 };
    try {
      const url = role ? `${window.API_BASE}/roles/${role.id}` : `${window.API_BASE}/roles`;
      const method = role ? "PATCH" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch { /* offline */ }
    onSaved();
  };

  const improveWithAI = async () => {
    if (!desc.trim()) return;
    setImproving(true);
    setImproveError("");
    try {
      const res = await fetch(`${window.API_BASE}/roles/improve-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: desc, role_name: name || "role" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setDesc(d.improved_text);
    } catch {
      setImproveError(t('jobs.ai.unavailable'));
    }
    setImproving(false);
  };

  return (
    <Modal open title={role ? t('roles.modal.edit') : t('roles.modal.new')} onClose={onClose} disableBackdropClose
      footer={<><Btn onClick={onClose}>{t('common.cancel')}</Btn><Btn kind="primary" onClick={save} disabled={!name || saving}>{saving ? t('common.saving') : t('common.save')}</Btn></>}>
      <div className="col gap-12">
        <div><label className="label">{t('roles.modal.name')}</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior Frontend Engineer" autoFocus /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10 }}>
          <div>
            <label className="label">{t('roles.modal.dept')}</label>
            <input className="input" value={dept} onChange={e => setDept(e.target.value)} placeholder="Engineering" list="role-depts-list" autoComplete="off" />
            <datalist id="role-depts-list">{(depts || []).map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div><label className="label">{t('roles.modal.headcount')}</label><input className="input" type="number" min={1} value={headcount} onChange={e => setHeadcount(e.target.value)} /></div>
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ margin: 0 }}>{t('roles.modal.description')}</label>
            <div className="row gap-8" style={{ alignItems: "center" }}>
              {improveError && <span className="text-12" style={{ color: "var(--danger)" }}>{improveError}</span>}
              <button className="btn btn-ghost btn-sm row gap-4" style={{ fontSize: 12 }}
                onClick={improveWithAI} disabled={improving || !desc.trim()}>
                {improving
                  ? <span className="badge ai" style={{ padding: "1px 6px", fontSize: 10 }}><span className="dot" /> {t('roles.modal.generating')}</span>
                  : t('roles.modal.improve')}
              </button>
            </div>
          </div>
          <textarea className="textarea" rows={4} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('roles.modal.placeholder')} />
        </div>
      </div>
    </Modal>
  );
};

window.RolesScreen = RolesScreen;
