// Live Interview Room — real Chrome/Edge Web Speech API, saves transcript to backend

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const LiveRoomScreen = ({ interview, onDone }) => {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [liveText, setLiveText] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState("Candidate");
  const [sttError, setSttError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);

  const recognitionRef = useRef(null);
  const shouldRunRef = useRef(false);
  const activeSpeakerRef = useRef("Candidate");
  const transcriptEndRef = useRef(null);

  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);

  // Timer
  useEffect(() => {
    if (!recording || paused) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording, paused]);

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, liveText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, []);

  const buildRecognition = () => {
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";

    r.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (!text) continue;
          const speaker = activeSpeakerRef.current;
          const who = speaker === "Interviewer"
            ? (interview?.interviewer || "Interviewer")
            : (interview?.candidateName || "Candidate");
          setBubbles(prev => [...prev, {
            speaker, who,
            t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            text,
          }]);
          setLiveText("");
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (interim) setLiveText(interim);
    };

    r.onend = () => {
      setLiveText("");
      if (shouldRunRef.current) {
        setTimeout(() => {
          if (shouldRunRef.current) {
            try { r.start(); } catch {}
          }
        }, 150);
      }
    };

    r.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted" || event.error === "network") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSttError("Microphone access denied. Enable it in browser settings and reload.");
        shouldRunRef.current = false;
        setRecording(false);
        setPaused(false);
      }
    };

    return r;
  };

  const start = () => {
    if (!SpeechRecognition) {
      setSttError("Web Speech API not available. Use Chrome or Edge.");
      return;
    }
    setSttError(null);
    setSaved(false);
    const r = buildRecognition();
    recognitionRef.current = r;
    shouldRunRef.current = true;
    try { r.start(); } catch {}
    setRecording(true);
    setPaused(false);
  };

  const pause = () => {
    if (paused) {
      shouldRunRef.current = true;
      setPaused(false);
      try { recognitionRef.current?.start(); } catch {}
    } else {
      shouldRunRef.current = false;
      setPaused(true);
      setLiveText("");
      try { recognitionRef.current?.stop(); } catch {}
    }
  };

  const buildTranscriptText = (lines) =>
    lines.map(b => `[${b.t}] ${b.who}: ${b.text}`).join("\n");

  const stopAndSave = async () => {
    shouldRunRef.current = false;
    setRecording(false);
    setPaused(false);
    setLiveText("");
    try { recognitionRef.current?.stop(); } catch {}

    if (!interview?.id || bubbles.length === 0) return;
    setSaving(true);
    setProcessError(null);
    const rawContent = buildTranscriptText(bubbles);
    try {
      await fetch(`${window.API_BASE}/interviews/${interview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_content: rawContent }),
      });
      setSaved(true);
      setSaving(false);
      setProcessing(true);
      try {
        await fetch(`${window.API_BASE}/interviews/${interview.id}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_content: rawContent }),
        });
      } catch {
        setProcessError("AI processing failed — transcript saved, you can retry from the interview detail.");
      }
      setProcessing(false);
    } catch {
      setSttError("Failed to save transcript to server.");
      setSaving(false);
    }
  };

  const reset = () => {
    shouldRunRef.current = false;
    try { recognitionRef.current?.abort(); } catch {}
    setRecording(false);
    setPaused(false);
    setElapsed(0);
    setBubbles([]);
    setLiveText("");
    setSttError(null);
    setSaved(false);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const candidateName = interview?.candidateName || "Candidate";
  const interviewerName = interview?.interviewer || "Interviewer";
  const interviewTitle = interview?.title || interview?.type || "Interview";

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="col gap-4">
          <div className="row gap-8" style={{ alignItems: "center" }}>
            <Icons.Mic size={16} />
            <span style={{ fontWeight: 600, fontSize: 18 }}>{interviewTitle}</span>
            {recording && <Badge kind="danger"><span className="rec-dot" /> REC {fmt(elapsed)}</Badge>}
            {saved && <Badge kind="positive">Transcript saved</Badge>}
          </div>
          <span className="text-13 text-secondary">{candidateName} · with {interviewerName}</span>
        </div>
        <Btn onClick={onDone}>← Back to Interviews</Btn>
      </div>

      {!SpeechRecognition && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "oklch(0.97 0.04 85)", border: "1px solid oklch(0.82 0.12 85)", marginBottom: 16, fontSize: 13 }}>
          Web Speech API requires Chrome or Edge.
        </div>
      )}
      {sttError && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "var(--danger-soft)", border: "1px solid var(--danger)", marginBottom: 16, fontSize: 13, color: "var(--danger)" }}>
          {sttError}
        </div>
      )}

      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        {/* Controls */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div className="row gap-8">
            {!recording ? (
              <Btn kind="primary" onClick={start} icon={<Icons.Mic size={14} />} disabled={!SpeechRecognition || saving}>
                Start recording
              </Btn>
            ) : (
              <>
                <Btn kind="secondary" onClick={pause} icon={paused ? <Icons.Play size={12} /> : <Icons.Pause size={12} />}>
                  {paused ? "Resume" : "Pause"}
                </Btn>
                <Btn kind="danger" onClick={stopAndSave} icon={<Icons.Square size={12} />} disabled={saving}>
                  {saving ? "Saving…" : "Stop & save"}
                </Btn>
              </>
            )}
            {!recording && bubbles.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={reset}>Reset</button>
            )}
          </div>

          {/* Speaker toggle */}
          {recording && !paused && (
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <span className="text-12 text-muted">Now speaking:</span>
              <button
                onClick={() => setActiveSpeaker(s => s === "Candidate" ? "Interviewer" : "Candidate")}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 20,
                  border: "2px solid var(--accent)", background: "var(--accent-subtle)",
                  cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                }}
              >
                <span className="rec-dot" style={{ width: 6, height: 6 }} />
                {activeSpeaker === "Candidate" ? candidateName : interviewerName}
              </button>
              <span className="text-11 text-muted">click to switch</span>
            </div>
          )}

          <div className="wave" style={{ opacity: recording && !paused ? 1 : 0.2 }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.06}s`, animationPlayState: recording && !paused ? "running" : "paused" }} />
            ))}
          </div>
        </div>

        {/* Transcript */}
        <div className="scroll" style={{ padding: "20px 24px", maxHeight: 520 }}>
          {bubbles.length === 0 && !liveText && (
            <div style={{ textAlign: "center", padding: 48, color: "var(--ink-muted)" }}>
              <Icons.Mic size={24} style={{ marginBottom: 8 }} />
              <div className="weight-500" style={{ color: "var(--ink-secondary)" }}>Press start when ready.</div>
              <div className="text-12" style={{ marginTop: 6 }}>Words appear here in real time. Tap the speaker button to switch between candidate and interviewer.</div>
            </div>
          )}
          {bubbles.map((b, i) => <TranscriptBubble key={i} {...b} />)}
          {liveText && (
            <TranscriptBubble
              speaker={activeSpeaker}
              who={activeSpeaker === "Candidate" ? candidateName : interviewerName}
              t={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              text={liveText}
              live
            />
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {saved && (
        <div className="card card-pad row gap-12" style={{ alignItems: "center" }}>
          {processing
            ? <span className="badge ai" style={{ padding: "4px 10px" }}><span className="dot" /> Analyzing…</span>
            : <Icons.Check size={16} style={{ color: "var(--positive)" }} />
          }
          <div className="col" style={{ flex: 1 }}>
            <span className="weight-500">{processing ? "Cleaning up and summarizing transcript…" : "Interview processed"}</span>
            <span className="text-12 text-muted">
              {processing
                ? "AI is correcting names and generating a summary. This may take a few seconds."
                : `${bubbles.length} lines · ${fmt(elapsed)} recorded.`
              }
            </span>
            {processError && <span className="text-12" style={{ color: "var(--danger)", marginTop: 4 }}>{processError}</span>}
          </div>
          {!processing && <Btn kind="primary" onClick={onDone}>Back to Interviews</Btn>}
        </div>
      )}
    </div>
  );
};

const TranscriptBubble = ({ speaker, who, t, text, live }) => (
  <div className={`bubble ${speaker.toLowerCase()} ${live ? "live" : ""}`}>
    {speaker === "Interviewer" && <Avatar name={who} />}
    <div className="col" style={{ maxWidth: "70%" }}>
      <div className="meta">
        <span>{who}</span>
        <span>·</span>
        <span>{t}</span>
        {live && <span style={{ color: "var(--ai)" }}>● live</span>}
      </div>
      <div className="body">{text}{live && <span className="caret"></span>}</div>
    </div>
    {speaker === "Candidate" && <Avatar name={who} />}
  </div>
);

window.LiveRoomScreen = LiveRoomScreen;
