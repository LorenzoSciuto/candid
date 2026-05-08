// Quick-Add modal — paste raw text, AI auto-creates a candidate
const QuickAdd = ({ open, onClose, onCreate, tweaks }) => {
  const [text, setText] = useState("");
  const [stage, setStage] = useState("idle"); // idle | parsing | parsed
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");

  const sample = `Notes from intro call w/ Tomás — May 7
Currently at Vercel, 5y exp, looking for senior FE role. Strong on edge / streaming.
Ping back next week.
tomas.r@me.com / +1 (917) 555 0190`;

  const MOCK_FIELDS = [
    { k: "first_name", v: "Tomás" },
    { k: "last_name", v: "Rivera" },
    { k: "email", v: "tomas.r@me.com" },
    { k: "phone", v: "+1 (917) 555-0190" },
    { k: "current_role", v: "Senior Frontend Engineer @ Vercel" },
    { k: "years_of_experience", v: 5 },
    { k: "summary", v: "Strong on edge / streaming. Ping back next week." },
  ];

  const reset = () => { setText(""); setStage("idle"); setParsed(null); setError(""); };
  const close = () => { reset(); onClose(); };

  // Stream parsed fields into view one by one
  const animateFields = (fields) => {
    let i = 0;
    const tick = () => {
      if (i >= fields.length) { setStage("parsed"); return; }
      const { k, v } = fields[i++];
      setParsed(p => ({ ...(p || {}), [k]: v }));
      setTimeout(tick, 220);
    };
    setParsed({});
    setTimeout(tick, 300);
  };

  const run = async () => {
    setError("");
    setStage("parsing");

    let fields = null;
    try {
      const res = await fetch(`${window.API_BASE}/quick-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Normalise to array of {k, v}
      fields = Object.entries(data)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => ({ k, v }));
    } catch {
      // Fall back to mock
      fields = MOCK_FIELDS;
    }

    if (tweaks.streaming) {
      animateFields(fields);
    } else {
      const obj = {};
      fields.forEach(({ k, v }) => { obj[k] = v; });
      setParsed(obj);
      setStage("parsed");
    }
  };

  // Create candidate from parsed data via API
  const handleCreate = async () => {
    if (parsed) {
      try {
        const body = {
          first_name: parsed.first_name || "Unknown",
          last_name: parsed.last_name || "",
          email: parsed.email || null,
          phone: parsed.phone || null,
          current_role: parsed.current_role || null,
          years_of_experience: parsed.years_of_experience
            ? parseInt(parsed.years_of_experience, 10) || null
            : null,
          status: "new",
          source: "Quick Add",
        };
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
      } catch {
        // fall through to mock
      }
    }
    onCreate && onCreate("c-004");
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Quick add — paste anything" width={680}
      footer={
        <>
          <span className="text-12 text-muted">Paste a message, notes, or a CV. AI will structure it.</span>
          <div className="row gap-8">
            <Btn onClick={close}>Cancel</Btn>
            {stage === "parsed" ? (
              <Btn kind="primary" icon={<Icons.ArrowRight size={14} />} onClick={handleCreate}>Create candidate</Btn>
            ) : (
              <Btn kind="ai" icon={<Icons.Sparkles size={14} />} disabled={!text || stage === "parsing"} onClick={run}>
                {stage === "parsing" ? "Parsing…" : "Auto-structure"}
              </Btn>
            )}
          </div>
        </>
      }>
      <div className="col gap-12">
        <textarea className="textarea" rows={8} placeholder="Paste interview notes, an email, an outreach DM…" value={text} onChange={e => setText(e.target.value)} />
        {!text && (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setText(sample)}>
            <Icons.ClipPaste size={12} /> Use a sample
          </button>
        )}
        {error && <div className="text-12" style={{ color: "var(--danger)" }}>{error}</div>}
        {parsed && (
          <div className="ai-panel" style={{ padding: 14 }}>
            <span className="ai-tag" style={{ display: "inline-flex", marginBottom: 10 }}>
              <Icons.Sparkles size={11} /> Extracted fields
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px" }}>
              {Object.entries(parsed).map(([k, v]) => (
                <React.Fragment key={k}>
                  <span className="text-12 text-mono text-muted" style={{ alignSelf: "center" }}>{k}</span>
                  <span className="text-13">{String(v)}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

window.QuickAdd = QuickAdd;
