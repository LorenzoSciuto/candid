// Jobs / Positions screen
const JobsScreen = ({ onRoute }) => {
  const t = window.useT();
  const [jds, setJds] = useState(window.CANDID_DATA.JDS_DATA);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editJd, setEditJd] = useState(null);

  const reload = () => {
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d)) setJds(d); })
      .catch(() => {});
  };
  useEffect(reload, []);

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

      {/* KPIs */}
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

      {/* Filters */}
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
            {rows.map(j => (
              <tr key={j.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <JdTd>
                  <div className="col">
                    <span className="weight-500">{j.title}</span>
                    <span className="text-12 text-muted">{j.id}</span>
                  </div>
                </JdTd>
                <JdTd>
                  <span className="text-13 text-secondary">{roles[j.role_id]?.name || "—"}</span>
                </JdTd>
                <JdTd><span className="text-13 text-secondary">{j.location || "—"}{j.remote_ok ? " · Remote OK" : ""}</span></JdTd>
                <JdTd>
                  <Badge kind={j.status === "Active" ? "positive" : j.status === "Draft" ? undefined : "warn"}>{j.status}</Badge>
                </JdTd>
                <JdTd align="right"><span className="text-mono text-13">{j.openings || 1}</span></JdTd>
                <JdTd>
                  {j.owner
                    ? <div className="row gap-6"><Avatar name={j.owner} /><span className="text-13">{j.owner}</span></div>
                    : <span className="text-muted">—</span>}
                </JdTd>
                <JdTd align="right">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditJd(j)}>{t('common.edit')}</button>
                </JdTd>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>{t('jobs.noMatch')}</div>
        )}
      </div>

      {createOpen && (
        <JdModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); reload(); }}
        />
      )}
      {editJd && (
        <JdModal
          jd={editJd}
          onClose={() => setEditJd(null)}
          onSaved={() => { setEditJd(null); reload(); }}
        />
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

// ── JD Create/Edit Modal ────────────────────────────────────────────────────────

const JdModal = ({ jd, onClose, onSaved }) => {
  const t = window.useT();
  const isEdit = !!jd;
  const [roleId, setRoleId] = useState(jd?.role_id || "");
  const [title, setTitle] = useState(jd?.title || "");
  const [description, setDescription] = useState(jd?.description || "");
  const [requirements, setRequirements] = useState(jd?.requirements || "");
  const [location, setLocation] = useState(jd?.location || "");
  const [remoteOk, setRemoteOk] = useState(jd?.remote_ok || false);
  const [status, setStatus] = useState(jd?.status || "Draft");
  const [openings, setOpenings] = useState(jd?.openings || 1);
  const [owner, setOwner] = useState(jd?.owner || "");
  const [saving, setSaving] = useState(false);
  const [improveOpen, setImproveOpen] = useState(false);

  const combinedText = [description, requirements].filter(Boolean).join("\n\n");

  const save = async () => {
    if (!roleId || !title) return;
    setSaving(true);
    const body = { role_id: roleId, title, description: description || null, requirements: requirements || null, location: location || null, remote_ok: remoteOk, status, openings: parseInt(openings) || 1, owner: owner || null };
    try {
      const url = isEdit ? `${window.API_BASE}/job-descriptions/${jd.id}` : `${window.API_BASE}/job-descriptions`;
      const method = isEdit ? "PATCH" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch { /* backend offline */ }
    onSaved();
  };

  const handleImproveAccept = (improved) => {
    setDescription(improved);
    setImproveOpen(false);
  };

  return (
    <>
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
            <div><label className="label">{t('jobs.modal.location')}</label><input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="SF / Remote" /></div>
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
          <div><label className="label">{t('jobs.modal.owner')}</label><input className="input" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Hiring manager name" /></div>
          <div>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label className="label" style={{ margin: 0 }}>{t('jobs.modal.description')}</label>
              <button
                className="btn btn-ghost btn-sm row gap-4"
                style={{ fontSize: 12 }}
                onClick={() => setImproveOpen(true)}
                disabled={!combinedText.trim()}
                title={t('jobs.improve')}>
                {t('jobs.improve')}
              </button>
            </div>
            <textarea className="textarea" rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this role about?" />
          </div>
          <div>
            <label className="label">{t('jobs.modal.requirements')}</label>
            <textarea className="textarea" rows={4} value={requirements} onChange={e => setRequirements(e.target.value)} placeholder="Skills, experience, qualifications…" />
          </div>
        </div>
      </Modal>

      {improveOpen && (
        <ImproveJDModal
          text={combinedText}
          roleName={window.CANDID_DATA.ROLES?.find(r => r.id === roleId)?.name || title}
          onAccept={handleImproveAccept}
          onClose={() => setImproveOpen(false)}
        />
      )}
    </>
  );
};

// ── Improve JD Modal ────────────────────────────────────────────────────────────

const ImproveJDModal = ({ text, roleName, onAccept, onClose }) => {
  const t = window.useT();
  const [loading, setLoading] = useState(true);
  const [improved, setImproved] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${window.API_BASE}/job-descriptions/improve-jd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, role_name: roleName }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setImproved(d.improved_text); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div className="card col" style={{ width: "100%", maxWidth: 860, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{t('jobs.ai.title')}</span>
          <button className="icon-btn" onClick={onClose}><Icons.X size={16} /></button>
        </div>

        {loading && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>{t('jobs.ai.generating')}</div>
        )}

        {error && (
          <div style={{ padding: 24 }}>
            <div className="text-13" style={{ color: "var(--danger)", marginBottom: 12 }}>Could not reach AI: {error}</div>
            <Btn onClick={onClose}>{t('common.close')}</Btn>
          </div>
        )}

        {!loading && !error && improved && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden" }}>
              <div className="col" style={{ borderRight: "1px solid var(--border)", overflow: "auto" }}>
                <div style={{ padding: "10px 16px", background: "var(--bg-sunken)", borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 500, color: "var(--ink-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {t('jobs.ai.current')}
                </div>
                <pre style={{ padding: "16px", margin: 0, fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "var(--ink-secondary)" }}>{text}</pre>
              </div>
              <div className="col" style={{ overflow: "auto" }}>
                <div style={{ padding: "10px 16px", background: "color-mix(in srgb, var(--positive-soft) 60%, transparent)", borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 500, color: "var(--positive)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {t('jobs.ai.improved')}
                </div>
                <pre style={{ padding: "16px", margin: 0, fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{improved}</pre>
              </div>
            </div>

            <div className="row gap-8" style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", justifyContent: "flex-end" }}>
              <Btn onClick={onClose}>{t('jobs.ai.decline')}</Btn>
              <Btn kind="primary" onClick={() => onAccept(improved)}>{t('jobs.ai.accept')}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

window.JobsScreen = JobsScreen;
