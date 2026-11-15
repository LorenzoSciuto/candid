// Candidates list screen — table with filters, API-backed

const mapCandidate = (c) => ({
  id: c.id, first: c.first_name, last: c.last_name, email: c.email, phone: c.phone,
  role: c.current_role || c.job_title, experience: c.years_of_experience,
  location: c.location, status: c.status, source: c.source,
  appliedAt: c.applied_at, score: c.score,
  jdTitle: c.jd_title ?? null, jdId: c.job_description_id ?? null,
});

// ── Styled delete / destructive confirm ────────────────────────────────────────

// ── New candidate modal ────────────────────────────────────────────────────────

const NewCandidateModal = ({ onClose, onCreated }) => {
  const t = window.useT();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [source, setSource] = useState("CV Upload");
  const [status, setStatus] = useState("new");
  const [jdId, setJdId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allJds = (window.CANDID_DATA.JDS || []);

  const save = async () => {
    if (!first.trim() || !last.trim()) { setError(t('candidates.error.nameRequired')); return; }
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
          job_description_id: jdId || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
      } else {
        setError(t('candidates.error.createFailed'));
      }
    } catch {
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
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="London, UK" />
          </div>
          <div>
            <label className="label">{t('candidates.form.experience')}</label>
            <input className="input" type="number" min={0} value={experience} onChange={e => setExperience(e.target.value)} placeholder="5" />
          </div>
          <div>
            <label className="label">{t('candidates.form.source')}</label>
            <select className="select" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">—</option>
              {(window.CANDID_DATA.SOURCES || []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t('candidates.form.position')}</label>
          <select className="select" value={jdId} onChange={e => setJdId(e.target.value)}>
            <option value="">—</option>
            {allJds.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
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

// ── Hire modal ────────────────────────────────────────────────────────────────

const HireModal = ({ candidate, onClose, onHired }) => {
  const t = window.useT();
  const [jds, setJds] = useState([]);
  const [selectedJd, setSelectedJd] = useState("");
  const [salary, setSalary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currencyCode = window.getCurrency ? window.getCurrency() : "EUR";

  useEffect(() => {
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!Array.isArray(d)) return;
        const active = d.filter(j => j.status === "Active");
        setJds(active);
        if (active.length > 0) setSelectedJd(active[0].id);
      })
      .catch(() => {});
  }, []);

  const confirm = async () => {
    setSaving(true);
    setError("");
    const jd = jds.find(j => j.id === selectedJd);
    try {
      const empRes = await fetch(`${window.API_BASE}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: candidate.first,
          last_name: candidate.last,
          email: candidate.email || null,
          role_id: jd?.role_id || null,
          role_name: jd?.title || candidate.role || null,
          department: null,
          location: candidate.location || null,
          hire_date: new Date().toISOString().slice(0, 10),
          salary: salary ? parseFloat(salary) : null,
          currency: currencyCode,
          candidate_id: candidate.id,
        }),
      });
      if (!empRes.ok) throw new Error(t('candidates.hire.failed'));

      await fetch(`${window.API_BASE}/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "hired" }),
      });

      if (jd) {
        await fetch(`${window.API_BASE}/job-descriptions/${jd.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Closed" }),
        });
      }

      window.refreshCounts?.();
      onHired(candidate.id);
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}
      onClick={onClose}>
      <div className="card col" style={{ width: 440, padding: 28, gap: 20 }} onClick={e => e.stopPropagation()}>
        <div className="col gap-4">
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>{t('candidates.hire.title').replace('{name}', `${candidate.first} ${candidate.last}`)}</span>
          <span className="text-13 text-secondary">{t('candidates.hire.subtitle')}</span>
        </div>

        <div className="col gap-12">
          <div className="card card-pad row gap-12" style={{ alignItems: "center" }}>
            <Avatar name={`${candidate.first} ${candidate.last}`} size="lg" />
            <div className="col">
              <span className="weight-500">{candidate.first} {candidate.last}</span>
              <span className="text-12 text-muted">{candidate.role || candidate.email || "—"}</span>
              {candidate.location && <span className="text-12 text-muted">{candidate.location}</span>}
            </div>
          </div>

          <div>
            <label className="label">{t('candidates.hire.position')}</label>
            {jds.length > 0 ? (
              <select className="select" value={selectedJd} onChange={e => setSelectedJd(e.target.value)}>
                {jds.map(j => <option key={j.id} value={j.id}>{j.title}{j.location ? ` · ${j.location}` : ""}</option>)}
              </select>
            ) : (
              <div className="text-13 text-muted" style={{ padding: "8px 0" }}>{t('candidates.hire.noPositions')}</div>
            )}
          </div>
          <div>
            <label className="label">{t('employees.form.salary')} <span className="text-11 text-muted">{t('candidates.hire.salaryHint').replace('{currency}', currencyCode)}</span></label>
            <input className="input" type="number" min={0} value={salary} onChange={e => setSalary(e.target.value)} placeholder={t('candidates.hire.salaryPh')} />
          </div>
        </div>

        {error && <div className="text-12" style={{ color: "var(--danger)" }}>{error}</div>}

        <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" icon={<Icons.UserCheck size={14} />} onClick={confirm} disabled={saving}>
            {saving ? t('candidates.hire.hiring') : t('candidate.hire.title')}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ── Quick Assign Job Modal ────────────────────────────────────────────────────

const QuickAssignJobModal = ({ candidateId, onClose, onAssigned }) => {
  const t = window.useT();
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setJobs(data); setLoadingJobs(false); })
      .catch(() => setLoadingJobs(false));
  }, []);

  const assign = async () => {
    if (!selectedJobId) return;
    setSaving(true);
    try {
      await fetch(`${window.API_BASE}/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description_id: selectedJobId }),
      });
      onAssigned(candidateId);
    } catch { /* offline */ }
    setSaving(false);
  };

  return (
    <Modal open title={t('assignJob.title')} onClose={onClose} width={480}
      footer={
        <>
          <Btn onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn kind="primary" onClick={assign} disabled={saving || !selectedJobId || loadingJobs}>
            {saving ? t('assignJob.saving') : t('assignJob.confirm')}
          </Btn>
        </>
      }>
      <div className="col gap-12">
        {loadingJobs ? (
          <span className="text-13 text-muted">{t('assignJob.loading')}</span>
        ) : jobs.length === 0 ? (
          <span className="text-13 text-muted">{t('assignJob.noJobs')}</span>
        ) : (
          <div>
            <label className="label">{t('candidates.col.position')}</label>
            <select className="select" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
              <option value="">{t('assignJob.selectPh')}</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}{j.department ? ` · ${j.department}` : ""}</option>
              ))}
            </select>
          </div>
        )}
        <p className="text-12 text-muted" style={{ margin: 0 }}>{t('assignJob.hint')}</p>
      </div>
    </Modal>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────

const CandidatesScreen = ({ onOpenCandidate }) => {
  const t = window.useT();
  const [stages, setStages] = useState(() => window.CANDID_DATA.STATUS || []);
  const [candidates, setCandidates] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [exp, setExp] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [view, setView] = useState("table");
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [jdFilter, setJdFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [assignJobTarget, setAssignJobTarget] = useState(null);
  const [hireTarget, setHireTarget] = useState(null);

  useEffect(() => {
    const onStages = (e) => setStages(e.detail);
    window.addEventListener("candid:stages", onStages);
    return () => window.removeEventListener("candid:stages", onStages);
  }, []);

  const handleCreated = (raw) => {
    const mapped = mapCandidate(raw);
    setCandidates(prev => [mapped, ...prev]);
    setCreateOpen(false);
    window.refreshCounts?.();
    if (raw.id && !raw.id.startsWith("local-")) onOpenCandidate(raw.id);
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
  };

  const restoreCandidate = (id) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: "new" } : c));
    fetch(`${window.API_BASE}/candidates/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "new" }),
    }).catch(() => {});
  };

  const promptDelete = (id) => {
    const c = candidates.find(x => x.id === id);
    setDeleteTarget({ id, name: c ? `${c.first} ${c.last}` : t('candidates.thisCandidate') });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setCandidates(prev => prev.filter(c => c.id !== deleteTarget.id));
    fetch(`${window.API_BASE}/candidates/${deleteTarget.id}`, { method: "DELETE" }).catch(() => {});
    window.refreshCounts?.();
    setDeleteTarget(null);
  };

  const promptReject = (id) => {
    const c = candidates.find(x => x.id === id);
    setRejectTarget({ id, name: c ? `${c.first} ${c.last}` : t('candidates.thisCandidate') });
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    setCandidates(prev => prev.map(c => c.id === rejectTarget.id ? { ...c, status: "Rejected" } : c));
    fetch(`${window.API_BASE}/candidates/${rejectTarget.id}/reject`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "", body: "", send_email: false }),
    }).catch(() => {});
    setRejectTarget(null);
  };

  const promptHire = (id) => {
    const c = candidates.find(x => x.id === id);
    if (c) setHireTarget(c);
  };

  const onHired = (id) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: "hired" } : c));
  };

  const TERMINAL_STATUSES_SET = new Set(["hired", "Rejected"]);

  const rows = useMemo(() => {
    let r = candidates.filter(c => {
      if (showArchived) {
        if (c.status !== "archived") return false;
      } else if (showTerminal) {
        if (!TERMINAL_STATUSES_SET.has(c.status)) return false;
      } else {
        if (c.status === "archived" || TERMINAL_STATUSES_SET.has(c.status)) return false;
        if (status !== "all" && c.status !== status) return false;
      }
      if (q && !((c.first + " " + c.last + " " + (c.email || "")).toLowerCase().includes(q.toLowerCase()))) return false;
      if (source !== "all" && !c.source?.startsWith(source)) return false;
      if (exp === "junior" && (c.experience || 0) >= 5) return false;
      if (exp === "mid" && ((c.experience || 0) < 5 || (c.experience || 0) >= 8)) return false;
      if (exp === "senior" && (c.experience || 0) < 8) return false;
      if (jdFilter !== "all" && c.jdId !== jdFilter) return false;
      return true;
    });
    return r.slice().sort((a, b) => {
      if (sortBy === "recent") return (b.appliedAt || "").localeCompare(a.appliedAt || "");
      if (sortBy === "score") return (b.score || 0) - (a.score || 0);
      if (sortBy === "name") return (a.first + a.last).localeCompare(b.first + b.last);
      if (sortBy === "exp") return (b.experience || 0) - (a.experience || 0);
      return 0;
    });
  }, [candidates, q, status, source, exp, sortBy, showArchived, showTerminal, jdFilter]);

  const archivedCount = useMemo(() => candidates.filter(c => c.status === "archived").length, [candidates]);
  const terminalCount = useMemo(() => candidates.filter(c => TERMINAL_STATUSES_SET.has(c.status)).length, [candidates]);
  const activeFilters = (!showArchived && !showTerminal && status !== "all" ? 1 : 0) + (source !== "all" ? 1 : 0) + (exp !== "all" ? 1 : 0) + (jdFilter !== "all" ? 1 : 0) + (q ? 1 : 0);

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('candidates.title')}</h1>
          <div className="page-sub">
            {showArchived ? t('candidates.sub.archived').replace('{n}', rows.length) : showTerminal ? t('candidates.sub.terminal').replace('{n}', rows.length) : t('candidates.sub.active').replace('{n}', rows.length).replace('{total}', candidates.filter(c => c.status !== "archived" && !TERMINAL_STATUSES_SET.has(c.status)).length)}
          </div>
        </div>
        <div className="row gap-8">
          <SegControl value={view} onChange={setView} options={[{ value: "table", label: t('candidates.view.table') }, { value: "grid", label: t('candidates.view.grid') }]} />
          <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('candidates.new')}</Btn>
        </div>
      </div>

      <div className="card" style={{ padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="row gap-6" style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", flex: "1 1 280px", minWidth: 240 }}>
          <Icons.Search size={14} style={{ color: "var(--ink-muted)" }} />
          <input className="input" style={{ border: 0, padding: "4px 0", background: "transparent" }} placeholder={t('candidates.searchPh')} value={q} onChange={e => setQ(e.target.value)} />
          {q && <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setQ("")}><Icons.X size={12} /></button>}
        </div>

        {/* Archive toggle */}
        <button
          onClick={() => { setShowArchived(a => !a); setShowTerminal(false); setStatus("all"); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 6, fontSize: 12.5, cursor: "pointer",
            border: `1px solid ${showArchived ? "var(--ink-secondary)" : "var(--border)"}`,
            background: showArchived ? "var(--bg-sunken)" : "transparent",
            color: showArchived ? "var(--ink)" : "var(--ink-muted)",
            fontWeight: showArchived ? 500 : 400,
          }}>
          <Icons.Archive size={13} />
          {t('candidates.archived')}{archivedCount > 0 ? ` (${archivedCount})` : ""}
        </button>

        {/* Hired / Rejected toggle */}
        <button
          onClick={() => { setShowTerminal(t => !t); setShowArchived(false); setStatus("all"); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 6, fontSize: 12.5, cursor: "pointer",
            border: `1px solid ${showTerminal ? "var(--ink-secondary)" : "var(--border)"}`,
            background: showTerminal ? "var(--bg-sunken)" : "transparent",
            color: showTerminal ? "var(--ink)" : "var(--ink-muted)",
            fontWeight: showTerminal ? 500 : 400,
          }}>
          <Icons.UserCheck size={13} />
          {t('candidates.hiredRejected')}{terminalCount > 0 ? ` (${terminalCount})` : ""}
        </button>

        {!showArchived && !showTerminal && (
          <FilterPill label={t('candidates.stage')} value={status} onChange={setStatus} options={[{ id: "all", label: t('candidates.allStages') }, ...stages]} />
        )}
        <FilterPill label={t('candidates.source')} value={source} onChange={setSource} options={[{ id: "all", label: t('candidates.anySource') }, ...(window.CANDID_DATA.SOURCES || []).map(s => ({ id: s, label: s }))]} />
        <FilterPill label={t('candidates.col.position')} value={jdFilter} onChange={setJdFilter} options={[{ id: "all", label: t('candidates.anyPosition') }, ...(window.CANDID_DATA.JDS || []).map(j => ({ id: j.id, label: j.title }))]} />
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
          <button className="btn btn-ghost btn-sm" onClick={() => { setStatus("all"); setSource("all"); setExp("all"); setJdFilter("all"); setQ(""); }}>
            {t('common.clear')} ({activeFilters})
          </button>
        )}
      </div>

      {view === "table"
        ? <CandidateTable rows={rows} onOpen={onOpenCandidate} t={t}
            showArchived={showArchived}
            onArchive={archiveCandidate} onRestore={restoreCandidate}
            onDelete={promptDelete} onReject={promptReject}
            onHire={promptHire} onAssignJob={(id) => setAssignJobTarget(id)} />
        : <CandidateGrid rows={rows} onOpen={onOpenCandidate} />}

      {createOpen && <NewCandidateModal onClose={() => setCreateOpen(false)} onCreated={handleCreated} />}

      {deleteTarget && (
        <ConfirmDialog
          title={t('candidates.deleteTitle')}
          message={`${deleteTarget.name} ${t('candidates.deleteBody')}`}
          confirmLabel={t('candidates.deleteConfirm')}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {rejectTarget && (
        <ConfirmDialog
          title={t('candidates.reject.title')}
          message={`${t('candidates.reject.messagePre')} ${rejectTarget.name} ${t('candidates.reject.messagePost')}`}
          confirmLabel={t('candidates.reject.confirm')}
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {assignJobTarget && (
        <QuickAssignJobModal
          candidateId={assignJobTarget}
          onClose={() => setAssignJobTarget(null)}
          onAssigned={(id) => {
            setAssignJobTarget(null);
            fetch(`${window.API_BASE}/candidates/${id}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setCandidates(prev => prev.map(c => c.id === id ? mapCandidate(d) : c)); })
              .catch(() => {});
          }}
        />
      )}

      {hireTarget && (
        <HireModal
          candidate={hireTarget}
          onClose={() => setHireTarget(null)}
          onHired={onHired}
        />
      )}
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

const CANDIDATE_TABLE_TERMINAL = new Set(["Rejected", "hired"]);

const CandidateTable = ({ rows, onOpen, t, showArchived, onArchive, onRestore, onDelete, onReject, onHire, onAssignJob }) => (
  <div className="card" style={{ overflow: "hidden" }}>
    <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13.5 }}>
      <thead>
        <tr style={{ background: "var(--bg-sunken)", borderBottom: "1px solid var(--border)" }}>
          <Th>{t('candidates.col.candidate')}</Th><Th>{t('candidates.col.stage')}</Th>
          <Th>{t('candidates.col.position')}</Th>
          <Th>{t('candidates.col.source')}</Th><Th align="right">{t('candidates.col.exp')}</Th>
          <Th>{t('candidates.col.applied')}</Th><Th width={160}></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(c => {
          const isArchived = c.status === "archived";
          const isTerminal = CANDIDATE_TABLE_TERMINAL.has(c.status);
          const isPrePipeline = !c.jdId && !isTerminal && !isArchived;
          const isInPipeline = !!c.jdId && !isTerminal;
          return (
            <tr key={c.id} onClick={() => onOpen(c.id)}
              style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer", opacity: showArchived ? 0.75 : 1 }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <Td><div className="row gap-8"><Avatar name={`${c.first} ${c.last}`} /><div className="col"><span className="weight-500">{c.first} {c.last}</span><span className="text-12 text-muted">{c.email || "—"}</span></div></div></Td>
              <Td><StatusBadge status={c.status} /></Td>
              <Td><span className="text-13 text-secondary" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{c.jdTitle || "—"}</span></Td>
              <Td><span className="text-13 text-secondary">{c.source || "—"}</span></Td>
              <Td align="right"><span className="text-mono text-12">{c.experience != null ? t('candidates.expYears').replace('{n}', c.experience) : "—"}</span></Td>
              <Td><span className="text-mono text-12 text-muted">{c.appliedAt ? c.appliedAt.slice(0, 10) : "—"}</span></Td>
              <Td>
                <div className="row gap-4" style={{ justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                  {isPrePipeline && (
                    <button className="icon-btn" title={t('candidate.action.assignToJob')} style={{ color: "var(--ai)" }} onClick={() => onAssignJob(c.id)}>
                      <Icons.Briefcase size={13} />
                    </button>
                  )}
                  {!isTerminal && !isArchived && (
                    <button className="icon-btn" title={t('candidate.action.hire')} style={{ color: "var(--positive)" }} onClick={() => onHire(c.id)}>
                      <Icons.UserCheck size={13} />
                    </button>
                  )}
                  {!isTerminal && !isArchived && (
                    <button className="icon-btn" title={t('candidates.reject.confirm')} style={{ color: "var(--danger)" }} onClick={() => onReject(c.id)}>
                      <Icons.UserX size={13} />
                    </button>
                  )}
                  {isArchived ? (
                    <button className="icon-btn" title={t('candidates.action.restore')} onClick={() => onRestore(c.id)}>
                      <Icons.RotateCcw size={13} />
                    </button>
                  ) : !isTerminal && (
                    <button className="icon-btn" title={t('candidates.action.archive')} onClick={() => onArchive(c.id)}>
                      <Icons.Archive size={13} />
                    </button>
                  )}
                  <button className="icon-btn" title={t('common.delete')} style={{ color: "var(--danger)" }} onClick={() => onDelete(c.id)}>
                    <Icons.Trash size={13} />
                  </button>
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
    {rows.length === 0 && (
      <div style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>
        {showArchived ? t('candidates.noArchived') : t('candidates.noMatch')}
      </div>
    )}
  </div>
);

const Th = ({ children, align = "left", width }) => (
  <th style={{ textAlign: align, padding: "10px 14px", fontSize: 11.5, fontWeight: 500, color: "var(--ink-secondary)", letterSpacing: "0.02em", textTransform: "uppercase", width }}>{children}</th>
);
const Td = ({ children, align = "left" }) => (
  <td style={{ textAlign: align, padding: "12px 14px", verticalAlign: "middle" }}>{children}</td>
);

const CandidateGrid = ({ rows, onOpen }) => {
  const t = window.useT();
  return (
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
          {c.experience != null && <Badge>{t('candidates.expYearsBadge').replace('{n}', c.experience)}</Badge>}
          {c.source && <Badge>{c.source}</Badge>}
        </div>
      </div>
    ))}
  </div>
  );
};

window.CandidatesScreen = CandidatesScreen;
