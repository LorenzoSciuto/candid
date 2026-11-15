// PortalScreen — public job listing portal (no auth required)
// Rendered when URL hash starts with #portal/{slug}

const { useState, useEffect, useMemo } = React;

const STORAGE_KEY_APPLIED = (slug) => `candid_portal_applied_${slug}`;
const STORAGE_KEY_STARRED = (slug) => `candid_portal_starred_${slug}`;

const loadSet = (key) => { try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); } };
const saveSet = (key, set) => { try { localStorage.setItem(key, JSON.stringify([...set])); } catch {} };

// ── Design tokens ─────────────────────────────────────────────────────────────

const mix = (hex, amount) => {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
};

const luminance = (hex) => {
  const num = parseInt(hex.replace("#",""), 16);
  const r = (num >> 16) / 255, g = ((num >> 8) & 0xff) / 255, b = (num & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const onAccent = (hex) => luminance(hex || "#111") > 0.45 ? "#111827" : "#ffffff";

// ── Apply Modal ───────────────────────────────────────────────────────────────

const ApplyModal = ({ job, orgSlug, accentColor, onClose, onApplied }) => {
  const t = window.useT();
  const [cvFile,     setCvFile]    = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]    = useState("");
  const [success,    setSuccess]  = useState(false);

  const accent = accentColor || "#111827";
  const fg     = onAccent(accent);

  const submit = async () => {
    if (!cvFile) return;
    setSubmitting(true); setError("");
    try {
      const formData = new FormData();
      formData.append("cv_file", cvFile);
      const res = await fetch(`${window.API_BASE}/public/organizations/${orgSlug}/jobs/${job.id}/apply`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || t('portal.submission_failed'));
      setSuccess(true);
      onApplied(job.id);
    } catch (err) { setError(err.message || t('portal.generic_error')); }
    setSubmitting(false);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (file) { setCvFile(file); setError(""); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, fontFamily: "ui-sans-serif, system-ui, sans-serif", boxShadow: "0 24px 60px rgba(0,0,0,.18)" }}>

        <div style={{ background: accent, padding: "24px 28px", borderRadius: "16px 16px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", opacity: .7, color: fg, marginBottom: 4 }}>{t('portal.apply_for_position')}</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: fg, letterSpacing: "-.01em" }}>{job.title}</h2>
              {job.location && <div style={{ marginTop: 4, fontSize: 13, color: fg, opacity: .75 }}>📍 {job.location.split(",").map(l => l.trim()).filter(Boolean).join(" · ")}</div>}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: fg, opacity: .7, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0, marginLeft: 12 }}>×</button>
          </div>
        </div>

        <div style={{ padding: "28px 28px 24px" }}>
          {success ? (
            <div style={{ textAlign: "center", padding: "32px 0 16px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 16 }}>✓</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>{t('portal.application_submitted')}</h3>
              <p style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>{t('portal.application_thanks')}</p>
              <button onClick={onClose} style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: accent, color: fg, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t('portal.done')}</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>{t('portal.upload_cv')}</label>
                <label
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleFileDrop}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 10, padding: "36px 24px", borderRadius: 12,
                    border: `2px dashed ${cvFile ? accent : "#d1d5db"}`,
                    background: cvFile ? `${accent}0d` : "#fafafa",
                    cursor: "pointer", textAlign: "center", transition: "border-color .15s, background .15s",
                  }}>
                  <input type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={handleFileDrop} />
                  {cvFile ? (
                    <>
                      <span style={{ fontSize: 28 }}>📄</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{cvFile.name}</span>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{t('portal.file_size_replace').replace('{size}', (cvFile.size / 1024).toFixed(0))}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 32 }}>📤</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{t('portal.drop_cv')}</span>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{t('portal.file_types_hint')}</span>
                    </>
                  )}
                </label>
              </div>

              {error && <div style={{ color: "#dc2626", fontSize: 13, padding: "10px 14px", background: "#fef2f2", borderRadius: 8 }}>{error}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
                {submitting && <span style={{ fontSize: 13, color: "#6b7280" }}>{t('portal.analysing_cv')}</span>}
                <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{t('common.cancel')}</button>
                <button onClick={submit} disabled={!cvFile || submitting}
                  style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: accent, color: fg, fontSize: 14, fontWeight: 600, cursor: cvFile && !submitting ? "pointer" : "not-allowed", opacity: cvFile && !submitting ? 1 : .55, fontFamily: "inherit", transition: "opacity .15s" }}>
                  {submitting ? t('portal.submitting') : t('portal.apply')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Job Card ──────────────────────────────────────────────────────────────────

const fmtPortalSalary = (min, max, currency, t) => {
  const sym = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", CAD: "CA$", AUD: "A$", JPY: "¥" }[currency] || currency || "";
  const fmt = (n) => n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return t('portal.salary_from').replace('{amount}', fmt(min));
  if (max) return t('portal.salary_up_to').replace('{amount}', fmt(max));
  return null;
};

const JobCard = ({ job, accentColor, applied, starred, onApply, onToggleStar }) => {
  const t = window.useT();
  const [hovered, setHovered] = useState(false);
  const accent = accentColor || "#111827";
  const fg     = onAccent(accent);

  const excerpt = job.description
    ? job.description.length > 180 ? job.description.slice(0, 180) + "…" : job.description
    : null;

  const locations = job.location ? job.location.split(",").map(l => l.trim()).filter(Boolean) : [];
  const salaryLabel = fmtPortalSalary(job.salary_min, job.salary_max, job.salary_currency, t);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        borderRadius: 16,
        border: `1.5px solid ${hovered ? accent : "#e5e7eb"}`,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "border-color .2s, box-shadow .2s, transform .15s",
        boxShadow: hovered ? "0 8px 32px rgba(0,0,0,.10)" : "0 1px 4px rgba(0,0,0,.05)",
        transform: hovered ? "translateY(-2px)" : "none",
        cursor: "default",
        position: "relative",
      }}
    >
      {/* Applied badge */}
      {applied && (
        <div style={{ position: "absolute", top: 16, right: 52, background: "#f0fdf4", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, letterSpacing: ".04em", textTransform: "uppercase" }}>
          {t('portal.applied_badge')}
        </div>
      )}

      {/* Star button */}
      <button
        onClick={() => onToggleStar(job.id)}
        title={starred ? t('portal.remove_favourite') : t('portal.save_favourite')}
        style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4, color: starred ? "#f59e0b" : "#d1d5db", transition: "color .15s, transform .1s", transform: hovered || starred ? "scale(1.1)" : "scale(1)" }}
      >
        {starred ? "★" : "☆"}
      </button>

      {/* Title row */}
      <div style={{ paddingRight: 36 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#111827", letterSpacing: "-.01em", lineHeight: 1.3 }}>{job.title}</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {locations.map(l => (
            <span key={l} style={{ fontSize: 12.5, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 6 }}>📍 {l}</span>
          ))}
          {salaryLabel && (
            <span style={{ fontSize: 12.5, color: "#065f46", background: "#d1fae5", padding: "2px 8px", borderRadius: 6, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              💰 {salaryLabel}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {excerpt && (
        <p style={{ margin: 0, fontSize: 13.5, color: "#4b5563", lineHeight: 1.65, flexGrow: 1 }}>{excerpt}</p>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#16a34a", background: "#f0fdf4", padding: "3px 10px", borderRadius: 20 }}>
          {t(job.openings === 1 ? 'portal.opening_one' : 'portal.opening_many').replace('{n}', job.openings)}
        </span>
        <button
          onClick={() => onApply(job)}
          style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: applied ? "#f3f4f6" : accent, color: applied ? "#6b7280" : fg, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background .15s, transform .1s", transform: hovered && !applied ? "scale(1.02)" : "scale(1)" }}
        >
          {applied ? t('portal.apply_again') : t('portal.apply')}
        </button>
      </div>
    </div>
  );
};

// ── Portal Screen ─────────────────────────────────────────────────────────────

window.PortalScreen = ({ slug }) => {
  const t = window.useT();
  const [portalData,   setPortalData]  = useState(null);
  const [loading,      setLoading]     = useState(true);
  const [loadError,    setLoadError]   = useState("");
  const [selectedJob,  setSelectedJob] = useState(null);
  const [q,            setQ]           = useState("");
  const [locFilter,    setLocFilter]   = useState("all");
  const [showStarred,  setShowStarred] = useState(false);
  const [applied,      setApplied]     = useState(() => loadSet(STORAGE_KEY_APPLIED(slug)));
  const [starred,      setStarred]     = useState(() => loadSet(STORAGE_KEY_STARRED(slug)));

  useEffect(() => {
    if (!slug) return;
    fetch(`${window.API_BASE}/public/organizations/${slug}/jobs`)
      .then(r => { if (!r.ok) throw new Error(t('portal.not_found')); return r.json(); })
      .then(d => { setPortalData(d); setLoading(false); })
      .catch(err => { setLoadError(err.message); setLoading(false); });
  }, [slug]);

  const markApplied = (id) => {
    setApplied(prev => { const next = new Set(prev); next.add(id); saveSet(STORAGE_KEY_APPLIED(slug), next); return next; });
  };

  const toggleStar = (id) => {
    setStarred(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveSet(STORAGE_KEY_STARRED(slug), next);
      return next;
    });
  };

  const accent  = portalData?.branding?.primary_color || "#4F46E5";
  const bgColor = portalData?.branding?.background_color || "#f8faff";
  const logo    = portalData?.branding?.logo_url;
  const fg      = onAccent(accent);

  const allLocations = useMemo(() => {
    if (!portalData) return [];
    const set = new Set();
    portalData.jobs.forEach(j => { if (j.location) j.location.split(",").forEach(l => set.add(l.trim())); });
    return [...set].filter(Boolean).sort();
  }, [portalData]);

  const filteredJobs = useMemo(() => {
    if (!portalData) return [];
    return portalData.jobs.filter(j => {
      if (showStarred && !starred.has(j.id)) return false;
      if (q) {
        const ql = q.toLowerCase();
        if (!(j.title || "").toLowerCase().includes(ql) && !(j.description || "").toLowerCase().includes(ql)) return false;
      }
      if (locFilter !== "all") {
        const locs = (j.location || "").split(",").map(l => l.trim());
        if (!locs.includes(locFilter)) return false;
      }
      return true;
    });
  }, [portalData, q, locFilter, showStarred, starred]);

  // Only fonts offered in Settings → Branding are applied; anything else falls back to the system stack.
  const brandFont = (window.PORTAL_FONTS || []).find(f => f.value === portalData?.branding?.font_family);
  const containerStyle = { minHeight: "100vh", background: bgColor, fontFamily: `${brandFont ? brandFont.value + ", " : ""}ui-sans-serif, system-ui, -apple-system, sans-serif` };
  const fontLink = brandFont && brandFont.label !== "Georgia" && (
    <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${brandFont.label.replace(/ /g, "+")}:wght@400;700&display=swap`} />
  );

  if (loading) return (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12 }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ color: "#6b7280", fontSize: 14 }}>{t('common.loading')}</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (loadError || !portalData) return (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 8, padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('portal.not_found')}</h2>
        <p style={{ color: "#6b7280", margin: 0 }}>{loadError || t('portal.unavailable')}</p>
      </div>
    </div>
  );

  const starredCount = portalData.jobs.filter(j => starred.has(j.id)).length;

  return (
    <div style={containerStyle}>
      {fontLink}

      {/* ── Hero header ───────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, ${accent} 0%, ${mix(accent, -40)} 100%)`, padding: "60px 24px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.06)", pointerEvents: "none" }} />

        {logo && <img src={logo} alt={t('portal.logo_alt')} style={{ maxHeight: 52, maxWidth: 180, marginBottom: 20, display: "block", margin: "0 auto 20px", objectFit: "contain" }} />}

        <h1 style={{ margin: "0 0 10px", fontSize: 36, fontWeight: 800, color: fg, letterSpacing: "-.03em", lineHeight: 1.1 }}>
          {portalData.org_name}
        </h1>
        <p style={{ margin: "0 0 28px", color: fg, opacity: .8, fontSize: 16, fontWeight: 400 }}>
          {filteredJobs.length === portalData.jobs.length
            ? t(portalData.jobs.length === 1 ? 'portal.open_positions_one' : 'portal.open_positions_many').replace('{n}', portalData.jobs.length)
            : t('portal.positions_filtered').replace('{n}', filteredJobs.length).replace('{total}', portalData.jobs.length)}
        </p>

        {/* Search bar */}
        <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: .5, pointerEvents: "none" }}>🔍</span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('portal.search_placeholder')}
            style={{ width: "100%", padding: "14px 16px 14px 44px", borderRadius: 12, border: "none", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "rgba(255,255,255,.92)", boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}
          />
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "12px 24px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
        {allLocations.length > 0 && (
          <select
            value={locFilter}
            onChange={e => setLocFilter(e.target.value)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13.5, outline: "none", fontFamily: "inherit", background: "#fff", cursor: "pointer" }}
          >
            <option value="all">{t('portal.all_locations')}</option>
            {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}

        <button
          onClick={() => setShowStarred(v => !v)}
          style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${showStarred ? "#f59e0b" : "#e5e7eb"}`, background: showStarred ? "#fffbeb" : "#fff", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", color: showStarred ? "#92400e" : "#374151", fontWeight: showStarred ? 600 : 400, transition: "all .15s", display: "flex", alignItems: "center", gap: 6 }}
        >
          ★ {t('portal.favourites')}{starredCount > 0 ? ` (${starredCount})` : ""}
        </button>

        {applied.size > 0 && (
          <span style={{ fontSize: 13, color: "#16a34a", background: "#f0fdf4", padding: "6px 14px", borderRadius: 8, fontWeight: 500 }}>
            ✓ {t(applied.size === 1 ? 'portal.applied_count_one' : 'portal.applied_count_many').replace('{n}', applied.size)}
          </span>
        )}

        {(q || locFilter !== "all" || showStarred) && (
          <button onClick={() => { setQ(""); setLocFilter("all"); setShowStarred(false); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#6b7280" }}>
            {t('portal.clear_filters')}
          </button>
        )}
      </div>

      {/* ── Job grid ──────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px 80px" }}>
        {filteredJobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#6b7280" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
            <p style={{ fontSize: 16, margin: 0 }}>{t('portal.no_matches')}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                accentColor={accent}
                applied={applied.has(job.id)}
                starred={starred.has(job.id)}
                onApply={setSelectedJob}
                onToggleStar={toggleStar}
              />
            ))}
          </div>
        )}
      </div>

      {selectedJob && (
        <ApplyModal
          job={selectedJob}
          orgSlug={slug}
          accentColor={accent}
          onClose={() => setSelectedJob(null)}
          onApplied={(id) => { markApplied(id); setSelectedJob(null); }}
        />
      )}
    </div>
  );
};
