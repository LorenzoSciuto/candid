// Pre-Interview CV Analysis screen
const { JD_DEFAULT, SAMPLE_CV, STREAMING_PRE } = window.CANDID_DATA;

const PreInterviewScreen = ({ tweaks, onCreatedCandidate }) => {
  const [openJds, setOpenJds] = useState([]);
  const [selectedJdId, setSelectedJdId] = useState("");
  const [position, setPosition] = useState("Senior Frontend Engineer — Platform");
  const [jd, setJd] = useState(JD_DEFAULT);

  useEffect(() => {
    fetch(`${window.API_BASE}/job-descriptions`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d)) {
          const active = d.filter(j => j.status === "Active");
          setOpenJds(active);
          if (active.length > 0 && !selectedJdId) {
            setSelectedJdId(active[0].id);
            setPosition(active[0].title);
            if (active[0].description) setJd(active[0].description);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleJdSelect = (id) => {
    setSelectedJdId(id);
    const found = openJds.find(j => j.id === id);
    if (found) {
      setPosition(found.title);
      if (found.description) setJd(found.description);
    }
  };
  const [cvName, setCvName] = useState("");
  const [cvText, setCvText] = useState("");
  const [stage, setStage] = useState("idle"); // idle | uploading | extracting | analyzing | done
  const [streamed, setStreamed] = useState({ strengths: [], weaknesses: [], questions: [] });
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // ── Upload: try real API, fall back to sample data ──────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setStage("uploading");
    setCvName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${window.API_BASE}/upload-cv`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCvText(data.text);
      setStage("idle");
    } catch (err) {
      // API unreachable — use sample data so the UI stays functional
      setCvText(SAMPLE_CV);
      setStage("idle");
    }
  };

  // Click-to-browse dropzone
  const handleDropzoneClick = () => fileInputRef.current?.click();

  // Drag-and-drop
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInputRef.current.files = dt.files;
    handleFileChange({ target: fileInputRef.current });
  };

  // ── Analysis: try real API, fall back to simulated ──────────────────────────
  const runAnalysis = async () => {
    setError("");
    setStage("analyzing");
    setStreamed({ strengths: [], weaknesses: [], questions: [] });

    let result = null;
    try {
      const res = await fetch(`${window.API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_title: position,
          job_description: jd,
          cv_text: cvText,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      result = await res.json();
    } catch (err) {
      // Fall back to canned data
      result = {
        strengths: STREAMING_PRE.strengths,
        weaknesses: STREAMING_PRE.weaknesses,
        questions: STREAMING_PRE.questions,
        extracted: STREAMING_PRE.extracted,
      };
    }

    // Animate display regardless of data source
    if (tweaks.streaming) {
      const items = [
        ...result.strengths.map(t => ["strengths", t]),
        ...result.weaknesses.map(t => ["weaknesses", t]),
        ...(result.questions || []).map(t => ["questions", t]),
      ];
      let i = 0;
      const tick = () => {
        if (i >= items.length) { setStage("done"); return; }
        const [k, t] = items[i++];
        setStreamed(s => ({ ...s, [k]: [...s[k], t] }));
        setTimeout(tick, 380);
      };
      setTimeout(tick, 400);
    } else {
      setStreamed({
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        questions: result.questions || [],
      });
      setStage("done");
    }
  };

  const reset = () => {
    setStage("idle");
    setStreamed({ strengths: [], weaknesses: [], questions: [] });
    setError("");
  };

  return (
    <div className="page">
      <div className="row" style={{ alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span className="ai-tag"><span className="ai-spark" /> Pre-Interview Analysis</span>
      </div>
      <h1 className="page-h1">Read the CV before you read the CV.</h1>
      <div className="page-sub">Drop a CV, paste the JD, and get strengths, gaps, and three deep-dive questions ready before the call.</div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)", gap: 24, alignItems: "start" }}>
        {/* LEFT — inputs */}
        <div className="col gap-16">
          <div className="card card-pad col gap-12">
            <div>
              <label className="label">Open position</label>
              {openJds.length > 0 ? (
                <select className="select" value={selectedJdId} onChange={e => handleJdSelect(e.target.value)}>
                  {openJds.map(j => <option key={j.id} value={j.id}>{j.title}{j.location ? ` · ${j.location}` : ""}</option>)}
                </select>
              ) : (
                <input className="input" value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
              )}
            </div>
            <div>
              <label className="label">Job description</label>
              <textarea className="textarea" rows={9} value={jd} onChange={e => setJd(e.target.value)} />
              <div className="help">Used as the comparison reference. Edit freely.</div>
            </div>
          </div>

          <div className="card card-pad col gap-12">
            <label className="label">Candidate CV</label>
            {/* Hidden real file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            {!cvName ? (
              <div
                className="dropzone"
                onClick={handleDropzoneClick}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                <Icons.Upload size={20} style={{ color: "var(--ink-muted)", marginBottom: 8 }} />
                <div className="weight-500">Drop a PDF or DOCX, or click to browse</div>
                <div className="text-12 text-muted mt-4">Up to 10 MB · text is extracted on the server</div>
              </div>
            ) : (
              <div className="dropzone has-file row" style={{ alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--bg-sunken)", display: "grid", placeItems: "center" }}>
                  <Icons.FileText size={16} />
                </div>
                <div className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span className="weight-500">{cvName}</span>
                  <span className="text-12 text-muted">
                    {stage === "uploading" ? "Uploading…" : stage === "extracting" ? "Extracting text…" : `${cvText.split(/\s+/).length} words extracted`}
                  </span>
                </div>
                <button className="icon-btn" onClick={() => { setCvName(""); setCvText(""); reset(); fileInputRef.current.value = ""; }}><Icons.X size={14} /></button>
              </div>
            )}

            {error && <div className="text-12" style={{ color: "var(--danger)" }}>{error}</div>}

            <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
              <span className="text-12 text-muted">{tweaks.streaming ? "Streaming" : "Instant"} · GPT-4o</span>
              <Btn kind="ai" disabled={!cvName || stage === "analyzing" || stage === "uploading" || stage === "extracting"} onClick={runAnalysis} icon={<Icons.Sparkles size={14} />}>
                {stage === "analyzing" ? "Analyzing…" : stage === "done" ? "Re-run analysis" : "Run AI analysis"}
              </Btn>
            </div>
          </div>
        </div>

        {/* RIGHT — output */}
        <div className="col gap-16">
          {stage === "idle" && !streamed.strengths.length && (
            <div className="ai-panel" style={{ padding: 32, textAlign: "center" }}>
              <div className="ai-tag" style={{ display: "inline-flex", marginBottom: 12 }}><Icons.Sparkles size={11} /> Ready</div>
              <div className="weight-600 text-15">Upload a CV to begin</div>
              <div className="text-13 text-secondary mt-4" style={{ maxWidth: 380, margin: "4px auto 0" }}>
                Candid will compare it to your JD and surface 3–5 strengths, gaps, and tailored questions.
              </div>
            </div>
          )}

          {stage === "analyzing" && !tweaks.streaming && <AnalyzingPanel />}

          {(stage === "analyzing" && tweaks.streaming) || stage === "done" ? (
            <ResultPanels data={streamed} streaming={stage === "analyzing" && tweaks.streaming} />
          ) : null}

          {stage === "done" && (
            <div className="card card-pad row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="col">
                <span className="weight-500">Create candidate from this analysis</span>
                <span className="text-12 text-muted">Auto-fills name, email, role · keeps the analysis attached.</span>
              </div>
              <Btn kind="primary" icon={<Icons.ArrowRight size={14} />} onClick={() => onCreatedCandidate && onCreatedCandidate("c-001")}>Create & open</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AnalyzingPanel = () => (
  <div className="ai-panel card-pad col gap-12">
    <div className="row gap-8"><span className="ai-spark" /><span className="weight-500 text-13">Analyzing CV against JD…</span></div>
    {["Extracting candidate info", "Comparing skills to JD", "Drafting deep-dive questions"].map((s, i) => (
      <div key={i} className="row gap-8" style={{ height: 14 }}>
        <div className="shimmer" style={{ height: 10, width: `${65 + i * 10}%`, background: "var(--bg-sunken)", borderRadius: 4 }} />
      </div>
    ))}
    <span className="text-12 text-muted">Typically 5–10 seconds</span>
  </div>
);

const ResultPanels = ({ data, streaming }) => (
  <div className="col gap-12">
    <ResultBlock title="Strengths" hint="Top matches against the JD" kind="positive" items={data.strengths} icon={<Icons.Check size={12} />} streaming={streaming} />
    <ResultBlock title="Weaknesses" hint="Gaps and risks to probe" kind="warn" items={data.weaknesses} icon={<Icons.X size={12} />} streaming={streaming} />
    <ResultBlock title="Suggested deep-dive questions" hint="Tailored to uncover real expertise" kind="ai" items={data.questions} icon={<Icons.Sparkles size={11} />} streaming={streaming} />
  </div>
);

const ResultBlock = ({ title, hint, kind, items, icon, streaming }) => (
  <div className="card">
    <div className="card-header">
      <div className="col">
        <span className="card-title">{title}</span>
        <span className="card-sub">{hint}</span>
      </div>
      <Badge kind={kind}>{items.length} {items.length === 1 ? "item" : "items"}</Badge>
    </div>
    <div style={{ padding: 14 }}>
      <ul className={`ai-list ${kind === "positive" ? "strengths" : kind === "warn" ? "weaknesses" : "questions"}`}>
        {items.map((t, i) => (
          <li key={i}>
            <span className="marker">{kind === "ai" ? i + 1 : icon}</span>
            <span className={streaming && i === items.length - 1 ? "caret" : ""}>{t}</span>
          </li>
        ))}
        {streaming && items.length === 0 && (
          <li style={{ opacity: 0.6 }}><span className="marker shimmer" style={{ background: "var(--bg-sunken)" }}></span><span className="text-muted">Generating…</span></li>
        )}
      </ul>
    </div>
  </div>
);

window.PreInterviewScreen = PreInterviewScreen;
