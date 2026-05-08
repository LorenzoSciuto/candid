// Candidates list screen — table with filters, API-backed
const { STATUS: ALL_S } = window.CANDID_DATA;

const SOURCES = ["Referral", "LinkedIn", "Inbound", "Job board"];

const mapCandidate = (c) => ({
  id: c.id, first: c.first_name, last: c.last_name, email: c.email, phone: c.phone,
  role: c.current_role || c.job_title, experience: c.years_of_experience,
  location: c.location, status: c.status, source: c.source,
  appliedAt: c.applied_at, score: c.score,
});

const NewCandidateModal = ({ onClose, onCreated }) => {
  const t = window.useT();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!first.trim() || !last.trim()) { setError("First and last name are required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${window.API_BASE}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first.trim(), last_name: last.trim(),
          email: email || null, phone: phone || null,
          current_role: role || null, location: location || null,
          years_of_experience: experience !== "" ? parseInt(experience) : null,
          source: source || null, status,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
      } else {
        setError("Failed to create candidate.");
      }
    } catch {
      // Offline: create a local-only record
      onCreated({ id: `local-${Date.now()}`, first_name: first, last_name: last, email, phone, current_role: role, location, years_of_experience: experience ? parseInt(experience) : null, source, status, applied_at: new Date().toISOString().slice(0, 10), score: null });
    }
    setSaving(false);
  };

  return (
    <Modal open title={t('candidates.new')} onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" onClick={save} disabled={saving || !first.trim() || !last.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </Btn>
        </>
      }>
      <div className="col gap-12">
        {error && <div className="text-12" style={{ color: "var(--danger)" }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="label">{t('employees.form.first')} *</label>
            <input className="input" value={first} onChange={e => setFirst(e.target.value)} autoFocus placeholder="Jane" />
          </div>
          <div>
            <label className="label">{t('employees.form.last')} *</label>
            <input className="input" value={last} onChange={e => setLast(e.target.value)} placeholder="Smith" />
          </div>
          <div>
            <label className="label">{t('employees.form.email')}</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div>
            <label className="label">{t('candidates.form.phone')}</label>
            <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
          </div>
          <div>
            <label className="label">{t('candidates.form.role')}</label>
            <input className="input" value={role} onChange={e => setRole(e.target.value)} placeholder="Senior Engineer" />
          </div>
          <div>
            <label className="label">{t('employees.form.location')}</label>
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="San Francisco, CA" />
          </div>
          <div>
            <label className="label">{t('candidates.form.experience')}</label>
            <input className="input" type="number" min={0} value={experience} onChange={e => setExperience(e.target.value)} placeholder="5" />
          </div>
          <div>
            <label className="label">{t('candidates.form.source')}</label>
            <select className="select" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">—</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t('candidates.form.stage')}</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            {(window.CANDID_DATA.STATUS || []).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
};

const CandidatesScreen = ({ onOpenCandidate }) => {
  const t = window.useT();
  const [candidates, setCandidates] = useState(window.CANDID_DATA.CANDIDATES);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [exp, setExp] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [view, setView] = useState("table");
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const handleCreated = (raw) => {
    const mapped = mapCandidate(raw);
    setCandidates(prev => [mapped, ...prev]);
    setCreateOpen(false);
    if (raw.id && !raw.id.startsWith("local-")) onOpenCandidate(raw.id);
  };

  const openMenu = (e, id) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(menuOpen === id ? null : id);
  };

  useEffect(() => {
    fetch(`${window.API_BASE}/candidates`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d) && d.length > 0) setCandidates(d.map(mapCandidate)); })
      .catch(() => {});
  }, []);

  const archiveCandidate = (id) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: "archived" } : c));
    fetch(`${window.API_BASE}/candidates/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    }).catch(() => {});
    setMenuOpen(null);
  };

  const deleteCandidate = (id) => {
    if (!confirm("Delete this candidate? This cannot be undone.")) return;
    setCandidates(prev => prev.filter(c => c.id !== id));
    fetch(`${window.API_BASE}/candidates/${id}`, { method: "DELETE" }).catch(() => {});
    setMenuOpen(null);
  };

  const rows = useMemo(() => {
    let r = candidates.filter(c => {
      if (c.status === "archived" || c.status === "hired") return false;
      if (q && !((c.first + " " + c.last + " " + (c.email || "")).toLowerCase().includes(q.toLowerCase()))) return false;
      if (status !== "all" && c.status !== status) return false;
      if (source !== "all" && !c.source?.startsWith(source)) return false;
      if (exp === "junior" && (c.experience || 0) >= 5) return false;
      if (exp === "mid" && ((c.experience || 0) < 5 || (c.experience || 0) >= 8)) return false;
      if (exp === "senior" && (c.experience || 0) < 8) return false;
      return true;
    });
    return r.slice().sort((a, b) => {
      if (sortBy === "recent") return (b.appliedAt || "").localeCompare(a.appliedAt || "");
      if (sortBy === "score") return (b.score || 0) - (a.score || 0);
      if (sortBy === "name") return (a.first + a.last).localeCompare(b.first + b.last);
      if (sortBy === "exp") return (b.experience || 0) - (a.experience || 0);
      return 0;
    });
  }, [candidates, q, status, source, exp, sortBy]);

  const activeFilters = (status !== "all") + (source !== "all") + (exp !== "all") + (q ? 1 : 0);

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('candidates.title')}</h1>
          <div className="page-sub">{rows.length} of {candidates.length} {t('candidates.title').toLowerCase()}</div>
        </div>
        <div className="row gap-8">
          <SegControl value={view} onChange={setView} options={[{ value: "table", label: "Table" }, { value: "grid", label: "Grid" }]} />
          <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('candidates.new')}</Btn>
        </div>
      </div>

      <div className="card" style={{ padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="row gap-6" style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", flex: "1 1 280px", minWidth: 240 }}>
          <Icons.Search size={14} style={{ color: "var(--ink-muted)" }} />
          <input className="input" style={{ border: 0, padding: "4px 0", background: "transparent" }} placeholder={t('candidates.searchPh')} value={q} onChange={e => setQ(e.target.value)} />
          {q && <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setQ("")}><Icons.X size={12} /></button>}
        </div>
        <FilterPill label={t('candidates.stage')} value={status} onChange={setStatus} options={[{ id: "all", label: t('candidates.allStages') }, ...ALL_S]} />
        <FilterPill label={t('candidates.source')} value={source} onChange={setSource} options={[{ id: "all", label: t('candidates.anySource') }, ...SOURCES.map(s => ({ id: s, label: s }))]} />
        <FilterPill label={t('candidates.experience')} value={exp} onChange={setExp} options={[
          { id: "all", label: t('candidates.exp.any') },
          { id: "junior", label: t('candidates.exp.junior') },
          { id: "mid", label: t('candidates.exp.mid') },
          { id: "senior", label: t('candidates.exp.senior') },
        ]} />
        <div style={{ flex: 1 }} />
        <span className="text-12 text-muted">{t('candidates.sort')}</span>
        <FilterPill value={sortBy} onChange={setSortBy} options={[
          { id: "recent", label: t('candidates.sort.recent') },
          { id: "score", label: t('candidates.sort.score') },
          { id: "name", label: t('candidates.sort.name') },
          { id: "exp", label: t('candidates.sort.exp') },
        ]} />
        {activeFilters > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setStatus("all"); setSource("all"); setExp("all"); setQ(""); }}>
            {t('common.clear')} ({activeFilters})
          </button>
        )}
      </div>

      {view === "table"
        ? <CandidateTable rows={rows} onOpen={onOpenCandidate} t={t}
            menuOpen={menuOpen} openMenu={openMenu}
            onArchive={archiveCandidate} onDelete={deleteCandidate} />
        : <CandidateGrid rows={rows} onOpen={onOpenCandidate} />}

      {createOpen && <NewCandidateModal onClose={() => setCreateOpen(false)} onCreated={handleCreated} />}

      {/* Dropdown rendered at page root — escapes table overflow:hidden */}
      {menuOpen && (() => {
        const c = rows.find(r => r.id === menuOpen);
        if (!c) return null;
        return (
          <div onMouseDown={e => e.stopPropagation()} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", padding: 4, minWidth: 160, zIndex: 200 }}>
            <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => archiveCandidate(c.id)}>
              <Icons.EyeOff size={13} /> Archive
            </button>
            <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
              onClick={() => deleteCandidate(c.id)}>
              <Icons.X size={13} /> {t('common.delete')}
            </button>
          </div>
        );
      })()}
    </div>
  );
};

const FilterPill = ({ label, value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find(o => o.id === value) || options[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(o => !o)} style={value !== "all" && value !== "recent" ? { borderColor: "var(--ink-secondary)" } : undefined}>
        {label && <span className="text-muted">{label}:</span>} {cur.label}
        <Icons.ChevronDown size={12} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", padding: 4, minWidth: 180, zIndex: 10 }}>
          {options.map(o => (
            <button key={o.id} className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "space-between" }}
              onClick={() => { onChange(o.id); setOpen(false); }}>
              <span className="row gap-6">{o.dot && <span className="kdot" style={{ background: o.dot }} />}{o.label}</span>
              {o.id === value && <Icons.Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CandidateTable = ({ rows, onOpen, t, menuOpen, openMenu, onArchive, onDelete }) => (
  <div className="card" style={{ overflow: "hidden" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
      <thead>
        <tr style={{ background: "var(--bg-sunken)", borderBottom: "1px solid var(--border)" }}>
          <Th>{t('candidates.col.candidate')}</Th><Th>{t('candidates.col.stage')}</Th>
          <Th>{t('candidates.col.source')}</Th><Th align="right">{t('candidates.col.exp')}</Th>
          <Th align="right">{t('candidates.col.score')}</Th><Th>{t('candidates.col.applied')}</Th><Th width={40}></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(c => (
          <tr key={c.id} onClick={() => onOpen(c.id)} style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <Td><div className="row gap-8"><Avatar name={`${c.first} ${c.last}`} /><div className="col"><span className="weight-500">{c.first} {c.last}</span><span className="text-12 text-muted">{c.email || "—"}</span></div></div></Td>
            <Td><StatusBadge status={c.status} /></Td>
            <Td><span className="text-13 text-secondary">{c.source || "—"}</span></Td>
            <Td align="right"><span className="text-mono text-12">{c.experience != null ? `${c.experience}y` : "—"}</span></Td>
            <Td align="right">{c.score != null ? <span className="text-mono text-13 weight-500">{c.score.toFixed(1)}</span> : <span className="badge ai"><span className="dot" /> pending</span>}</Td>
            <Td><span className="text-mono text-12 text-muted">{c.appliedAt || "—"}</span></Td>
            <Td>
              <button className="icon-btn" onClick={(e) => openMenu(e, c.id)}>
                <Icons.MoreH size={14} />
              </button>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length === 0 && <div style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>{t('candidates.noMatch')}</div>}
  </div>
);

const Th = ({ children, align = "left", width }) => (
  <th style={{ textAlign: align, padding: "10px 14px", fontSize: 11.5, fontWeight: 500, color: "var(--ink-secondary)", letterSpacing: "0.02em", textTransform: "uppercase", width }}>{children}</th>
);
const Td = ({ children, align = "left" }) => (
  <td style={{ textAlign: align, padding: "12px 14px", verticalAlign: "middle" }}>{children}</td>
);

const CandidateGrid = ({ rows, onOpen }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
    {rows.map(c => (
      <div key={c.id} className="card" style={{ padding: 16, cursor: "pointer" }} onClick={() => onOpen(c.id)}>
        <div className="row gap-12" style={{ marginBottom: 12 }}>
          <Avatar name={`${c.first} ${c.last}`} size="lg" />
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <span className="weight-500">{c.first} {c.last}</span>
            <span className="text-12 text-muted">{c.role || "—"}</span>
          </div>
          {c.score != null && <span className="text-mono text-13 weight-600">{c.score.toFixed(1)}</span>}
        </div>
        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          <StatusBadge status={c.status} />
          {c.experience != null && <Badge>{c.experience}y exp</Badge>}
          {c.source && <Badge>{c.source}</Badge>}
        </div>
      </div>
    ))}
  </div>
);

window.CandidatesScreen = CandidatesScreen;
