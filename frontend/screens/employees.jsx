// Employees screen

const CURRENCY_SYMBOLS = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF", JPY: "¥", CAD: "CA$", AUD: "A$", SEK: "kr", DKK: "kr", NOK: "kr" };

const getEmpLocations = () => {
  try {
    const s = localStorage.getItem("candid_locations");
    if (s) return JSON.parse(s);
  } catch {}
  return ["Milano", "Remote", "Milano / Remote", "Roma", "Torino", "Bergamo", "Brescia", "Monza"];
};

const downloadText = (text, filename) => {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const EmployeesScreen = () => {
  const t = window.useT();
  const [employees, setEmployees] = useState([]);
  const [showSalary, setShowSalary] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [profileEmp, setProfileEmp] = useState(null);
  const [editEmp, setEditEmp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = () => {
    fetch(`${window.API_BASE}/employees`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && Array.isArray(d)) {
          setEmployees(d);
          // Keep profile in sync if still open
          setProfileEmp(prev => prev ? (d.find(e => e.id === prev.id) || prev) : null);
          window.refreshCounts?.();
        }
      })
      .catch(() => {});
  };

  useEffect(reload, []);

  const deleteEmployee = async (id) => {
    setEmployees(prev => prev.filter(employee => employee.id !== id));
    await fetch(`${window.API_BASE}/employees/${id}`, { method: "DELETE" }).catch(() => {});
    window.refreshCounts?.();
    setDeleteTarget(null);
  };

  const depts = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);

  const rows = useMemo(() => employees.filter(e => {
    if (roleFilter && e.role_id !== roleFilter) return false;
    if (deptFilter && e.department !== deptFilter) return false;
    if (q) {
      const ql = q.toLowerCase();
      if (!(`${e.first_name} ${e.last_name} ${e.email || ""}`).toLowerCase().includes(ql)) return false;
    }
    return true;
  }), [employees, roleFilter, deptFilter, q]);

  const totalPayroll = rows.reduce((s, e) => s + (e.salary || 0), 0);
  const currencyCode = window.getCurrency ? window.getCurrency() : "EUR";
  const sym = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  const fmtSalary = (n) => n ? `${sym}${(n / 1000).toFixed(0)}k` : "—";
  const fmtBig = (n) => `${sym}${(n / 1000).toFixed(0)}k`;

  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const openMenu = (e, id) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(menuOpen === id ? null : id);
  };

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('employees.title')}</h1>
          <div className="page-sub">{rows.length} of {employees.length} employees</div>
        </div>
        <div className="row gap-8">
          <Btn icon={showSalary ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
            onClick={() => setShowSalary(s => !s)}>
            {showSalary ? t('employees.hideSalary') : t('employees.showSalary')}
          </Btn>
          <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('employees.add')}</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{t('employees.kpi.headcount')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{rows.length}</span>
        </div>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{t('employees.kpi.departments')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{depts.length}</span>
        </div>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{showSalary ? t('employees.kpi.payroll') : t('employees.kpi.payrollHidden')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {showSalary ? fmtBig(totalPayroll) : "••••••"}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="row gap-6" style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", flex: "1 1 220px" }}>
          <Icons.Search size={14} style={{ color: "var(--ink-muted)" }} />
          <input className="input" style={{ border: 0, padding: "4px 0", background: "transparent" }} placeholder={t('employees.searchPh')} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <RoleSelect value={roleFilter} onChange={setRoleFilter} placeholder={t('jobs.allRoles')} style={{ width: 220 }} />
        <select className="select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">{t('employees.allDepts')}</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(roleFilter || deptFilter || q) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setRoleFilter(""); setDeptFilter(""); setQ(""); }}>{t('common.clear')}</button>
        )}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-sunken)", borderBottom: "1px solid var(--border)" }}>
              <EmpTh>{t('employees.col.name')}</EmpTh>
              <EmpTh>{t('employees.col.role')}</EmpTh>
              <EmpTh>{t('employees.col.dept')}</EmpTh>
              <EmpTh>{t('employees.col.location')}</EmpTh>
              <EmpTh>{t('employees.col.hireDate')}</EmpTh>
              <EmpTh align="right">{t('employees.col.salary')}</EmpTh>
              <EmpTh width={80}></EmpTh>
            </tr>
          </thead>
          <tbody>
            {rows.map(employee => (
              <tr key={employee.id} style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
                onClick={() => setProfileEmp(employee)}
                onMouseEnter={ev => ev.currentTarget.style.background = "var(--surface-hover)"}
                onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                <EmpTd>
                  <div className="row gap-8">
                    <Avatar name={`${employee.first_name} ${employee.last_name}`} />
                    <div className="col">
                      <span className="weight-500">{employee.first_name} {employee.last_name}</span>
                      {employee.email && <span className="text-12 text-muted">{employee.email}</span>}
                    </div>
                  </div>
                </EmpTd>
                <EmpTd><span className="text-13 text-secondary">{employee.role_name || "—"}</span></EmpTd>
                <EmpTd><Badge>{employee.department || "—"}</Badge></EmpTd>
                <EmpTd><span className="text-13 text-secondary">{employee.location || "—"}</span></EmpTd>
                <EmpTd><span className="text-mono text-12 text-muted">{employee.hire_date || "—"}</span></EmpTd>
                <EmpTd align="right">
                  {employee.salary ? (
                    <span className="text-mono text-13 weight-500">
                      {showSalary ? fmtSalary(employee.salary) : "••••"}
                    </span>
                  ) : <span className="text-muted">—</span>}
                </EmpTd>
                <EmpTd>
                  <div onClick={ev => ev.stopPropagation()}>
                    <button className="icon-btn" onClick={e => openMenu(e, employee.id)}>
                      <Icons.MoreH size={14} />
                    </button>
                  </div>
                </EmpTd>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>{t('employees.noMatch')}</div>
        )}
      </div>

      {/* Row action menu */}
      {menuOpen && (() => {
        const emp = employees.find(e => e.id === menuOpen);
        if (!emp) return null;
        return (
          <div style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 500, minWidth: 160 }}
            onMouseDown={e => e.stopPropagation()}>
            <div className="card col" style={{ padding: "4px 0", gap: 0 }}>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => { setEditEmp(emp); setMenuOpen(null); }}>
                <Icons.Edit size={13} /> {t('common.edit')}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
                onClick={() => { setDeleteTarget(emp); setMenuOpen(null); }}>
                <Icons.X size={13} /> {t('common.delete')}
              </button>
            </div>
          </div>
        );
      })()}

      {createOpen && <EmployeeModal t={t} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); reload(); }} />}
      {editEmp && <EmployeeEditModal t={t} employee={editEmp} onClose={() => setEditEmp(null)} onSaved={() => { setEditEmp(null); reload(); }} />}
      {profileEmp && (
        <EmployeeProfile
          emp={profileEmp}
          showSalary={showSalary}
          fmtSalary={fmtSalary}
          currencyCode={currencyCode}
          sym={sym}
          onClose={() => setProfileEmp(null)}
        />
      )}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}
          onClick={() => setDeleteTarget(null)}>
          <div className="card col" style={{ width: 400, padding: 28, gap: 20 }} onClick={ev => ev.stopPropagation()}>
            <div className="col gap-6">
              <span style={{ fontWeight: 600, fontSize: 16 }}>{t('employees.deleteTitle')}</span>
              <span className="text-13 text-secondary">{deleteTarget.first_name} {deleteTarget.last_name} {t('employees.deleteBody')}</span>
            </div>
            <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
              <Btn onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Btn>
              <Btn kind="danger" onClick={() => deleteEmployee(deleteTarget.id)}>{t('common.delete')}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmpTh = ({ children, align = "left" }) => (
  <th style={{ textAlign: align, padding: "10px 14px", fontSize: 11.5, fontWeight: 500, color: "var(--ink-secondary)", letterSpacing: "0.02em", textTransform: "uppercase" }}>{children}</th>
);
const EmpTd = ({ children, align = "left" }) => (
  <td style={{ textAlign: align, padding: "12px 14px", verticalAlign: "middle" }}>{children}</td>
);

const EmployeeModal = ({ t, onClose, onSaved }) => {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [dept, setDept] = useState("");
  const [salary, setSalary] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const locations = useMemo(() => getEmpLocations(), []);
  const currencyCode = window.getCurrency ? window.getCurrency() : "EUR";

  const save = async () => {
    setSaving(true);
    const roles = window.CANDID_DATA.ROLES || [];
    const role = roles.find(r => r.id === roleId);
    const body = {
      first_name: first, last_name: last, email: email || null,
      role_id: roleId || null, role_name: role?.name || null,
      department: dept || (role?.department || null),
      salary: salary ? parseFloat(salary) : null,
      currency: currencyCode,
      location: location || null,
    };
    try {
      await fetch(`${window.API_BASE}/employees`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    } catch { /* backend offline */ }
    onSaved();
  };

  return (
    <Modal open title={t('employees.add')} onClose={onClose}
      footer={<><Btn onClick={onClose}>{t('common.cancel')}</Btn><Btn kind="primary" onClick={save} disabled={!first || !last || saving}>{saving ? t('common.saving') : t('common.add')}</Btn></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label className="label">{t('employees.form.first')}</label><input className="input" value={first} onChange={e => setFirst(e.target.value)} /></div>
        <div><label className="label">{t('employees.form.last')}</label><input className="input" value={last} onChange={e => setLast(e.target.value)} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="label">{t('employees.form.email')}</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="label">{t('employees.form.role')}</label><RoleSelect value={roleId} onChange={setRoleId} placeholder="Select role…" /></div>
        <div><label className="label">{t('employees.form.dept')}</label><input className="input" value={dept} onChange={e => setDept(e.target.value)} placeholder="Auto-filled from role" /></div>
        <div>
          <label className="label">{t('employees.form.location')}</label>
          <select className="select" value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">— Select —</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('employees.form.salary')} <span className="text-11 text-muted">({currencyCode})</span></label>
          <input className="input" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="es. 35000" />
        </div>
      </div>
    </Modal>
  );
};

const EmployeeEditModal = ({ t, employee, onClose, onSaved }) => {
  const [first, setFirst] = useState(employee.first_name || "");
  const [last, setLast] = useState(employee.last_name || "");
  const [email, setEmail] = useState(employee.email || "");
  const [roleId, setRoleId] = useState(employee.role_id || "");
  const [dept, setDept] = useState(employee.department || "");
  const [salary, setSalary] = useState(employee.salary ? String(employee.salary) : "");
  const [location, setLocation] = useState(employee.location || "");
  const [saving, setSaving] = useState(false);
  const locations = useMemo(() => getEmpLocations(), []);
  const currencyCode = window.getCurrency ? window.getCurrency() : "EUR";

  const save = async () => {
    setSaving(true);
    const roles = window.CANDID_DATA?.ROLES || [];
    const role = roles.find(r => r.id === roleId);
    const body = {
      first_name: first, last_name: last, email: email || null,
      role_id: roleId || null, role_name: role?.name || employee.role_name || null,
      department: dept || null, salary: salary ? parseFloat(salary) : null,
      currency: currencyCode, location: location || null,
    };
    try {
      await fetch(`${window.API_BASE}/employees/${employee.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    } catch {}
    onSaved();
  };

  return (
    <Modal open title={t('employees.edit')} onClose={onClose}
      footer={<><Btn onClick={onClose}>{t('common.cancel')}</Btn><Btn kind="primary" onClick={save} disabled={!first || !last || saving}>{saving ? t('common.saving') : t('common.save')}</Btn></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label className="label">{t('employees.form.first')}</label><input className="input" value={first} onChange={e => setFirst(e.target.value)} /></div>
        <div><label className="label">{t('employees.form.last')}</label><input className="input" value={last} onChange={e => setLast(e.target.value)} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="label">{t('employees.form.email')}</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="label">{t('employees.form.role')}</label><RoleSelect value={roleId} onChange={setRoleId} placeholder="Select role…" /></div>
        <div><label className="label">{t('employees.form.dept')}</label><input className="input" value={dept} onChange={e => setDept(e.target.value)} /></div>
        <div>
          <label className="label">{t('employees.form.location')}</label>
          <select className="select" value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">— Select —</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('employees.form.salary')} <span className="text-11 text-muted">({currencyCode})</span></label>
          <input className="input" type="number" value={salary} onChange={e => setSalary(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

const RATING_OPTIONS = [
  "Exceeds Expectations",
  "Meets Expectations",
  "Partially Meets Expectations",
  "Below Expectations",
];

const RATING_TRANSLATION_KEYS = {
  "Exceeds Expectations": "employees.reviews.rating.exceeds",
  "Meets Expectations": "employees.reviews.rating.meets",
  "Partially Meets Expectations": "employees.reviews.rating.partiallyMeets",
  "Below Expectations": "employees.reviews.rating.below",
};

const RATING_COLORS = {
  "Exceeds Expectations": "var(--success, #22c55e)",
  "Meets Expectations": "var(--ink-secondary)",
  "Partially Meets Expectations": "var(--warning, #f59e0b)",
  "Below Expectations": "var(--danger)",
};

const ReviewCard = ({ review, onEdit, onDelete }) => {
  const t = window.useT();
  const ratingColor = review.rating ? (RATING_COLORS[review.rating] || "var(--ink-secondary)") : "var(--ink-muted)";

  return (
    <div className="card" style={{ padding: "14px 16px", marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div className="col gap-2">
          <span style={{ fontWeight: 600, fontSize: 14 }}>{review.period}</span>
          {review.rating && (
            <span style={{ fontSize: 12, color: ratingColor, fontWeight: 500 }}>
              {t(RATING_TRANSLATION_KEYS[review.rating] || review.rating)}
            </span>
          )}
        </div>
        <div className="row gap-6">
          <button className="icon-btn" onClick={() => onEdit(review)} title={t('common.edit')}>
            <Icons.Edit size={13} />
          </button>
          <button className="icon-btn" onClick={() => onDelete(review)} title={t('common.delete')}
            style={{ color: "var(--danger)" }}>
            <Icons.X size={13} />
          </button>
        </div>
      </div>
      {review.manager_feedback && (
        <p style={{ margin: "0 0 6px", fontSize: 12.5, color: "var(--ink-secondary)", lineHeight: 1.6 }}>
          {review.manager_feedback}
        </p>
      )}
      <span className="text-11 text-muted">{t('employees.reviews.created')}: {review.created_at}</span>
    </div>
  );
};

const ReviewFormModal = ({ t, employeeId, review, onClose, onSaved }) => {
  const [period, setPeriod] = useState(review?.period || "");
  const [rating, setRating] = useState(review?.rating || "");
  const [selfEvaluation, setSelfEvaluation] = useState(review?.self_evaluation || "");
  const [managerFeedback, setManagerFeedback] = useState(review?.manager_feedback || "");
  const [nextReviewDate, setNextReviewDate] = useState(review?.next_review_date || "");
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);

  const save = async () => {
    setSaving(true);
    const body = {
      period: period || undefined,
      rating: rating || null,
      self_evaluation: selfEvaluation || null,
      manager_feedback: managerFeedback || null,
      next_review_date: nextReviewDate || null,
    };
    try {
      if (review) {
        await fetch(`${window.API_BASE}/employees/${employeeId}/reviews/${review.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      } else {
        await fetch(`${window.API_BASE}/employees/${employeeId}/reviews`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      }
    } catch {}
    setSaving(false);
    onSaved();
  };

  const improveFeedback = async () => {
    if (!review || !managerFeedback) return;
    setImproving(true);
    try {
      const res = await fetch(
        `${window.API_BASE}/employees/${employeeId}/reviews/${review.id}/improve-feedback`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json();
        setManagerFeedback(data.manager_feedback || managerFeedback);
      }
    } catch {}
    setImproving(false);
  };

  const title = review ? t('employees.reviews.edit') : t('employees.reviews.add');
  return (
    <Modal open title={title} onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" onClick={save} disabled={!period || saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Btn>
        </>
      }>
      <div className="col gap-12">
        <div className="row gap-12">
          <div style={{ flex: 1 }}>
            <label className="label">{t('employees.reviews.period')}</label>
            <input className="input" value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. Q1-2026" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">{t('employees.reviews.rating')}</label>
            <select className="select" value={rating} onChange={e => setRating(e.target.value)}>
              <option value="">— {t('employees.reviews.noRating')} —</option>
              {RATING_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{t(RATING_TRANSLATION_KEYS[opt])}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t('employees.reviews.selfEvaluation')}</label>
          <textarea className="input" rows={3} style={{ resize: "vertical" }}
            value={selfEvaluation} onChange={e => setSelfEvaluation(e.target.value)} />
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>{t('employees.reviews.managerFeedback')}</label>
            {review && (
              <Btn icon={<Icons.Sparkle size={12} />} onClick={improveFeedback}
                disabled={improving || !managerFeedback} style={{ fontSize: 11 }}>
                {improving ? t('common.improving') : t('employees.reviews.improveWithAi')}
              </Btn>
            )}
          </div>
          <textarea className="input" rows={4} style={{ resize: "vertical" }}
            value={managerFeedback} onChange={e => setManagerFeedback(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('employees.reviews.nextReviewDate')}</label>
          <input className="input" type="date" value={nextReviewDate} onChange={e => setNextReviewDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

const ReviewsPanel = ({ employeeId, onClose }) => {
  const t = window.useT();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editReview, setEditReview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadReviews = () => {
    setLoading(true);
    fetch(`${window.API_BASE}/employees/${employeeId}/reviews`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  };

  useEffect(loadReviews, [employeeId]);

  const handleDelete = async (review) => {
    setDeleteTarget(null);
    await fetch(`${window.API_BASE}/employees/${employeeId}/reviews/${review.id}`, { method: "DELETE" })
      .catch(() => {});
    loadReviews();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 650 }}
      onClick={onClose}>
      <div className="card col" style={{ width: 560, maxHeight: "85vh", overflow: "hidden", padding: 0 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{t('employees.reviews.title')}</span>
          <div className="row gap-8">
            <Btn kind="primary" icon={<Icons.Plus size={13} />} onClick={() => setAddOpen(true)}>
              {t('employees.reviews.add')}
            </Btn>
            <button className="icon-btn" onClick={onClose}><Icons.X size={14} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          {loading && <div style={{ textAlign: "center", color: "var(--ink-muted)", padding: 32 }}>{t('common.loading')}</div>}
          {!loading && reviews.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--ink-muted)", padding: 40 }}>{t('employees.reviews.empty')}</div>
          )}
          {!loading && reviews.map(review => (
            <ReviewCard key={review.id} review={review}
              onEdit={r => setEditReview(r)}
              onDelete={r => setDeleteTarget(r)} />
          ))}
        </div>
      </div>

      {addOpen && (
        <ReviewFormModal t={t} employeeId={employeeId} review={null}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); loadReviews(); }} />
      )}
      {editReview && (
        <ReviewFormModal t={t} employeeId={employeeId} review={editReview}
          onClose={() => setEditReview(null)}
          onSaved={() => { setEditReview(null); loadReviews(); }} />
      )}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 700 }}
          onClick={() => setDeleteTarget(null)}>
          <div className="card col" style={{ width: 380, padding: 24, gap: 18 }} onClick={e => e.stopPropagation()}>
            <span style={{ fontWeight: 600 }}>{t('employees.reviews.deleteTitle')}</span>
            <span className="text-13 text-secondary">{deleteTarget.period}</span>
            <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
              <Btn onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Btn>
              <Btn kind="danger" onClick={() => handleDelete(deleteTarget)}>{t('common.delete')}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmployeeProfile = ({ emp, showSalary, fmtSalary, currencyCode, sym, onClose }) => {
  const t = window.useT();
  const [cvText, setCvText] = useState(null);
  const [cvFilename, setCvFilename] = useState(null);
  const [hasCvFile, setHasCvFile] = useState(false);
  const [loadingCv, setLoadingCv] = useState(false);
  const [cvModal, setCvModal] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  useEffect(() => {
    if (!emp.candidate_id) return;
    setLoadingCv(true);
    fetch(`${window.API_BASE}/candidates/${emp.candidate_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setCvText(d.cv_text || null);
          setCvFilename(d.cv_filename || null);
          setHasCvFile(d.has_cv_file || false);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCv(false));
  }, [emp.candidate_id]);

  const download = async () => {
    if (hasCvFile) {
      const res = await fetch(`${window.API_BASE}/candidates/${emp.candidate_id}/cv`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url;
        a.download = cvFilename || `${emp.first_name}_${emp.last_name}_cv`;
        a.click(); URL.revokeObjectURL(url);
        return;
      }
    }
    if (cvText) {
      downloadText(cvText, cvFilename?.replace(/\.\w+$/, ".txt") || `${emp.first_name}_${emp.last_name}_cv.txt`);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}
      onClick={onClose}>
      <div className="card col" style={{ width: 520, maxHeight: "85vh", overflow: "auto", padding: 0 }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <div className="row gap-12" style={{ alignItems: "center", marginBottom: 12 }}>
            <Avatar name={`${emp.first_name} ${emp.last_name}`} size="lg" />
            <div className="col" style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{emp.first_name} {emp.last_name}</span>
              {emp.role_name && <span className="text-13 text-secondary">{emp.role_name}</span>}
              {emp.department && <span className="text-12 text-muted">{emp.department}</span>}
            </div>
            <button className="icon-btn" onClick={onClose}><Icons.X size={14} /></button>
          </div>
          <div className="row gap-8">
            {(cvText || loadingCv) && (
              <>
                <Btn icon={<Icons.Eye size={13} />} onClick={() => setCvModal(true)} disabled={!cvText}>
                  {t('employees.profile.viewCv')}
                </Btn>
                <Btn icon={<Icons.Download size={13} />} onClick={download} disabled={!cvText}>
                  {t('employees.profile.downloadCv')}
                </Btn>
              </>
            )}
            <Btn icon={<Icons.Star size={13} />} onClick={() => setReviewsOpen(true)}>
              {t('employees.reviews.title')}
            </Btn>
          </div>
        </div>

        {/* Details grid */}
        <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
          {[
            [t('employees.form.email'), emp.email || "—"],
            [t('employees.col.location'), emp.location || "—"],
            [t('employees.col.hireDate'), emp.hire_date || "—"],
            [t('employees.col.salary'), emp.salary ? (showSalary ? fmtSalary(emp.salary) + ` ${currencyCode}` : "••••") : "—"],
            [t('employees.col.manager'), emp.manager || "—"],
          ].map(([label, value]) => (
            <div key={label} className="col gap-2">
              <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
              <span className="text-13">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CV full-view modal */}
      {cvModal && cvText && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 700 }}
          onClick={() => setCvModal(false)}>
          <div className="card col" style={{ width: "min(860px, 90vw)", maxHeight: "85vh", overflow: "hidden", padding: 0 }}
            onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span className="card-title">{cvFilename || "CV"} — {emp.first_name} {emp.last_name}</span>
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setCvModal(false)}><Icons.X size={14} /></button>
            </div>
            <div style={{ padding: "20px 28px", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.75, whiteSpace: "pre-wrap", overflowY: "auto", color: "var(--ink-secondary)" }}>
              {cvText}
            </div>
          </div>
        </div>
      )}

      {reviewsOpen && (
        <ReviewsPanel employeeId={emp.id} onClose={() => setReviewsOpen(false)} />
      )}
    </div>
  );
};

window.EmployeesScreen = EmployeesScreen;
