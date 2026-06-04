// PortalScreen — public job listing portal (no auth required)
// Rendered when URL hash starts with #portal/{slug}

const { useState, useEffect } = React;

// ── Apply Modal ───────────────────────────────────────────────────────────────

const ApplyModal = ({ job, orgSlug, onClose }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cvText, setCvText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isValidEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

  const canSubmit = () =>
    firstName.trim() && lastName.trim() && email.trim() && isValidEmail(email);

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await window._baseFetch(
        `${window.API_BASE}/public/organizations/${orgSlug}/jobs/${job.id}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            cv_text: cvText.trim() || null,
          }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Submission failed");
      }
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 5,
    color: "#374151",
  };

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  };

  const modalStyle = {
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh",
    overflowY: "auto",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        {success ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>Application submitted!</h2>
            <p style={{ color: "#6b7280", margin: "0 0 24px" }}>
              Check your email for a verification code.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#111827",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>Apply for {job.title}</h2>
                {job.location && (
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{job.location}</span>
                )}
              </div>
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", padding: 4 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>First name *</label>
                  <input
                    style={inputStyle}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alice"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Last name *</label>
                  <input
                    style={inputStyle}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email *</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@example.com"
                />
              </div>

              <div>
                <label style={labelStyle}>Phone <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span></label>
                <input
                  style={inputStyle}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 0100"
                />
              </div>

              <div>
                <label style={labelStyle}>CV / Resume <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span></label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 140 }}
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Paste your CV here — work experience, skills, education…"
                />
              </div>

              {error && (
                <div style={{ color: "#dc2626", fontSize: 13, padding: "8px 12px", background: "#fef2f2", borderRadius: 6 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1.5px solid #d1d5db",
                    background: "#fff",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit() || submitting}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: "#111827",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: canSubmit() && !submitting ? "pointer" : "not-allowed",
                    opacity: canSubmit() && !submitting ? 1 : 0.6,
                  }}
                >
                  {submitting ? "Submitting…" : "Submit application"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Job Card ──────────────────────────────────────────────────────────────────

const JobCard = ({ job, accentColor, onApply }) => {
  const MAX_DESC_LENGTH = 200;
  const excerpt = job.description
    ? job.description.length > MAX_DESC_LENGTH
      ? job.description.slice(0, MAX_DESC_LENGTH) + "…"
      : job.description
    : null;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1.5px solid #e5e7eb",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#111827" }}>{job.title}</h3>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "3px 10px",
            borderRadius: 20,
            background: "#f0fdf4",
            color: "#16a34a",
            whiteSpace: "nowrap",
          }}
        >
          {job.openings} {job.openings === 1 ? "opening" : "openings"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {job.location && (
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            📍 {job.location}
          </span>
        )}
        {job.remote_ok && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 12,
              background: "#eff6ff",
              color: "#2563eb",
            }}
          >
            Remote OK
          </span>
        )}
      </div>

      {excerpt && (
        <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{excerpt}</p>
      )}

      <div style={{ marginTop: 4 }}>
        <button
          onClick={() => onApply(job)}
          style={{
            padding: "9px 20px",
            borderRadius: 8,
            border: "none",
            background: accentColor || "#111827",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Apply →
        </button>
      </div>
    </div>
  );
};

// ── Portal Screen ─────────────────────────────────────────────────────────────

window.PortalScreen = ({ slug }) => {
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    if (!slug) return;
    window._baseFetch(`${window.API_BASE}/public/organizations/${slug}/jobs`)
      .then((response) => {
        if (!response.ok) throw new Error("Portal not found");
        return response.json();
      })
      .then((data) => { setPortalData(data); setLoading(false); })
      .catch((err) => { setLoadError(err.message); setLoading(false); });
  }, [slug]);

  const accentColor = portalData?.branding?.primary_color || "#111827";
  const bgColor = portalData?.branding?.bg_color || "#f9fafb";

  const rootStyle = {
    minHeight: "100vh",
    background: bgColor,
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  };

  const headerStyle = {
    background: accentColor,
    color: "#fff",
    padding: "40px 24px",
    textAlign: "center",
  };

  if (loading) {
    return (
      <div style={rootStyle}>
        <div style={{ textAlign: "center", padding: "80px 24px", color: "#6b7280" }}>
          Loading…
        </div>
      </div>
    );
  }

  if (loadError || !portalData) {
    return (
      <div style={rootStyle}>
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
          <h2 style={{ color: "#111827", marginBottom: 8 }}>Portal not found</h2>
          <p style={{ color: "#6b7280" }}>{loadError || "This organization's job portal is unavailable."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {portalData.org_name}
        </h1>
        <p style={{ margin: 0, opacity: 0.85, fontSize: 15 }}>Open positions</p>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
        {portalData.jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280", fontSize: 15 }}>
            No open positions at this time. Check back later!
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}
          >
            {portalData.jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                accentColor={accentColor}
                onApply={(selectedJob) => setSelectedJob(selectedJob)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedJob && (
        <ApplyModal
          job={selectedJob}
          orgSlug={slug}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
};
