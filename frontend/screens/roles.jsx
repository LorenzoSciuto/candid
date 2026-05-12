// Roles configuration screen
const RolesScreen = ({ onRoute }) => {
  const t = window.useT();
  const [roles, setRoles] = useState([]);
  const [editRole, setEditRole] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const reload = () => {
    fetch(`${window.API_BASE}/roles`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRoles(d); })
      .catch(() => {});
  };
  useEffect(reload, []);

  const empByRole = useMemo(() => {
    const m = {};
    (window.CANDID_DATA.EMPLOYEES || []).forEach(e => {
      m[e.role_id] = (m[e.role_id] || 0) + 1;
    });
    return m;
  }, []);

  const [liveJds, setLiveJds] = useState([]);
  useEffect(() => {
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setLiveJds(d); })
      .catch(() => {});
  }, []);

  const jdByRole = useMemo(() => {
    const m = {};
    liveJds.forEach(j => {
      if (j.status === "Active") m[j.role_id] = (m[j.role_id] || 0) + 1;
    });
    return m;
  }, [liveJds]);

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('roles.title')}</h1>
          <div className="page-sub">{roles.length} roles · {t('roles.subtitle')}</div>
        </div>
        <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('roles.new')}</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {roles.map(role => {
          const filled = empByRole[role.id] || 0;
          const openJds = jdByRole[role.id] || 0;
          const gap = Math.max(0, (role.headcount || 1) - filled);
          return (
            <div key={role.id} className="card" style={{ padding: 18 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <div className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span className="weight-600" style={{ fontSize: 14 }}>{role.name}</span>
                  <span className="text-12 text-muted">{role.department}</span>
                </div>
                <button className="icon-btn" onClick={() => setEditRole(role)}><Icons.Edit size={14} /></button>
              </div>

              {role.description && (
                <div className="text-13 text-secondary" style={{ lineHeight: 1.55, marginBottom: 12 }}>
                  {role.description}
                </div>
              )}

              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                <div className="col" style={{ background: "var(--bg-sunken)", borderRadius: 6, padding: "8px 12px", flex: 1, minWidth: 80 }}>
                  <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('roles.headcount')}</span>
                  <div className="row gap-4" style={{ alignItems: "baseline", marginTop: 2 }}>
                    <span className="weight-600 text-mono" style={{ fontSize: 18 }}>{filled}</span>
                    <span className="text-12 text-muted">/ {role.headcount || 1}</span>
                  </div>
                </div>
                <div className="col" style={{ background: gap > 0 ? "var(--warn-soft)" : "var(--positive-soft)", borderRadius: 6, padding: "8px 12px", flex: 1, minWidth: 80 }}>
                  <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('roles.openSeats')}</span>
                  <span className="weight-600 text-mono" style={{ fontSize: 18, color: gap > 0 ? "var(--warn)" : "var(--positive)", marginTop: 2, display: "block" }}>{gap}</span>
                </div>
                <div className="col" style={{ background: "var(--bg-sunken)", borderRadius: 6, padding: "8px 12px", flex: 1, minWidth: 80 }}>
                  <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{t('roles.activeJDs')}</span>
                  <span className="weight-600 text-mono" style={{ fontSize: 18, marginTop: 2, display: "block" }}>{openJds}</span>
                </div>
              </div>

              <div className="row gap-8" style={{ marginTop: 12 }}>
                <Btn style={{ flex: 1 }} onClick={() => onRoute && onRoute("jobs")}>{t('roles.viewJDs')}</Btn>
                <Btn style={{ flex: 1 }} onClick={() => onRoute && onRoute("employees")}>{t('roles.viewPeople')}</Btn>
              </div>
            </div>
          );
        })}
      </div>

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

  const save = async () => {
    setSaving(true);
    const body = { name, department: dept, description: desc, headcount: parseInt(headcount) || 1 };
    try {
      const url = role ? `${window.API_BASE}/roles/${role.id}` : `${window.API_BASE}/roles`;
      const method = role ? "PATCH" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch { /* backend not running */ }
    onSaved();
  };

  return (
    <Modal open title={role ? t('roles.modal.edit') : t('roles.modal.new')} onClose={onClose}
      footer={<><Btn onClick={onClose}>{t('common.cancel')}</Btn><Btn kind="primary" onClick={save} disabled={!name || saving}>{saving ? t('common.saving') : t('common.save')}</Btn></>}>
      <div className="col gap-12">
        <div><label className="label">{t('roles.modal.name')}</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior Frontend Engineer" /></div>
        <div><label className="label">{t('roles.modal.dept')}</label><input className="input" value={dept} onChange={e => setDept(e.target.value)} placeholder="Engineering" /></div>
        <div><label className="label">{t('roles.modal.headcount')}</label><input className="input" type="number" min={1} value={headcount} onChange={e => setHeadcount(e.target.value)} style={{ width: 100 }} /></div>
        <div><label className="label">{t('roles.modal.description')}</label><textarea className="textarea" rows={4} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('roles.modal.placeholder')} /></div>
      </div>
    </Modal>
  );
};

window.RolesScreen = RolesScreen;
