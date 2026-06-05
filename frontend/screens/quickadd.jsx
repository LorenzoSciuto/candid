// Quick-Add modal — upload a CV or paste text, AI extracts candidate info

// Defined outside QuickAdd so React sees a stable component type across renders.
// If defined inside, every render creates a new function → React remounts the input → focus lost.
const QuickAddField = ({ label, fieldKey, type = "text", parsed, onParsedChange }) => (
  <div>
    <label className="label">{label}</label>
    <input
      className="input"
      type={type}
      value={parsed?.[fieldKey] ?? ""}
      onChange={e => onParsedChange(p => ({ ...p, [fieldKey]: e.target.value }))}
    />
  </div>
);

const QuickAdd = ({ open, onClose, onCreate, tweaks }) => {
  const t = window.useT();
  const [text, setText] = useState("");
  const [cvName, setCvName] = useState("");
  const [stage, setStage] = useState("idle"); // idle | uploading | parsing | parsed
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const uploadedFileRef = useRef(null); // original file for re-upload after candidate creation

  const reset = () => { setText(""); setCvName(""); setStage("idle"); setParsed(null); setError(""); uploadedFileRef.current = null; };
  const close = () => { reset(); onClose(); };

  // ── CV upload ─────────────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setStage("uploading");
    setCvName(file.name);
    setText("");
    uploadedFileRef.current = file;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${window.API_BASE}/upload-cv`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setText(data.text);
      await runParse(data.text);
    } catch (err) {
      setError(`${t('quickadd.uploading')} ${err.message}`);
      setStage("idle");
    }
  };

  const handleDropzoneClick = () => fileInputRef.current?.click();
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInputRef.current.files = dt.files;
    handleFileChange({ target: fileInputRef.current });
  };

  const clearFile = () => { setCvName(""); setText(""); reset(); if (fileInputRef.current) fileInputRef.current.value = ""; };

  // ── Parse ─────────────────────────────────────────────────────────────────────
  const runParse = async (rawText) => {
    const src = rawText ?? text;
    if (!src.trim()) return;
    setError("");
    setStage("parsing");
    setParsed(null);
    try {
      const res = await fetch(`${window.API_BASE}/quick-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: src }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (tweaks.streaming) {
        const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
        let i = 0;
        const tick = () => {
          if (i >= entries.length) { setStage("parsed"); return; }
          const [k, v] = entries[i++];
          setParsed(p => ({ ...(p || {}), [k]: v }));
          setTimeout(tick, 200);
        };
        setParsed({});
        setTimeout(tick, 300);
      } else {
        setParsed(data);
        setStage("parsed");
      }
    } catch (err) {
      setError(`AI error: ${err.message}`);
      setStage("idle");
    }
  };

  // ── Create candidate ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const body = {
      first_name: parsed?.first_name || "Unknown",
      last_name: parsed?.last_name || "",
      email: parsed?.email || null,
      phone: parsed?.phone || null,
      current_role: parsed?.current_role || null,
      years_of_experience: parsed?.years_of_experience ? parseInt(parsed.years_of_experience, 10) || null : null,
      location: parsed?.location || null,
      source: parsed?.source || (cvName ? "CV Upload" : "Quick Add"),
      cv_text: text || null,
      cv_filename: cvName || null,
      status: "new",
    };
    try {
      const res = await fetch(`${window.API_BASE}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json();
        if (uploadedFileRef.current && created.id) {
          const fd = new FormData();
          fd.append("file", uploadedFileRef.current);
          fd.append("candidate_id", created.id);
          fetch(`${window.API_BASE}/upload-cv`, { method: "POST", body: fd }).catch(() => {});
        }
        onCreate && onCreate(created.id);
        close();
        return;
      }
    } catch {}
    close();
  };

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const statusLabel = stage === "uploading" ? t('quickadd.uploading')
    : stage === "parsing" ? t('quickadd.parsing')
    : `${wordCount} ${t('quickadd.wordsExtracted')}`;

  return (
    <Modal open={open} onClose={close} title={t('quickadd.title')} width={700}
      footer={
        <>
          <span className="text-12 text-muted">{t('quickadd.hint')}</span>
          <div className="row gap-8">
            <Btn onClick={close}>{t('common.cancel')}</Btn>
            {stage === "parsed" ? (
              <Btn kind="primary" icon={<Icons.UserCheck size={14} />} onClick={handleCreate}>{t('quickadd.create')}</Btn>
            ) : (
              <Btn kind="ai" icon={<Icons.Sparkles size={14} />}
                disabled={!text.trim() || stage === "parsing" || stage === "uploading"}
                onClick={() => runParse()}>
                {stage === "parsing" ? t('quickadd.parsing') : stage === "uploading" ? t('quickadd.uploading') : t('quickadd.extract')}
              </Btn>
            )}
          </div>
        </>
      }>
      <div className="col gap-12">
        {/* CV Upload */}
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{ display: "none" }} onChange={handleFileChange} />
        {!cvName ? (
          <div className="dropzone" onClick={handleDropzoneClick} onDragOver={e => e.preventDefault()} onDrop={handleDrop}
            style={{ padding: "16px 20px" }}>
            <Icons.Upload size={18} style={{ color: "var(--ink-muted)", marginBottom: 6 }} />
            <div className="weight-500 text-13">{t('quickadd.drop')}</div>
            <div className="text-12 text-muted mt-2">{t('quickadd.dropSub')}</div>
          </div>
        ) : (
          <div className="dropzone has-file row" style={{ alignItems: "center", gap: 12, padding: "12px 16px" }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-sunken)", display: "grid", placeItems: "center" }}>
              <Icons.FileText size={14} />
            </div>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <span className="weight-500 text-13">{cvName}</span>
              <span className="text-12 text-muted">{statusLabel}</span>
            </div>
            <button className="icon-btn" onClick={clearFile}><Icons.X size={13} /></button>
          </div>
        )}

        {/* Paste text */}
        <div>
          <label className="label">{t('quickadd.paste')}</label>
          <textarea className="textarea" rows={5}
            placeholder={t('quickadd.pastePlaceholder')}
            value={text}
            onChange={e => { setText(e.target.value); if (cvName) { setCvName(""); if (fileInputRef.current) fileInputRef.current.value = ""; } }}
          />
        </div>

        {error && <div className="text-12" style={{ color: "var(--danger)" }}>{error}</div>}

        {/* Extracted form */}
        {parsed && (
          <div className="ai-panel" style={{ padding: 16 }}>
            <div className="row gap-6" style={{ marginBottom: 14 }}>
              <span className="ai-tag" style={{ display: "inline-flex" }}><Icons.Sparkles size={11} /> {t('quickadd.extracted')}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <QuickAddField label={t('quickadd.field.firstName')} fieldKey="first_name" parsed={parsed} onParsedChange={setParsed} />
              <QuickAddField label={t('quickadd.field.lastName')} fieldKey="last_name" parsed={parsed} onParsedChange={setParsed} />
              <QuickAddField label={t('quickadd.field.email')} fieldKey="email" type="email" parsed={parsed} onParsedChange={setParsed} />
              <QuickAddField label={t('quickadd.field.phone')} fieldKey="phone" type="tel" parsed={parsed} onParsedChange={setParsed} />
              <QuickAddField label={t('quickadd.field.role')} fieldKey="current_role" parsed={parsed} onParsedChange={setParsed} />
              <QuickAddField label={t('quickadd.field.experience')} fieldKey="years_of_experience" type="number" parsed={parsed} onParsedChange={setParsed} />
              <QuickAddField label={t('quickadd.field.location')} fieldKey="location" parsed={parsed} onParsedChange={setParsed} />
              <QuickAddField label={t('quickadd.field.source')} fieldKey="source" parsed={parsed} onParsedChange={setParsed} />
            </div>
            {parsed.summary && (
              <div style={{ marginTop: 10 }}>
                <label className="label">{t('quickadd.field.notes')}</label>
                <textarea className="textarea" rows={2} value={parsed.summary ?? ""}
                  onChange={e => setParsed(p => ({ ...p, summary: e.target.value }))} />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

window.QuickAdd = QuickAdd;
