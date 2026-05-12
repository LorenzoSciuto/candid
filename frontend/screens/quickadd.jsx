// Quick-Add modal — upload a CV or paste text, AI extracts candidate info
const QuickAdd = ({ open, onClose, onCreate, tweaks }) => {
  const [text, setText] = useState("");
  const [cvName, setCvName] = useState("");
  const [stage, setStage] = useState("idle"); // idle | uploading | parsing | parsed
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const reset = () => { setText(""); setCvName(""); setStage("idle"); setParsed(null); setError(""); };
  const close = () => { reset(); onClose(); };

  // ── CV upload ─────────────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setStage("uploading");
    setCvName(file.name);
    setText("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${window.API_BASE}/upload-cv`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setText(data.text);
      await runParse(data.text);
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
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

  // ── Editable form fields ──────────────────────────────────────────────────────
  const Field = ({ label, fieldKey, type = "text" }) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={parsed?.[fieldKey] ?? ""}
        onChange={e => setParsed(p => ({ ...p, [fieldKey]: e.target.value }))}
      />
    </div>
  );

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
      extra_information: parsed?.summary || null,
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
        onCreate && onCreate(created.id);
        close();
        return;
      }
    } catch {}
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Quick add candidate" width={700}
      footer={
        <>
          <span className="text-12 text-muted">Upload a CV or paste notes — AI extracts the rest.</span>
          <div className="row gap-8">
            <Btn onClick={close}>Cancel</Btn>
            {stage === "parsed" ? (
              <Btn kind="primary" icon={<Icons.UserCheck size={14} />} onClick={handleCreate}>Create candidate</Btn>
            ) : (
              <Btn kind="ai" icon={<Icons.Sparkles size={14} />}
                disabled={!text.trim() || stage === "parsing" || stage === "uploading"}
                onClick={() => runParse()}>
                {stage === "parsing" ? "Parsing…" : stage === "uploading" ? "Uploading…" : "Extract with AI"}
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
            <div className="weight-500 text-13">Drop a PDF or DOCX, or click to browse</div>
            <div className="text-12 text-muted mt-2">CV text extracted automatically</div>
          </div>
        ) : (
          <div className="dropzone has-file row" style={{ alignItems: "center", gap: 12, padding: "12px 16px" }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-sunken)", display: "grid", placeItems: "center" }}>
              <Icons.FileText size={14} />
            </div>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <span className="weight-500 text-13">{cvName}</span>
              <span className="text-12 text-muted">
                {stage === "uploading" ? "Uploading…" : stage === "parsing" ? "Parsing…" : `${text.split(/\s+/).filter(Boolean).length} words extracted`}
              </span>
            </div>
            <button className="icon-btn" onClick={clearFile}><Icons.X size={13} /></button>
          </div>
        )}

        {/* Paste text */}
        <div>
          <label className="label">Or paste notes / message / email</label>
          <textarea className="textarea" rows={5}
            placeholder="Notes from call, LinkedIn message, interview summary…"
            value={text}
            onChange={e => { setText(e.target.value); if (cvName) { setCvName(""); if (fileInputRef.current) fileInputRef.current.value = ""; } }}
          />
        </div>

        {error && <div className="text-12" style={{ color: "var(--danger)" }}>{error}</div>}

        {/* Extracted form */}
        {parsed && (
          <div className="ai-panel" style={{ padding: 16 }}>
            <div className="row gap-6" style={{ marginBottom: 14 }}>
              <span className="ai-tag" style={{ display: "inline-flex" }}><Icons.Sparkles size={11} /> Extracted — review &amp; edit</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="First name" fieldKey="first_name" />
              <Field label="Last name" fieldKey="last_name" />
              <Field label="Email" fieldKey="email" type="email" />
              <Field label="Phone" fieldKey="phone" type="tel" />
              <Field label="Current role / company" fieldKey="current_role" />
              <Field label="Years of experience" fieldKey="years_of_experience" type="number" />
              <Field label="Location" fieldKey="location" />
              <Field label="Source" fieldKey="source" />
            </div>
            {parsed.summary && (
              <div style={{ marginTop: 10 }}>
                <label className="label">Notes / summary</label>
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
