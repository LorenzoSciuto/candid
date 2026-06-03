// Employees screen

const CURRENCY_SYMBOLS = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF", JPY: "¥", CAD: "CA$", AUD: "A$", SEK: "kr", DKK: "kr", NOK: "kr" };

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

const RATING_VISUAL = {
  "Exceeds Expectations":      { border: "#22c55e", bg: "rgba(34,197,94,0.05)",   badge: "rgba(34,197,94,0.13)",   text: "#15803d", dot: "#22c55e" },
  "Meets Expectations":        { border: "#3b82f6", bg: "rgba(59,130,246,0.04)",  badge: "rgba(59,130,246,0.1)",   text: "#1d4ed8", dot: "#3b82f6" },
  "Partially Meets Expectations":{ border: "#f59e0b", bg: "rgba(245,158,11,0.05)", badge: "rgba(245,158,11,0.12)", text: "#b45309", dot: "#f59e0b" },
  "Below Expectations":        { border: "#ef4444", bg: "rgba(239,68,68,0.05)",   badge: "rgba(239,68,68,0.1)",    text: "#dc2626", dot: "#ef4444" },
};
const RATING_VISUAL_DEFAULT =  { border: "var(--border)", bg: "transparent", badge: "var(--bg-sunken)", text: "var(--ink-muted)", dot: "var(--ink-muted)" };

const getEmpLocations = () => {
  try {
    const stored = localStorage.getItem("candid_locations");
    if (stored) return JSON.parse(stored);
  } catch {}
  return ["Milano", "Remote", "Milano / Remote", "Roma", "Torino", "Bergamo", "Brescia", "Monza"];
};

const downloadText = (text, filename) => {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
};

const EmpTh = ({ children, align = "left", width }) => (
  <th style={{ textAlign: align, padding: "10px 14px", fontSize: 11.5, fontWeight: 500, color: "var(--ink-secondary)", letterSpacing: "0.02em", textTransform: "uppercase", width }}>
    {children}
  </th>
);
const EmpTd = ({ children, align = "left" }) => (
  <td style={{ textAlign: align, padding: "12px 14px", verticalAlign: "middle" }}>{children}</td>
);

// ── Review components ─────────────────────────────────────────────────────────

const ReviewCard = ({ review, onEdit, onDelete }) => {
  const t = window.useT();
  const visual = review.rating ? (RATING_VISUAL[review.rating] || RATING_VISUAL_DEFAULT) : RATING_VISUAL_DEFAULT;
  const ratingLabel = review.rating ? t(RATING_TRANSLATION_KEYS[review.rating] || review.rating) : null;

  return (
    <div style={{
      borderRadius: 8, marginBottom: 10, overflow: "hidden",
      border: "1px solid var(--border)", borderLeft: `3px solid ${visual.border}`,
      background: visual.bg,
    }}>
      <div style={{ padding: "12px 16px" }}>
        {/* Header row */}
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div className="col gap-6">
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>{review.period}</span>
              {ratingLabel && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: visual.badge, color: visual.text, borderRadius: 5, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: visual.dot, flexShrink: 0 }} />
                  {ratingLabel}
                </span>
              )}
            </div>
            {review.next_review_date && (
              <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
                Next: {review.next_review_date}
              </span>
            )}
          </div>
          <div className="row gap-4">
            <button className="icon-btn" onClick={() => onEdit(review)} title={t('common.edit')} style={{ opacity: 0.6 }}><Icons.Edit size={13} /></button>
            <button className="icon-btn" onClick={() => onDelete(review)} title={t('common.delete')} style={{ color: "var(--danger)", opacity: 0.7 }}><Icons.X size={13} /></button>
          </div>
        </div>

        {/* Feedback body */}
        {(review.manager_feedback || review.self_evaluation) && (
          <div className="col gap-8" style={{ borderTop: "1px solid var(--border-soft, rgba(0,0,0,0.06))", paddingTop: 10 }}>
            {review.manager_feedback && (
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 3 }}>Manager</span>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-secondary)", lineHeight: 1.65 }}>{review.manager_feedback}</p>
              </div>
            )}
            {review.self_evaluation && (
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 3 }}>Self</span>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-secondary)", lineHeight: 1.65 }}>{review.self_evaluation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: "rgba(0,0,0,0.02)", padding: "6px 16px", borderTop: "1px solid var(--border-soft, rgba(0,0,0,0.06))" }}>
        <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{t('employees.reviews.created')}: {review.created_at}</span>
      </div>
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
  const [improvingManager, setImprovingManager] = useState(false);
  const [improvingSelf, setImprovingSelf] = useState(false);

  const save = async () => {
    setSaving(true);
    const body = { period: period || undefined, rating: rating || null, self_evaluation: selfEvaluation || null, manager_feedback: managerFeedback || null, next_review_date: nextReviewDate || null };
    try {
      if (review) {
        await fetch(`${window.API_BASE}/employees/${employeeId}/reviews/${review.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await fetch(`${window.API_BASE}/employees/${employeeId}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
    } catch {}
    setSaving(false);
    onSaved();
  };

  const improveField = async (fieldName, currentValue, setter, setImproving) => {
    if (!currentValue.trim()) return;
    setImproving(true);
    try {
      const response = await fetch(`${window.API_BASE}/employees/${employeeId}/reviews/improve-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentValue, field: fieldName }),
      });
      if (response.ok) {
        const data = await response.json();
        setter(data.improved_text || currentValue);
      }
    } catch {}
    setImproving(false);
  };

  const title = review ? t('employees.reviews.edit') : t('employees.reviews.add');
  return (
    <Modal open title={title} onClose={onClose}
      footer={<><Btn onClick={onClose}>{t('common.cancel')}</Btn><Btn kind="primary" onClick={save} disabled={!period || saving}>{saving ? t('common.saving') : t('common.save')}</Btn></>}>
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
              {RATING_OPTIONS.map(opt => <option key={opt} value={opt}>{t(RATING_TRANSLATION_KEYS[opt])}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>{t('employees.reviews.selfEvaluation')}</label>
            <Btn icon={<Icons.Sparkles size={12} />}
              onClick={() => improveField("self_evaluation", selfEvaluation, setSelfEvaluation, setImprovingSelf)}
              disabled={improvingSelf || !selfEvaluation.trim()} style={{ fontSize: 11 }}>
              {improvingSelf ? t('common.improving') : t('employees.reviews.improveWithAi')}
            </Btn>
          </div>
          <textarea className="input" rows={3} style={{ resize: "vertical" }} value={selfEvaluation} onChange={e => setSelfEvaluation(e.target.value)} />
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>{t('employees.reviews.managerFeedback')}</label>
            <Btn icon={<Icons.Sparkles size={12} />}
              onClick={() => improveField("manager_feedback", managerFeedback, setManagerFeedback, setImprovingManager)}
              disabled={improvingManager || !managerFeedback.trim()} style={{ fontSize: 11 }}>
              {improvingManager ? t('common.improving') : t('employees.reviews.improveWithAi')}
            </Btn>
          </div>
          <textarea className="input" rows={4} style={{ resize: "vertical" }} value={managerFeedback} onChange={e => setManagerFeedback(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('employees.reviews.nextReviewDate')}</label>
          <input className="input" type="date" value={nextReviewDate} onChange={e => setNextReviewDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

// ── Profile page sub-sections ─────────────────────────────────────────────────

const EmployeeReviewsSection = ({ employeeId }) => {
  const t = window.useT();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
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
    await fetch(`${window.API_BASE}/employees/${employeeId}/reviews/${review.id}`, { method: "DELETE" }).catch(() => {});
    loadReviews();
  };

  const latestRating = reviews.length > 0 ? reviews[0]?.rating : null;
  const latestVisual = latestRating ? (RATING_VISUAL[latestRating] || RATING_VISUAL_DEFAULT) : null;

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: latestVisual ? 12 : 16 }}>
        <div className="row gap-10" style={{ alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t('employees.reviews.title')}</span>
          {reviews.length > 0 && <span style={{ fontSize: 12, color: "var(--ink-muted)", background: "var(--bg-sunken)", padding: "1px 7px", borderRadius: 4 }}>{reviews.length}</span>}
        </div>
        <Btn kind="primary" icon={<Icons.Plus size={13} />} onClick={() => setAddOpen(true)}>{t('employees.reviews.add')}</Btn>
      </div>

      {/* Latest rating summary bar */}
      {latestVisual && (
        <div style={{ display: "flex", gap: 3, marginBottom: 16, height: 4, borderRadius: 2, overflow: "hidden" }}>
          {RATING_OPTIONS.map(option => {
            const count = reviews.filter(r => r.rating === option).length;
            return count > 0 ? (
              <div key={option} style={{ flex: count, background: RATING_VISUAL[option]?.border || "var(--border)", borderRadius: 2, transition: "flex 0.3s" }} title={`${count} × ${option}`} />
            ) : null;
          })}
          {reviews.filter(r => !r.rating).length > 0 && (
            <div style={{ flex: reviews.filter(r => !r.rating).length, background: "var(--border)", borderRadius: 2 }} />
          )}
        </div>
      )}

      {loading && <div style={{ textAlign: "center", color: "var(--ink-muted)", padding: 24 }}>{t('common.loading')}</div>}
      {!loading && reviews.length === 0 && <div style={{ textAlign: "center", color: "var(--ink-muted)", padding: 24 }}>{t('employees.reviews.empty')}</div>}
      {!loading && reviews.map(review => (
        <ReviewCard key={review.id} review={review} onEdit={r => setEditTarget(r)} onDelete={r => setDeleteTarget(r)} />
      ))}
      {addOpen && <ReviewFormModal t={t} employeeId={employeeId} review={null} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); loadReviews(); }} />}
      {editTarget && <ReviewFormModal t={t} employeeId={employeeId} review={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); loadReviews(); }} />}
      {deleteTarget && (
        <Modal open title={t('employees.reviews.deleteTitle')} onClose={() => setDeleteTarget(null)}
          footer={<><Btn onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Btn><Btn kind="danger" onClick={() => handleDelete(deleteTarget)}>{t('common.delete')}</Btn></>}>
          <span className="text-13 text-secondary">{deleteTarget.period}</span>
        </Modal>
      )}
    </div>
  );
};

const EmployeeNotesSection = ({ employeeId, initialNotes }) => {
  const t = window.useT();
  const [notes, setNotes] = useState(initialNotes || "");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (value) => {
    setNotes(value);
    setIsDirty(value !== (initialNotes || ""));
  };

  const save = async () => {
    setSaving(true);
    await fetch(`${window.API_BASE}/employees/${employeeId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    }).catch(() => {});
    setSaving(false);
    setIsDirty(false);
  };

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t('employees.notes.title')}</span>
        {isDirty && <Btn kind="primary" onClick={save} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Btn>}
      </div>
      <textarea className="input" rows={5} style={{ resize: "vertical", width: "100%" }}
        placeholder={t('employees.notes.placeholder')} value={notes}
        onChange={e => handleChange(e.target.value)} />
    </div>
  );
};

const EmployeeReminderSection = ({ employeeId, employee, onEmployeeChanged }) => {
  const t = window.useT();
  const [reminderNote, setReminderNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const setReminder = async () => {
    if (!reminderNote.trim()) return;
    setSaving(true);
    await fetch(`${window.API_BASE}/employees/${employeeId}/reminder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: reminderNote }),
    }).catch(() => {});
    setSaving(false);
    setReminderNote("");
    onEmployeeChanged();
  };

  const dismissReminder = async () => {
    setDismissing(true);
    await fetch(`${window.API_BASE}/employees/${employeeId}/reminder`, { method: "DELETE" }).catch(() => {});
    setDismissing(false);
    onEmployeeChanged();
  };

  if (employee.reminder_active) {
    return (
      <div className="card" style={{ padding: "16px 20px", borderLeft: "3px solid var(--warning, #f59e0b)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div className="row gap-6" style={{ alignItems: "center" }}>
            <Icons.Bell size={14} style={{ color: "var(--warning, #f59e0b)" }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t('employees.reminder.active')}</span>
          </div>
          <Btn kind="danger" onClick={dismissReminder} disabled={dismissing} icon={<Icons.BellOff size={13} />}>
            {dismissing ? "…" : t('employees.reminder.dismiss')}
          </Btn>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.5 }}>{employee.reminder_note}</p>
        {employee.reminder_created_at && (
          <span className="text-11 text-muted">{t('employees.reminder.created')}: {employee.reminder_created_at.slice(0, 10)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div className="row gap-6" style={{ alignItems: "center", marginBottom: 10 }}>
        <Icons.Bell size={14} style={{ color: "var(--ink-muted)" }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t('employees.reminder.title')}</span>
      </div>
      <textarea className="input" rows={3} style={{ resize: "vertical", width: "100%", marginBottom: 10 }}
        placeholder={t('employees.reminder.placeholder')} value={reminderNote}
        onChange={e => setReminderNote(e.target.value)} />
      <Btn kind="primary" icon={<Icons.Bell size={13} />} onClick={setReminder}
        disabled={!reminderNote.trim() || saving}>
        {saving ? t('common.saving') : t('employees.reminder.set')}
      </Btn>
    </div>
  );
};

// ── Recruiting history (read-only, from candidate record) ────────────────────

const RecruitingHistorySection = ({ candidateId }) => {
  const t = window.useT();
  const [candidate, setCandidate] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`${window.API_BASE}/candidates/${candidateId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setCandidate(data))
      .catch(() => {});
  }, [candidateId]);

  if (!candidate) return null;

  const preAnalysis = (() => { try { return JSON.parse(candidate.ai_pre_analysis || "null"); } catch { return null; } })();
  const statusHistory = (() => { try { return JSON.parse(candidate.status_history || "[]"); } catch { return []; } })();
  const interviews = candidate.interviews || [];
  const evaluation = candidate.evaluation || null;
  const statusLabels = Object.fromEntries((window.CANDID_DATA.STATUS || []).map(s => [s.id, s.label]));

  return (
    <div className="card" style={{ padding: "16px 20px", marginTop: 16, borderTop: "2px solid var(--border)" }}>
      <button style={{ all: "unset", cursor: "pointer", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        onClick={() => setExpanded(e => !e)}>
        <div className="row gap-8" style={{ alignItems: "center" }}>
          <Icons.FileText size={14} style={{ color: "var(--ink-muted)" }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Recruiting History</span>
          <span style={{ fontSize: 11, color: "var(--ink-muted)", background: "var(--bg-sunken)", padding: "2px 7px", borderRadius: 4 }}>read-only</span>
        </div>
        <Icons.ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {expanded && (
        <div className="col gap-16" style={{ marginTop: 16 }}>
          {/* Score + overview */}
          {preAnalysis && (
            <div>
              <div className="row gap-12" style={{ marginBottom: 8 }}>
                {candidate.score != null && <span style={{ fontWeight: 600 }}>Score: {candidate.score?.toFixed(1)} / 5</span>}
              </div>
              {preAnalysis.overview && <p style={{ margin: 0, fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.6 }}>{preAnalysis.overview}</p>}
              {preAnalysis.strengths?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Strengths</span>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: "var(--ink-secondary)" }}>
                    {preAnalysis.strengths.map((strength, index) => <li key={index}>{strength}</li>)}
                  </ul>
                </div>
              )}
              {preAnalysis.weaknesses?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Areas for development</span>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: "var(--ink-secondary)" }}>
                    {preAnalysis.weaknesses.map((weakness, index) => <li key={index}>{weakness}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Status timeline */}
          {statusHistory.length > 0 && (
            <div>
              <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Pipeline timeline</span>
              <div className="col gap-6">
                {statusHistory.map((entry, index) => (
                  <div key={index} className="row gap-10" style={{ alignItems: "center", fontSize: 12.5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink-muted)", flexShrink: 0 }} />
                    <span style={{ color: "var(--ink-secondary)" }}>{statusLabels[entry.status] || entry.status}</span>
                    <span className="text-muted">·</span>
                    <span className="text-muted">{(entry.at || "").slice(0, 10)}</span>
                    {entry.by && <><span className="text-muted">·</span><span className="text-muted">{entry.by}</span></>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interviews */}
          {interviews.length > 0 && (
            <div>
              <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Interviews ({interviews.length})</span>
              <div className="col gap-8">
                {interviews.map(interview => (
                  <div key={interview.id} className="card" style={{ padding: "10px 14px", fontSize: 12.5 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 500 }}>{interview.title || interview.type || "Interview"}</span>
                      <span className="text-muted">{(interview.date || "").slice(0, 10)}</span>
                    </div>
                    {interview.interviewer && <span className="text-muted" style={{ display: "block", marginTop: 2 }}>{interview.interviewer}</span>}
                    {interview.ai_summary && <p style={{ margin: "6px 0 0", color: "var(--ink-secondary)", lineHeight: 1.5 }}>{interview.ai_summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final evaluation */}
          {evaluation && (
            <div>
              <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Final evaluation</span>
              <div className="card" style={{ padding: "12px 16px", fontSize: 12.5 }}>
                {evaluation.final_recommendation && (
                  <div className="row gap-8" style={{ marginBottom: 8, alignItems: "center" }}>
                    <span className="text-muted">Recommendation:</span>
                    <span style={{ fontWeight: 600 }}>{evaluation.final_recommendation}</span>
                  </div>
                )}
                {evaluation.summary && <p style={{ margin: 0, color: "var(--ink-secondary)", lineHeight: 1.5 }}>{evaluation.summary}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Employee profile full page ────────────────────────────────────────────────

const EmployeeProfilePage = ({ employeeId, employees, showSalary, fmtSalary, currencyCode, sym, onBack, onEmployeesUpdated }) => {
  const t = window.useT();
  const employee = employees.find(e => e.id === employeeId);
  const [cvText, setCvText] = useState(null);
  const [cvFilename, setCvFilename] = useState(null);
  const [hasCvFile, setHasCvFile] = useState(false);
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!employee?.candidate_id) return;
    fetch(`${window.API_BASE}/candidates/${employee.candidate_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setCvText(data.cv_text || null);
        setCvFilename(data.cv_filename || null);
        setHasCvFile(data.has_cv_file || false);
      })
      .catch(() => {});
  }, [employee?.candidate_id]);

  const refreshEmployee = () => {
    fetch(`${window.API_BASE}/employees`)
      .then(r => r.ok ? r.json() : [])
      .then(data => onEmployeesUpdated(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const downloadCv = async () => {
    if (hasCvFile) {
      const response = await fetch(`${window.API_BASE}/candidates/${employee.candidate_id}/cv`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = cvFilename || `${employee.first_name}_${employee.last_name}_cv`;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }
    }
    if (cvText) downloadText(cvText, cvFilename?.replace(/\.\w+$/, ".txt") || `${employee.first_name}_${employee.last_name}_cv.txt`);
  };

  if (!employee) return null;

  return (
    <div className="page page-wide">
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16, gap: 6 }} onClick={onBack}>
        <Icons.ChevronLeft size={14} />{t('employees.profile.back')}
      </button>

      {/* Header card */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
        <div className="row gap-16" style={{ alignItems: "center" }}>
          <Avatar name={`${employee.first_name} ${employee.last_name}`} size="lg" />
          <div className="col" style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{employee.first_name} {employee.last_name}</span>
            {employee.role_name && <span className="text-14 text-secondary">{employee.role_name}</span>}
            {employee.department && <span className="text-13 text-muted">{employee.department}</span>}
          </div>
          <div className="row gap-8" style={{ flexWrap: "wrap" }}>
            {cvText && <>
              <Btn icon={<Icons.Eye size={13} />} onClick={() => setCvModalOpen(true)}>{t('employees.profile.viewCv')}</Btn>
              <Btn icon={<Icons.Download size={13} />} onClick={downloadCv}>{t('employees.profile.downloadCv')}</Btn>
            </>}
            <Btn icon={<Icons.Edit size={13} />} onClick={() => setEditOpen(true)}>{t('common.edit')}</Btn>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="card" style={{ padding: "16px 24px", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px 24px" }}>
          {[
            [t('employees.form.email'), employee.email || "—"],
            [t('employees.form.dept'), employee.department || "—"],
            [t('employees.col.location'), employee.location || "—"],
            [t('employees.col.hireDate'), employee.hire_date || "—"],
            [t('employees.col.manager'), employee.manager || "—"],
            [t('employees.col.salary'), employee.salary ? (showSalary ? fmtSalary(employee.salary) + ` ${currencyCode}` : "••••") : "—"],
          ].map(([label, value]) => (
            <div key={label} className="col gap-2">
              <span className="text-11 text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
              <span className="text-13">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes + Reminder side-by-side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginBottom: 16 }}>
        <EmployeeNotesSection employeeId={employee.id} initialNotes={employee.notes} />
        <EmployeeReminderSection employeeId={employee.id} employee={employee} onEmployeeChanged={refreshEmployee} />
      </div>

      {/* Reviews inline */}
      <EmployeeReviewsSection employeeId={employee.id} />

      {/* Recruiting history — only when linked to original candidate */}
      {employee.candidate_id && <RecruitingHistorySection candidateId={employee.candidate_id} />}

      {/* CV viewer */}
      {cvModalOpen && cvText && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 700 }}
          onClick={() => setCvModalOpen(false)}>
          <div className="card col" style={{ width: "min(860px, 90vw)", maxHeight: "85vh", overflow: "hidden", padding: 0 }} onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span className="card-title">{cvFilename || "CV"} — {employee.first_name} {employee.last_name}</span>
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setCvModalOpen(false)}><Icons.X size={14} /></button>
            </div>
            <div style={{ padding: "20px 28px", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.75, whiteSpace: "pre-wrap", overflowY: "auto", color: "var(--ink-secondary)" }}>
              {cvText}
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <EmployeeEditModal t={t} employee={employee} employees={employees} onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setEditOpen(false);
            if (updated) onEmployeesUpdated(prev => prev.map(e => e.id === updated.id ? updated : e));
            else refreshEmployee();
          }} />
      )}
    </div>
  );
};

// ── Employee create / edit modals ─────────────────────────────────────────────

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
    const roles = window.CANDID_DATA?.ROLES || [];
    const role = roles.find(r => r.id === roleId);
    const body = { first_name: first, last_name: last, email: email || null, role_id: roleId || null, role_name: role?.name || null, department: dept || (role?.department || null), salary: salary ? parseFloat(salary) : null, currency: currencyCode, location: location || null };
    try { await fetch(`${window.API_BASE}/employees`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch {}
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

const EmployeeEditModal = ({ t, employee, employees = [], onClose, onSaved }) => {
  const [first, setFirst] = useState(employee.first_name || "");
  const [last, setLast] = useState(employee.last_name || "");
  const [email, setEmail] = useState(employee.email || "");
  const [roleId, setRoleId] = useState(employee.role_id || "");
  const [dept, setDept] = useState(employee.department || "");
  const [salary, setSalary] = useState(employee.salary ? String(employee.salary) : "");
  const [location, setLocation] = useState(employee.location || "");
  const [manager, setManager] = useState(employee.manager || "");
  const [hireDate, setHireDate] = useState(employee.hire_date || "");
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
      manager: manager || null, hire_date: hireDate || null,
    };
    try {
      const response = await fetch(`${window.API_BASE}/employees/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const updated = response.ok ? await response.json() : null;
      onSaved(updated);
    } catch { onSaved(null); }
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
          <label className="label">{t('employees.col.manager')}</label>
          <select className="select" value={manager} onChange={e => setManager(e.target.value)}>
            <option value="">—</option>
            {employees.filter(emp => emp.id !== employee.id).map(emp => {
              const fullName = `${emp.first_name} ${emp.last_name}`;
              return <option key={emp.id} value={fullName}>{fullName}</option>;
            })}
          </select>
        </div>
        <div><label className="label">{t('employees.col.hireDate')}</label><input className="input" type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} /></div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="label">{t('employees.form.salary')} <span className="text-11 text-muted">({currencyCode})</span></label>
          <input className="input" type="number" value={salary} onChange={e => setSalary(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────

const EmployeesScreen = () => {
  const t = window.useT();
  const [employees, setEmployees] = useState([]);
  const [showSalary, setShowSalary] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const reload = () => {
    fetch(`${window.API_BASE}/employees`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data)) {
          setEmployees(data);
          window.refreshCounts?.();
        }
      })
      .catch(() => {});
  };

  useEffect(reload, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const deleteEmployee = async (id) => {
    setEmployees(prev => prev.filter(employee => employee.id !== id));
    await fetch(`${window.API_BASE}/employees/${id}`, { method: "DELETE" }).catch(() => {});
    window.refreshCounts?.();
    setDeleteTarget(null);
    if (selectedEmployeeId === id) setSelectedEmployeeId(null);
  };

  const depts = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);
  const currencyCode = window.getCurrency ? window.getCurrency() : "EUR";
  const sym = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  const fmtSalary = (n) => n ? `${sym}${(n / 1000).toFixed(0)}k` : "—";
  const fmtBig = (n) => `${sym}${(n / 1000).toFixed(0)}k`;

  const filteredRows = useMemo(() => employees.filter(employee => {
    if (roleFilter && employee.role_id !== roleFilter) return false;
    if (deptFilter && employee.department !== deptFilter) return false;
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      if (!(`${employee.first_name} ${employee.last_name} ${employee.email || ""}`).toLowerCase().includes(queryLower)) return false;
    }
    return true;
  }), [employees, roleFilter, deptFilter, searchQuery]);

  const totalPayroll = filteredRows.reduce((sum, employee) => sum + (employee.salary || 0), 0);

  const openMenu = (event, employeeId) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(menuOpen === employeeId ? null : employeeId);
  };

  // Render full-page profile when employee selected
  if (selectedEmployeeId) {
    return (
      <EmployeeProfilePage
        employeeId={selectedEmployeeId}
        employees={employees}
        showSalary={showSalary}
        fmtSalary={fmtSalary}
        currencyCode={currencyCode}
        sym={sym}
        onBack={() => setSelectedEmployeeId(null)}
        onEmployeesUpdated={setEmployees}
      />
    );
  }

  return (
    <div className="page page-wide">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-h1">{t('employees.title')}</h1>
          <div className="page-sub">{filteredRows.length} of {employees.length} employees</div>
        </div>
        <div className="row gap-8">
          <Btn icon={showSalary ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />} onClick={() => setShowSalary(s => !s)}>
            {showSalary ? t('employees.hideSalary') : t('employees.showSalary')}
          </Btn>
          <Btn kind="primary" icon={<Icons.Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('employees.add')}</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{t('employees.kpi.headcount')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{filteredRows.length}</span>
        </div>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{t('employees.kpi.departments')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{depts.length}</span>
        </div>
        <div className="card card-pad col gap-4">
          <span className="text-12 text-muted">{showSalary ? t('employees.kpi.payroll') : t('employees.kpi.payrollHidden')}</span>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{showSalary ? fmtBig(totalPayroll) : "••••••"}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="row gap-6" style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", flex: "1 1 220px" }}>
          <Icons.Search size={14} style={{ color: "var(--ink-muted)" }} />
          <input className="input" style={{ border: 0, padding: "4px 0", background: "transparent" }} placeholder={t('employees.searchPh')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <RoleSelect value={roleFilter} onChange={setRoleFilter} placeholder={t('jobs.allRoles')} style={{ width: 220 }} />
        <select className="select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">{t('employees.allDepts')}</option>
          {depts.map(dept => <option key={dept} value={dept}>{dept}</option>)}
        </select>
        {(roleFilter || deptFilter || searchQuery) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setRoleFilter(""); setDeptFilter(""); setSearchQuery(""); }}>{t('common.clear')}</button>
        )}
      </div>

      {/* Table */}
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
            {filteredRows.map(employee => (
              <tr key={employee.id} style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
                onClick={() => setSelectedEmployeeId(employee.id)}
                onMouseEnter={ev => ev.currentTarget.style.background = "var(--surface-hover)"}
                onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                <EmpTd>
                  <div className="row gap-8">
                    <Avatar name={`${employee.first_name} ${employee.last_name}`} />
                    <div className="col">
                      <div className="row gap-6" style={{ alignItems: "center" }}>
                        <span className="weight-500">{employee.first_name} {employee.last_name}</span>
                        {employee.reminder_active && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "var(--warning-soft, #fef3c7)", color: "var(--warning, #d97706)", borderRadius: 4, padding: "1px 6px", fontSize: 10.5, fontWeight: 600 }}>
                            <Icons.Bell size={10} />{t('employees.reminder.badge')}
                          </span>
                        )}
                      </div>
                      {employee.email && <span className="text-12 text-muted">{employee.email}</span>}
                    </div>
                  </div>
                </EmpTd>
                <EmpTd><span className="text-13 text-secondary">{employee.role_name || "—"}</span></EmpTd>
                <EmpTd><Badge>{employee.department || "—"}</Badge></EmpTd>
                <EmpTd><span className="text-13 text-secondary">{employee.location || "—"}</span></EmpTd>
                <EmpTd><span className="text-mono text-12 text-muted">{employee.hire_date || "—"}</span></EmpTd>
                <EmpTd align="right">
                  {employee.salary
                    ? <span className="text-mono text-13 weight-500">{showSalary ? fmtSalary(employee.salary) : "••••"}</span>
                    : <span className="text-muted">—</span>}
                </EmpTd>
                <EmpTd>
                  <div onClick={ev => ev.stopPropagation()}>
                    <button className="icon-btn" onClick={e => openMenu(e, employee.id)}><Icons.MoreH size={14} /></button>
                  </div>
                </EmpTd>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--ink-muted)" }}>{t('employees.noMatch')}</div>
        )}
      </div>

      {/* Row action menu */}
      {menuOpen && (() => {
        const menuEmployee = employees.find(e => e.id === menuOpen);
        if (!menuEmployee) return null;
        return (
          <div style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 500, minWidth: 160 }} onMouseDown={e => e.stopPropagation()}>
            <div className="card col" style={{ padding: "4px 0", gap: 0 }}>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => { setEditTarget(menuEmployee); setMenuOpen(null); }}>
                <Icons.Edit size={13} /> {t('common.edit')}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
                onClick={() => { setDeleteTarget(menuEmployee); setMenuOpen(null); }}>
                <Icons.X size={13} /> {t('common.delete')}
              </button>
            </div>
          </div>
        );
      })()}

      {createOpen && <EmployeeModal t={t} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); reload(); }} />}
      {editTarget && <EmployeeEditModal t={t} employee={editTarget} employees={employees} onClose={() => setEditTarget(null)} onSaved={(updated) => { setEditTarget(null); if (updated) setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e)); else reload(); }} />}
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

window.EmployeesScreen = EmployeesScreen;
