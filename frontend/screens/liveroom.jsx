// Live Interview Room — real-time STT
const { SAMPLE_TRANSCRIPT } = window.CANDID_DATA;

const LiveRoomScreen = ({ tweaks }) => {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [liveText, setLiveText] = useState("");
  const idxRef = useRef(0);
  const charRef = useRef(0);

  useEffect(() => {
    if (!recording || paused) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [recording, paused]);

  useEffect(() => {
    if (!recording || paused) return;
    const speed = tweaks.streaming ? 22 : 6;
    const tick = setInterval(() => {
      const i = idxRef.current;
      if (i >= SAMPLE_TRANSCRIPT.length) { clearInterval(tick); return; }
      const cur = SAMPLE_TRANSCRIPT[i];
      const nextChar = charRef.current + speed;
      if (nextChar >= cur.text.length) {
        setBubbles(b => [...b, cur]);
        setLiveText("");
        idxRef.current = i + 1;
        charRef.current = 0;
      } else {
        charRef.current = nextChar;
        setLiveText(cur.text.slice(0, nextChar));
      }
    }, 80);
    return () => clearInterval(tick);
  }, [recording, paused, tweaks.streaming]);

  const start = () => { setRecording(true); setPaused(false); };
  const pause = () => setPaused(p => !p);
  const stop = () => { setRecording(false); setPaused(false); };
  const reset = () => { setRecording(false); setPaused(false); setElapsed(0); setBubbles([]); setLiveText(""); idxRef.current = 0; charRef.current = 0; };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const liveSpeaker = SAMPLE_TRANSCRIPT[idxRef.current];

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="row gap-8">
          <span className="ai-tag"><span className="ai-spark" /> Live Room</span>
          {recording && <Badge kind="danger"><span className="rec-dot" />REC {fmt(elapsed)}</Badge>}
        </div>
        <div className="row gap-8">
          <Avatar name="Maya Chen" />
          <div className="col">
            <span className="text-13 weight-500">Maya Chen · Hiring Manager round</span>
            <span className="text-12 text-muted">Senior Frontend Engineer · with Sasha Rivera</span>
          </div>
        </div>
      </div>
      <h1 className="page-h1" style={{ marginTop: 12 }}>Interview in progress</h1>
      <div className="page-sub">Speech-to-text via Web Speech API. Speakers are separated post-call by AI.</div>

      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <div className="row" style={{ padding: 16, borderBottom: "1px solid var(--border)", justifyContent: "space-between" }}>
          <div className="row gap-12">
            {!recording ? (
              <Btn kind="primary" onClick={start} icon={<span className="rec-dot" style={{ animation: "none" }} />}>Start recording</Btn>
            ) : (
              <>
                <Btn kind="secondary" onClick={pause} icon={paused ? <Icons.Play size={12} /> : <Icons.Pause size={12} />}>{paused ? "Resume" : "Pause"}</Btn>
                <Btn kind="danger" onClick={stop} icon={<Icons.Square size={12} />}>Stop & save</Btn>
              </>
            )}
            <button className="icon-btn" onClick={reset} title="Reset"><Icons.X size={14} /></button>
          </div>
          <div className="row gap-16">
            <div className="col" style={{ alignItems: "flex-end" }}>
              <span className="text-12 text-muted">Active speaker</span>
              <span className="text-13 weight-500">{recording && !paused ? (liveSpeaker?.who || "—") : "—"}</span>
            </div>
            <div style={{ width: 1, background: "var(--border)" }} />
            <div className="wave" style={{ opacity: recording && !paused ? 1 : 0.25 }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} style={{ animationDelay: `${i * 0.06}s`, animationPlayState: recording && !paused ? "running" : "paused" }} />
              ))}
            </div>
          </div>
        </div>

        <div className="scroll" style={{ padding: "20px 24px", maxHeight: 460 }}>
          {bubbles.length === 0 && !liveText && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--ink-muted)" }}>
              <Icons.Mic size={24} style={{ marginBottom: 8 }} />
              <div className="weight-500" style={{ color: "var(--ink-secondary)" }}>Press start when you're ready.</div>
              <div className="text-12 mt-4">Words will appear here in real time.</div>
            </div>
          )}
          {bubbles.map((b, i) => (
            <Bubble key={i} {...b} />
          ))}
          {liveText && liveSpeaker && (
            <Bubble {...liveSpeaker} text={liveText} live />
          )}
        </div>
      </div>

      {/* AI side panel */}
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
