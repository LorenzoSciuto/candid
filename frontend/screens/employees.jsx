// Employees / People screen

const CURRENCY_SYMBOLS = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF", JPY: "¥", CAD: "CA$", AUD: "A$", SEK: "kr", DKK: "kr", NOK: "kr" };

const getEmpLocations = () => {
  try {
    const s = localStorage.getItem("candid_locations");
    if (s) return JSON.parse(s);
  } catch {}
  return ["Remote", "SF / Remote", "SF", "NYC", "London", "Berlin", "Austin", "Toronto"];
};

const EmployeesScreen = () => {
  const t = window.useT();
  const [employees, setEmployees] = useState(window.CANDID_DATA.EMPLOYEES);
  const [showSalary, setShowSalary] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    fetch(`${window.API_BASE}/employees`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d)) setEmployees(d); })
      .catch(() => {});
  }, []);

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
  const fmtBig = (n) => `${sym}${(n / 1000000).toFixed(2)}M`;

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
            </tr>
          </thead>
          <tbody>
            {rows.map(e => (
              <tr key={e.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <EmpTd>
                  <div className="row gap-8">
                    <Avatar name={`${e.first_name} ${e.last_name}`} />
                    <div className="col">
                      <span className="weight-500">{e.first_name} {e.last_name}</span>
                      {e.email && <span className="text-12 text-muted">{e.email}</span>}
                    </div>
                  </div>
                </EmpTd>
                <EmpTd><span className="text-13 text-secondary">{e.role_name || "—"}</span></EmpTd>
                <EmpTd><Badge>{e.department || "—"}</Badge></EmpTd>
                <EmpTd><span className="text-13 text-secondary">{e.location || "—"}</span></EmpTd>
                <EmpTd><span className="text-mono text-12 text-muted">{e.hire_date || "—"}</span></EmpTd>
                <EmpTd align="right">
                  {e.salary ? (
                    <span className="text-mono text-13 weight-500">
                      {showSalary ? fmtSalary(e.salary) : "••••"}
                    </span>
                  ) : <span className="text-muted">—</span>}
                </EmpTd>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>{t('employees.noMatch')}</div>
        )}
      </div>

      {createOpen && <EmployeeModal t={t} onClose={() => setCreateOpen(false)} onSaved={() => setCreateOpen(false)} />}
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
    const roles = window.CANDID_DATA.ROLES;
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
          <input className="input" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="e.g. 75000" />
        </div>
      </div>
    </Modal>
  );
};

window.EmployeesScreen = EmployeesScreen;
