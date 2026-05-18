// Roles configuration screen
const RolesScreen = ({ onRoute }) => {
  const t = window.useT();
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [liveJds, setLiveJds] = useState([]);
  const [editRole, setEditRole] = useState(null);
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
        <div className="col gap-24">
          {(depts.length > 0 ? depts : [null]).map(dept => {
            const deptRoles = dept ? roles.filter(r => r.department === dept) : roles.filter(r => !r.department);
            if (deptRoles.length === 0) return null;
            return (
              <div key={dept || "__none"}>
                {dept && (
                  <div className="row gap-8" style={{ alignItems: "center", marginBottom: 10 }}>
                    <span className="text-12 weight-500" style={{ color: "var(--ink-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{dept}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    <span className="text-12 text-muted">{deptRoles.length}</span>
                  </div>
                )}
                <div className="col gap-10">
                  {deptRoles.map(role => {
                    const filled = empByRole[role.id] || 0;
                    const total  = role.headcount || 1;
                    const gap    = Math.max(0, total - filled);
                    const openJds = jdByRole[role.id] || 0;
                    const pct = Math.min(100, Math.round((filled / total) * 100));
                    const hiring = gap > 0;

                    return (
                      <div key={role.id} className="card" style={{ padding: "18px 20px" }}>
                        <div className="row" style={{ gap: 20, alignItems: "flex-start" }}>
                          {/* Left — identity */}
                          <div className="col" style={{ flex: "0 0 260px", minWidth: 0 }}>
                            <div className="row gap-8" style={{ alignItems: "center", marginBottom: 4 }}>
                              <span className="weight-600" style={{ fontSize: 14.5 }}>{role.name}</span>
                              {hiring ? (
                                <span className="badge ai" style={{ fontSize: 10.5 }}><span className="dot" /> {t('roles.hiring')}</span>
                              ) : (
                                <span className="badge" style={{ fontSize: 10.5, background: "var(--positive-soft)", color: "var(--positive)" }}>{t('roles.full')}</span>
                              )}
                            </div>
                            {role.description && (
                              <div className="text-12 text-secondary" style={{ lineHeight: 1.5, marginTop: 2 }}>
                                {role.description.length > 110 ? role.description.slice(0, 110) + "…" : role.description}
                              </div>
                            )}
                          </div>

                          {/* Center — headcount bar */}
                          <div className="col" style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                            <div className="row" style={{ justifyContent: "space-between", marginBottom: 5 }}>
                              <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{t('roles.headcount')}</span>
                              <span className="text-12 text-mono weight-500">{filled} / {total}</span>
                            </div>
                            <div style={{ height: 6, background: "var(--bg-sunken)", borderRadius: 999, overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                width: `${pct}%`,
                                borderRadius: 999,
                                background: hiring ? "var(--ai)" : "var(--positive)",
                                transition: "width 0.4s ease",
                              }} />
                            </div>
                            <div className="row gap-16" style={{ marginTop: 10 }}>
                              <div className="col gap-1">
                                <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('roles.openSeats')}</span>
                                <span className="text-13 weight-600" style={{ color: hiring ? "var(--warn)" : "var(--positive)" }}>{gap}</span>
                              </div>
                              <div className="col gap-1">
                                <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('roles.activeJDs')}</span>
                                <span className="text-13 weight-600">{openJds}</span>
                              </div>
                              <div className="col gap-1">
                                <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('roles.inEmployees')}</span>
                                <span className="text-13 weight-600">{filled}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right — actions */}
                          <div className="row gap-6" style={{ flexShrink: 0, alignItems: "center" }}>
                            <Btn onClick={() => onRoute && onRoute("jobs")} style={{ fontSize: 12 }}>{t('roles.viewPositions')}</Btn>
                            <Btn onClick={() => onRoute && onRoute("employees")} style={{ fontSize: 12 }}>{t('roles.viewEmployees')}</Btn>
                            <button className="icon-btn" onClick={() => setEditRole(role)} title="Edit">
                              <Icons.Edit size={14} />
                            </button>
                            <button className="icon-btn" onClick={() => setDeleteTarget(role)} title="Delete"
                              style={{ color: "var(--ink-muted)" }}>
                              <Icons.X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Roles without department */}
          {(() => {
            const undept = roles.filter(r => !r.department);
            if (undept.length === 0 || depts.length === 0) return null;
            return (
              <div>
                <div className="row gap-8" style={{ alignItems: "center", marginBottom: 10 }}>
                  <span className="text-12 weight-500" style={{ color: "var(--ink-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t('roles.other')}</span>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>
              </div>
            );
          })()}
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

      {(editRole || createOpen) && (
        <RoleModal
          role={editRole}
          onClose={() => { setEditRole(null); setCreateOpen(false); }}
          onSaved={() => { setEditRole(null); setCreateOpen(false); reload(); }}
        />
      )}
    </div>
  );
};

const RoleModal = ({ role, onClose, onSaved }) => {
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
      setImproveError("AI unavailable — check provider settings.");
    }
    setImproving(false);
  };

  return (
    <Modal open title={role ? t('roles.modal.edit') : t('roles.modal.new')} onClose={onClose}
      footer={<><Btn onClick={onClose}>{t('common.cancel')}</Btn><Btn kind="primary" onClick={save} disabled={!name || saving}>{saving ? t('common.saving') : t('common.save')}</Btn></>}>
      <div className="col gap-12">
        <div><label className="label">{t('roles.modal.name')}</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior Frontend Engineer" autoFocus /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10 }}>
          <div><label className="label">{t('roles.modal.dept')}</label><input className="input" value={dept} onChange={e => setDept(e.target.value)} placeholder="Engineering" /></div>
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
