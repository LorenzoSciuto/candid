// Live Interview Room — real Chrome/Edge Web Speech API

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const LiveRoomScreen = ({ tweaks, interview }) => {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [liveText, setLiveText] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState("Candidate");
  const [sttError, setSttError] = useState(null);

  const recognitionRef = useRef(null);
  const shouldRunRef = useRef(false);
  const activeSpeakerRef = useRef("Candidate");
  const transcriptEndRef = useRef(null);

  // Keep ref in sync with state for use inside STT callbacks
  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);

  // Timer
  useEffect(() => {
    if (!recording || paused) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording, paused]);

  // Auto-scroll transcript
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
            ? (window.getTeamMembers?.()[0]?.name || "Interviewer")
            : "Candidate";
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

    // Auto-restart to support recordings longer than Chrome's internal timeout
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
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "network") return; // onend will retry
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
      // Set shouldRunRef false BEFORE stop() so onend doesn't restart
      shouldRunRef.current = false;
      setPaused(true);
      setLiveText("");
      try { recognitionRef.current?.stop(); } catch {}
    }
  };

  const stop = () => {
    shouldRunRef.current = false;
    setRecording(false);
    setPaused(false);
    setLiveText("");
    try { recognitionRef.current?.stop(); } catch {}
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
  };

  const toggleSpeaker = () => setActiveSpeaker(s => s === "Candidate" ? "Interviewer" : "Candidate");

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const team = window.getTeamMembers?.() || [];
  const interviewerName = interview?.interviewer || team[0]?.name || "Interviewer";
  const candidateName = interview?.candidateName || "Unknown Candidate";
  const interviewTitle = interview?.title || interview?.type || "Interview";

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="row gap-8">
          <span className="ai-tag"><span className="ai-spark" /> Live Room</span>
          {recording && <Badge kind="danger"><span className="rec-dot" />REC {fmt(elapsed)}</Badge>}
        </div>
        <div className="row gap-8">
          <Avatar name={candidateName} />
          <div className="col">
            <span className="text-13 weight-500">{candidateName} · {interviewTitle}</span>
            <span className="text-12 text-muted">
              {interview?.type || "Interview"}{interview?.duration ? ` · ${interview.duration}` : ""} · with {interviewerName}
            </span>
          </div>
        </div>
      </div>
      <h1 className="page-h1" style={{ marginTop: 12 }}>{interviewTitle}</h1>
      <div className="page-sub">Live speech-to-text via Web Speech API · Chrome &amp; Edge only · AI diarisation post-call.</div>

      {!SpeechRecognition && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "oklch(0.97 0.04 85)", border: "1px solid oklch(0.82 0.12 85)", marginBottom: 16, fontSize: 13 }}>
          Web Speech API requires Chrome or Edge. Other browsers are not supported.
        </div>
      )}

      {sttError && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "var(--danger-soft, oklch(0.97 0.02 15))", border: "1px solid var(--danger, oklch(0.65 0.15 15))", marginBottom: 16, fontSize: 13, color: "var(--danger, oklch(0.55 0.18 15))" }}>
          {sttError}
        </div>
      )}

      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        {/* Controls bar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div className="row gap-8">
            {!recording ? (
              <Btn kind="primary" onClick={start} icon={<span className="rec-dot" style={{ animation: "none" }} />} disabled={!SpeechRecognition}>
                Start recording
              </Btn>
            ) : (
              <>
                <Btn kind="secondary" onClick={pause} icon={paused ? <Icons.Play size={12} /> : <Icons.Pause size={12} />}>
                  {paused ? "Resume" : "Pause"}
                </Btn>
                <Btn kind="danger" onClick={stop} icon={<Icons.Square size={12} />}>Stop & save</Btn>
              </>
            )}
            <button className="icon-btn" onClick={reset} title="Reset"><Icons.X size={14} /></button>
          </div>

          {/* Speaker toggle — visible while actively recording */}
          {recording && !paused && (
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <span className="text-12 text-muted">Now speaking:</span>
              <button
                onClick={toggleSpeaker}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 20,
                  border: "2px solid var(--accent)", background: "var(--accent-subtle)",
                  cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--ink)",
                  transition: "background 0.15s",
                }}
              >
                <span className="rec-dot" style={{ width: 6, height: 6 }} />
                {activeSpeaker === "Candidate" ? "Candidate" : interviewerName}
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
        <div className="scroll" style={{ padding: "20px 24px", maxHeight: 460 }}>
          {bubbles.length === 0 && !liveText && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--ink-muted)" }}>
              <Icons.Mic size={24} style={{ marginBottom: 8 }} />
              <div className="weight-500" style={{ color: "var(--ink-secondary)" }}>Press start when ready.</div>
              <div className="text-12 mt-4">Words appear here in real time. Tap the speaker button to switch between candidate and interviewer.</div>
            </div>
          )}
          {bubbles.map((b, i) => <Bubble key={i} {...b} />)}
          {liveText && (
            <Bubble
              speaker={activeSpeaker}
              who={activeSpeaker === "Candidate" ? "Candidate" : interviewerName}
              t={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              text={liveText}
              live
            />
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* AI co-pilot panel */}
      <div className="ai-panel card-pad" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="ai-tag"><Icons.Sparkles size={11} /> Co-pilot suggestions · live</span>
          <span className="text-12 text-muted">Updated as you record</span>
        </div>
        <div className="col gap-8">
          <CopilotItem text="They mentioned 'islands architecture' — ask which framework they shipped it with." done={bubbles.length >= 6} />
          <CopilotItem text="Probe the team-size signal: JD asks for 5+ ICs, CV shows 3." done={bubbles.length >= 4} />
          <CopilotItem text="Time check: hiring manager round usually wraps at 45m." done={false} />
        </div>
      </div>
    </div>
  );
};

const Bubble = ({ speaker, who, t, text, live }) => (
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

const CopilotItem = ({ text, done }) => (
  <div className="row gap-8" style={{ padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--ai-border)", borderRadius: 6, opacity: done ? 0.5 : 1 }}>
    <span style={{ width: 18, height: 18, borderRadius: 999, background: done ? "var(--positive-soft)" : "var(--ai-soft)", color: done ? "var(--positive)" : "var(--ai)", display: "grid", placeItems: "center", flexShrink: 0 }}>
      {done ? <Icons.Check size={11} /> : <Icons.Sparkles size={11} />}
    </span>
    <span className="text-13" style={{ textDecoration: done ? "line-through" : "none" }}>{text}</span>
  </div>
);

window.LiveRoomScreen = LiveRoomScreen;
