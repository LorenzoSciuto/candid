// Live Interview Room — real Chrome/Edge Web Speech API, saves transcript to backend

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const LiveRoomScreen = ({ interview, onDone }) => {
  const t = window.useT();
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [liveText, setLiveText] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState("Candidate");
  const [sttError, setSttError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);

  const recognitionRef = useRef(null);
  const shouldRunRef = useRef(false);
  const activeSpeakerRef = useRef("Candidate");
  const transcriptEndRef = useRef(null);
  const resolvedInterviewIdRef = useRef(interview?.id || null);

  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);

  // Timer
  useEffect(() => {
    if (!recording || paused) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording, paused]);

  // Auto-scroll (only while recording)
  useEffect(() => {
    if (recording) transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, liveText, recording]);

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
            ? (interview?.interviewer || t('liveroom.interviewer'))
            : (interview?.candidateName || t('liveroom.candidate'));
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
        setSttError(t('liveroom.err.micDenied'));
        shouldRunRef.current = false;
        setRecording(false);
        setPaused(false);
      }
    };

    return r;
  };

  const start = () => {
    if (!SpeechRecognition) {
      setSttError(t('liveroom.err.noSpeechApi'));
      return;
    }
    setSttError(null);
    setSaved(false);
    setReviewing(false);
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

    if (bubbles.length === 0) return;

    setSaving(true);
    setSttError(null);

    let interviewId = resolvedInterviewIdRef.current;

    if (!interviewId) {
      if (!interview?.candidateId) {
        setSaving(false);
        setReviewing(true);
        return;
      }
      try {
        const res = await fetch(`${window.API_BASE}/interviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidate_id: interview.candidateId,
            type: interview.type || "Live",
            title: interview.title || "Live Interview",
            interviewer: interview.interviewer || null,
            date: new Date().toISOString().slice(0, 10),
          }),
        });
        if (!res.ok) throw new Error("create failed");
        const created = await res.json();
        interviewId = created.id;
        resolvedInterviewIdRef.current = interviewId;
      } catch {
        setSttError(t('liveroom.err.createFailed'));
        setSaving(false);
        return;
      }
    }

    try {
      await fetch(`${window.API_BASE}/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_content: buildTranscriptText(bubbles) }),
      });
      setSaving(false);
      setReviewing(true);
    } catch {
      setSttError(t('liveroom.err.saveFailed'));
      setSaving(false);
    }
  };

  const deleteBubble = (index) => {
    setBubbles(prev => prev.filter((_, i) => i !== index));
  };

  const synthesize = async () => {
    const interviewId = resolvedInterviewIdRef.current;
    if (!interviewId) return;
    setProcessing(true);
    setProcessError(null);
    const rawContent = buildTranscriptText(bubbles);
    try {
      await fetch(`${window.API_BASE}/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_content: rawContent }),
      });
      await fetch(`${window.API_BASE}/interviews/${interviewId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_content: rawContent }),
      });
      setProcessing(false);
      setReviewing(false);
      setSaved(true);
    } catch {
      setProcessError(t('liveroom.err.processFailed'));
      setProcessing(false);
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
    setReviewing(false);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const candidateName = interview?.candidateName || t('liveroom.candidate');
  const interviewerName = interview?.interviewer || t('liveroom.interviewer');
  const interviewTitle = interview?.title || interview?.type || t('liveroom.interview');

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="col gap-4">
          <div className="row gap-8" style={{ alignItems: "center" }}>
            <Icons.Mic size={16} />
            <span style={{ fontWeight: 600, fontSize: 18 }}>{interviewTitle}</span>
            {recording && <Badge kind="danger"><span className="rec-dot" /> REC {fmt(elapsed)}</Badge>}
            {reviewing && !processing && <Badge kind="warning">{t('liveroom.reviewTranscript')}</Badge>}
            {saved && <Badge kind="positive">{t('liveroom.transcriptSaved')}</Badge>}
          </div>
          <span className="text-13 text-secondary">{candidateName} · {t('liveroom.withInterviewer').replace('{name}', interviewerName)}</span>
        </div>
        <Btn onClick={onDone}>← {t('liveroom.backToInterviews')}</Btn>
      </div>

      {!SpeechRecognition && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "oklch(0.97 0.04 85)", border: "1px solid oklch(0.82 0.12 85)", marginBottom: 16, fontSize: 13 }}>
          {t('liveroom.speechApiRequired')}
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
            {!recording && !reviewing && !saved ? (
              <Btn kind="primary" onClick={start} icon={<Icons.Mic size={14} />} disabled={!SpeechRecognition || saving}>
                {t('liveroom.startRecording')}
              </Btn>
            ) : recording ? (
              <>
                <Btn kind="secondary" onClick={pause} icon={paused ? <Icons.Play size={12} /> : <Icons.Pause size={12} />}>
                  {paused ? t('liveroom.resume') : t('liveroom.pause')}
                </Btn>
                <Btn kind="danger" onClick={stopAndSave} icon={<Icons.Square size={12} />} disabled={saving}>
                  {saving ? t('common.saving') : t('liveroom.stopSave')}
                </Btn>
              </>
            ) : null}
            {!recording && !reviewing && !saved && bubbles.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={reset}>{t('liveroom.reset')}</button>
            )}
          </div>

          {/* Speaker toggle */}
          {recording && !paused && (
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <span className="text-12 text-muted">{t('liveroom.nowSpeaking')}</span>
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
              <span className="text-11 text-muted">{t('liveroom.clickToSwitch')}</span>
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
              <div className="weight-500" style={{ color: "var(--ink-secondary)" }}>{t('liveroom.empty.title')}</div>
              <div className="text-12" style={{ marginTop: 6 }}>{t('liveroom.empty.hint')}</div>
            </div>
          )}
          {bubbles.map((b, i) => (
            <TranscriptBubble
              key={i}
              {...b}
              onDelete={reviewing ? () => deleteBubble(i) : null}
            />
          ))}
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

      {/* Review panel */}
      {reviewing && !saved && (
        <div className="card card-pad col gap-12">
          <div className="row gap-12" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div className="col gap-2">
              <span className="weight-600">{t('liveroom.reviewTranscript')}</span>
              <span className="text-12 text-muted">
                {(bubbles.length === 1 ? t('liveroom.review.statsOne') : t('liveroom.review.stats')).replace('{n}', bubbles.length).replace('{time}', fmt(elapsed))}
              </span>
              {processError && <span className="text-12" style={{ color: "var(--danger)", marginTop: 4 }}>{processError}</span>}
            </div>
            <div className="row gap-8">
              <Btn kind="ghost" onClick={reset} disabled={processing}>{t('liveroom.discard')}</Btn>
              <Btn
                kind="ai"
                icon={processing ? null : <Icons.Sparkles size={14} />}
                onClick={synthesize}
                disabled={processing || bubbles.length === 0 || !resolvedInterviewIdRef.current}
              >
                {processing ? t('liveroom.synthesizing') : t('liveroom.cleanupSynthesize')}
              </Btn>
            </div>
          </div>
          {processing && (
            <div className="row gap-8" style={{ alignItems: "center" }}>
              <span className="badge ai" style={{ padding: "4px 10px" }}><span className="dot" /> {t('liveroom.analyzing')}</span>
              <span className="text-12 text-muted">{t('liveroom.analyzingHint')}</span>
            </div>
          )}
        </div>
      )}

      {/* Done panel */}
      {saved && (
        <div className="card card-pad row gap-12" style={{ alignItems: "center" }}>
          <Icons.Check size={16} style={{ color: "var(--positive)" }} />
          <div className="col" style={{ flex: 1 }}>
            <span className="weight-500">{t('liveroom.processed')}</span>
            <span className="text-12 text-muted">{t('liveroom.done.stats').replace('{n}', bubbles.length).replace('{time}', fmt(elapsed))}</span>
          </div>
          <Btn kind="primary" onClick={onDone}>{t('liveroom.backToInterviews')}</Btn>
        </div>
      )}
    </div>
  );
};

const TranscriptBubble = ({ speaker, who, t, text, live, onDelete }) => {
  const tr = window.useT(); // `t` is taken by the timestamp prop
  return (
  <div className={`bubble ${speaker.toLowerCase()} ${live ? "live" : ""}`} style={{ position: "relative" }}>
    {onDelete && (
      <button
        onClick={onDelete}
        title={tr('liveroom.removeLine')}
        style={{
          position: "absolute", top: 6, right: 6,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--ink-muted)", fontSize: 16, lineHeight: 1,
          padding: "2px 5px", borderRadius: 4,
          opacity: 0.5,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
        onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
      >×</button>
    )}
    {speaker === "Interviewer" && <Avatar name={who} />}
    <div className="col" style={{ maxWidth: "70%" }}>
      <div className="meta">
        <span>{who}</span>
        <span>·</span>
        <span>{t}</span>
        {live && <span style={{ color: "var(--ai)" }}>● {tr('liveroom.live')}</span>}
      </div>
      <div className="body">{text}{live && <span className="caret"></span>}</div>
    </div>
    {speaker === "Candidate" && <Avatar name={who} />}
  </div>
  );
};

window.LiveRoomScreen = LiveRoomScreen;
