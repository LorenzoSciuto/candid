// Video Interview Portal — standalone screen, no auth required
// Accessed via #video/{token} hash routing

// ── ChunkUploader ─────────────────────────────────────────────────────────────

class ChunkUploader {
  constructor(token, responseId, onError) {
    this._token = token;
    this._responseId = responseId;
    this._onError = onError;
    this._chunkIndex = 0;
  }

  async uploadChunk(blob) {
    const currentIndex = this._chunkIndex++;
    const formData = new FormData();
    formData.append("chunk_index", String(currentIndex));
    formData.append("chunk", blob, `chunk_${currentIndex}.webm`);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await window._baseFetch(
          `${window.API_BASE}/public/video/${this._token}/responses/${this._responseId}/chunks`,
          { method: "POST", body: formData }
        );
        if (response.ok) return;
      } catch (_) {}
    }
    this._onError(`Chunk ${currentIndex} failed after 3 attempts`);
  }

  get totalChunksUploaded() {
    return this._chunkIndex;
  }
}

// ── HardwareCheckView ─────────────────────────────────────────────────────────

const HardwareCheckView = ({ onReady }) => {
  const [stream, setStream] = React.useState(null);
  const [permissionError, setPermissionError] = React.useState("");
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    requestPermissions();
    return () => stopStream();
  }, []);

  React.useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const requestPermissions = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
    } catch (error) {
      setPermissionError("Camera and microphone access are required. Please allow permissions and reload.");
    }
  };

  const stopStream = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
  };

  const handleReady = () => {
    stopStream();
    onReady();
  };

  return (
    <div style={styles.centerColumn}>
      <h2 style={styles.heading}>Hardware Check</h2>
      <p style={styles.subtext}>Make sure your camera and microphone are working before you begin.</p>

      {permissionError ? (
        <div style={styles.errorBox}>{permissionError}</div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={styles.videoPreview}
        />
      )}

      {stream && (
        <button style={styles.primaryButton} onClick={handleReady}>
          I'm Ready — Start Interview
        </button>
      )}
    </div>
  );
};

// ── CountdownTimer ─────────────────────────────────────────────────────────────

const CountdownTimer = ({ durationSeconds, onExpire }) => {
  const [remaining, setRemaining] = React.useState(durationSeconds);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(previous => {
        if (previous <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isWarning = remaining <= 30;

  return (
    <div style={{ ...styles.timerDisplay, color: isWarning ? "#ef4444" : "#e7e5e4" }}>
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
};

// ── InterviewView ─────────────────────────────────────────────────────────────

const InterviewView = ({ interview, currentQuestionIndex, onQuestionComplete }) => {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [timerKey, setTimerKey] = React.useState(0);

  const mediaRecorderRef = React.useRef(null);
  const uploaderRef = React.useRef(null);
  const responseIdRef = React.useRef(null);

  const questions = JSON.parse(interview.questions);
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];

  const initializeResponse = async () => {
    const fetchResult = await window._baseFetch(
      `${window.API_BASE}/public/video/${interview.invite_token}/responses/${currentQuestionIndex}`,
      { method: "POST" }
    );
    const data = await fetchResult.json();
    responseIdRef.current = data.id;
    return data;
  };

  const startRecording = async () => {
    const response = await initializeResponse();
    if (response.status === "complete") {
      setStatusMessage("This question is already recorded.");
      return;
    }

    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const uploader = new ChunkUploader(
      interview.invite_token,
      responseIdRef.current,
      (errorMessage) => setStatusMessage(errorMessage)
    );
    uploaderRef.current = uploader;

    const recorder = new MediaRecorder(mediaStream, { mimeType: "video/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        await uploader.uploadChunk(event.data);
      }
    };

    recorder.start(5000);
    setIsRecording(true);
    setTimerKey(previous => previous + 1);
  };

  const stopRecordingAndComplete = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setIsRecording(false);
    setIsUploading(true);
    setStatusMessage("Uploading…");

    recorder.stop();
    recorder.stream.getTracks().forEach(track => track.stop());

    await new Promise(resolve => { recorder.onstop = resolve; });

    const uploader = uploaderRef.current;
    await window._baseFetch(
      `${window.API_BASE}/public/video/${interview.invite_token}/responses/${responseIdRef.current}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total_chunks: uploader.totalChunksUploaded }),
      }
    );

    setIsUploading(false);
    setStatusMessage("");
    onQuestionComplete();
  };

  const handleTimerExpire = () => {
    stopRecordingAndComplete();
  };

  return (
    <div style={styles.centerColumn}>
      <div style={styles.progressText}>
        Question {currentQuestionIndex + 1} of {totalQuestions}
      </div>

      <div style={styles.questionBox}>
        {currentQuestion}
      </div>

      {isRecording && (
        <CountdownTimer
          key={timerKey}
          durationSeconds={180}
          onExpire={handleTimerExpire}
        />
      )}

      {statusMessage && (
        <div style={styles.statusMessage}>{statusMessage}</div>
      )}

      <div style={styles.controlRow}>
        {!isRecording && !isUploading && (
          <button style={styles.recordButton} onClick={startRecording}>
            Start Recording
          </button>
        )}
        {isRecording && (
          <button style={styles.stopButton} onClick={stopRecordingAndComplete}>
            Stop & Submit Answer
          </button>
        )}
        {isUploading && (
          <button style={{ ...styles.primaryButton, opacity: 0.6 }} disabled>
            Uploading…
          </button>
        )}
      </div>
    </div>
  );
};

// ── CompletionView ─────────────────────────────────────────────────────────────

const CompletionView = () => (
  <div style={styles.centerColumn}>
    <div style={styles.completionIcon}>✓</div>
    <h2 style={styles.heading}>Thank You</h2>
    <p style={styles.subtext}>
      Your video interview has been submitted successfully. The recruiting team will be in touch soon.
    </p>
  </div>
);

// ── VideoPortalScreen ─────────────────────────────────────────────────────────

const VideoPortalScreen = ({ token }) => {
  const [interview, setInterview] = React.useState(null);
  const [loadError, setLoadError] = React.useState("");
  const [view, setView] = React.useState("loading");
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);

  React.useEffect(() => {
    fetchInterview();
  }, [token]);

  const fetchInterview = async () => {
    try {
      const response = await window._baseFetch(`${window.API_BASE}/public/video/${token}`);
      if (response.status === 404) { setLoadError("Interview not found."); return; }
      if (response.status === 410) { setLoadError("This interview link has expired."); return; }
      if (!response.ok) { setLoadError("Unable to load interview. Please try again."); return; }
      const data = await response.json();
      setInterview(data);
      determineInitialView(data);
    } catch (_) {
      setLoadError("Network error — please check your connection.");
    }
  };

  const determineInitialView = (data) => {
    if (data.status === "completed") { setView("complete"); return; }
    if (data.status === "in_progress") {
      setCurrentQuestionIndex(resolveResumeIndex(data));
      setView("interview");
      return;
    }
    setView("hardware");
  };

  const resolveResumeIndex = (data) => {
    const questions = JSON.parse(data.questions);
    return Math.max(0, questions.length - 1);
  };

  const handleHardwareReady = async () => {
    await window._baseFetch(
      `${window.API_BASE}/public/video/${token}/start`,
      { method: "POST" }
    );
    setView("interview");
  };

  const handleQuestionComplete = async () => {
    const questions = JSON.parse(interview.questions);
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= questions.length) {
      await completeInterview();
      return;
    }
    setCurrentQuestionIndex(nextIndex);
  };

  const completeInterview = async () => {
    await window._baseFetch(
      `${window.API_BASE}/public/video/${token}/complete`,
      { method: "POST" }
    );
    setView("complete");
  };

  if (view === "loading") {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.card}>
          {loadError
            ? <div style={styles.errorBox}>{loadError}</div>
            : <div style={styles.subtext}>Loading interview…</div>
          }
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.card}>
        <div style={styles.brand}>Candid</div>

        {view === "hardware" && (
          <HardwareCheckView onReady={handleHardwareReady} />
        )}
        {view === "interview" && interview && (
          <InterviewView
            interview={interview}
            currentQuestionIndex={currentQuestionIndex}
            onQuestionComplete={handleQuestionComplete}
          />
        )}
        {view === "complete" && <CompletionView />}
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  pageWrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    fontFamily: "var(--font-sans)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 640,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 40,
  },
  brand: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--ink-secondary)",
    marginBottom: 32,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  centerColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    textAlign: "center",
  },
  heading: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: "var(--ink)",
    letterSpacing: "-0.02em",
  },
  subtext: {
    margin: 0,
    fontSize: 14,
    color: "var(--ink-secondary)",
    lineHeight: 1.6,
    maxWidth: 420,
  },
  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 14,
    maxWidth: 420,
    textAlign: "center",
  },
  videoPreview: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "#000",
    aspectRatio: "16/9",
    objectFit: "cover",
  },
  primaryButton: {
    padding: "10px 24px",
    background: "var(--ink)",
    color: "var(--bg)",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  recordButton: {
    padding: "10px 24px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  stopButton: {
    padding: "10px 24px",
    background: "#1c1917",
    color: "#fff",
    border: "2px solid #ef4444",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  progressText: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--ink-secondary)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  questionBox: {
    fontSize: 18,
    fontWeight: 500,
    color: "var(--ink)",
    lineHeight: 1.5,
    padding: "24px 32px",
    background: "var(--bg-sunken)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    maxWidth: 520,
    width: "100%",
    textAlign: "left",
  },
  timerDisplay: {
    fontSize: 36,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
  },
  statusMessage: {
    fontSize: 13,
    color: "var(--ink-secondary)",
  },
  controlRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
  },
  completionIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "#4ade80",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    color: "#fff",
    fontWeight: 700,
  },
};

window.VideoPortalScreen = VideoPortalScreen;
