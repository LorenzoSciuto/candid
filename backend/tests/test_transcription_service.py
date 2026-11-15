import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.commons.models import Interview
from candid.services.transcription_service import TranscriptionResult, TranscriptionService


def _make_ai_engine_factory() -> MagicMock:
    factory = MagicMock()
    engine = MagicMock()
    engine._call = MagicMock(return_value="{}")
    factory.from_session.return_value = engine
    factory.resolve_api_key.return_value = "test-key"
    return factory


def _make_service(tmp_path: Path) -> TranscriptionService:
    return TranscriptionService(upload_dir=tmp_path / "uploads", ai_engine_factory=_make_ai_engine_factory())


def _make_in_memory_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _make_interview(session: Session) -> Interview:
    interview = Interview(org_id="org-test", type="Audio Upload")
    session.add(interview)
    session.commit()
    session.refresh(interview)
    return interview


class TestSaveAudioFile:
    def test_saveAudioFile_shouldCreateFile_whenValidInput(self, tmp_path: Path) -> None:
        service = _make_service(tmp_path)
        file_data = b"fake audio bytes"
        saved_path = service.save_audio_file("interview-abc", file_data, "recording.mp3")
        assert saved_path.exists()
        assert saved_path.read_bytes() == file_data
        assert saved_path.parent.name == "interview-abc"
        assert saved_path.suffix == ".mp3"

    def test_save_audio_file_should_stay_in_upload_dir_when_filename_is_a_path(self, tmp_path: Path) -> None:
        service = _make_service(tmp_path)
        for hostile in ("../../../evil.mp3", "/etc/evil.mp3"):
            saved_path = service.save_audio_file("interview-abc", b"x", hostile)
            assert saved_path.resolve().is_relative_to(tmp_path.resolve())

    def test_save_audio_file_should_raise_when_extension_not_allowed(self, tmp_path: Path) -> None:
        service = _make_service(tmp_path)
        with pytest.raises(ValueError):
            service.save_audio_file("interview-abc", b"x", "payload.py")


class TestExtractAudio:
    def test_extractAudio_shouldReturnSamePath_whenInputIsWav(self, tmp_path: Path) -> None:
        service = _make_service(tmp_path)
        wav_file = tmp_path / "audio.wav"
        wav_file.write_bytes(b"RIFF header")
        result_path = service.extract_audio(wav_file)
        assert result_path == wav_file

    def test_extractAudio_shouldReturnSamePath_whenInputIsMp3(self, tmp_path: Path) -> None:
        service = _make_service(tmp_path)
        mp3_file = tmp_path / "audio.mp3"
        mp3_file.write_bytes(b"ID3 header")
        result_path = service.extract_audio(mp3_file)
        assert result_path == mp3_file

    def test_extractAudio_shouldCallFfmpeg_whenInputIsVideo(self, tmp_path: Path) -> None:
        service = _make_service(tmp_path)
        video_file = tmp_path / "video.mp4"
        video_file.write_bytes(b"ftyp header")

        with patch("subprocess.run") as mock_subprocess_run:
            mock_subprocess_run.return_value = MagicMock(returncode=0)
            result_path = service.extract_audio(video_file)

        mock_subprocess_run.assert_called_once()
        call_args = mock_subprocess_run.call_args
        assert "ffmpeg" in call_args[0][0]
        assert str(video_file) in call_args[0][0]
        assert result_path == video_file.with_suffix(".wav")


class TestTranscribe:
    def test_transcribe_shouldCallOpenAiWhisper_whenProviderIsOpenai(self, tmp_path: Path) -> None:
        service = _make_service(tmp_path)
        audio_file = tmp_path / "audio.wav"
        audio_file.write_bytes(b"WAV data")

        mock_transcription = MagicMock()
        mock_transcription.text = "Hello world"
        mock_transcription.language = "en"
        mock_transcription.duration = 5.0

        with patch("openai.OpenAI") as mock_openai_class:
            mock_openai_instance = MagicMock()
            mock_openai_class.return_value = mock_openai_instance
            mock_openai_instance.audio.transcriptions.create.return_value = mock_transcription

            result = service.transcribe(audio_file, "test-key", "openai", "whisper-1")

        mock_openai_instance.audio.transcriptions.create.assert_called_once()
        assert result.text == "Hello world"
        assert result.language == "en"
        assert result.duration_seconds == 5.0

    def test_transcribe_shouldCallGroq_whenProviderIsGroq(self, tmp_path: Path) -> None:
        service = _make_service(tmp_path)
        audio_file = tmp_path / "audio.wav"
        audio_file.write_bytes(b"WAV data")

        mock_transcription = MagicMock()
        mock_transcription.text = "Ciao mondo"
        mock_transcription.language = "it"
        mock_transcription.duration = 3.5

        with patch("groq.Groq") as mock_groq_class:
            mock_groq_instance = MagicMock()
            mock_groq_class.return_value = mock_groq_instance
            mock_groq_instance.audio.transcriptions.create.return_value = mock_transcription

            result = service.transcribe(audio_file, "test-groq-key", "groq", "whisper-large-v3")

        mock_groq_instance.audio.transcriptions.create.assert_called_once()
        assert result.text == "Ciao mondo"
        assert result.language == "it"
        assert result.duration_seconds == 3.5


class TestEvaluateTranscript:
    _EVALUATION_JSON = json.dumps({
        "strengths": ["Clear communicator", "Strong technical background"],
        "concerns": ["Limited leadership experience"],
        "recommendation": "yes",
        "score": 7,
        "summary": "Solid candidate with good fundamentals.",
    })

    def test_evaluateTranscript_shouldReturnDict_whenAiEngineSucceeds(self, tmp_path: Path) -> None:
        ai_engine_factory = _make_ai_engine_factory()
        ai_engine_factory.from_session.return_value._call = MagicMock(return_value=self._EVALUATION_JSON)
        service = TranscriptionService(upload_dir=tmp_path, ai_engine_factory=ai_engine_factory)
        session = _make_in_memory_session()

        evaluation = service.evaluate_transcript(
            transcript_text="Interviewer: Tell me. Candidate: Sure.",
            interview_context="Senior Engineer role",
            session=session,
            org_id="org-test",
        )

        assert evaluation["strengths"] == ["Clear communicator", "Strong technical background"]
        assert evaluation["concerns"] == ["Limited leadership experience"]
        assert evaluation["recommendation"] == "yes"
        assert evaluation["score"] == 7
        assert "Solid candidate" in evaluation["summary"]


class TestProcessInterviewAudio:
    _TRANSCRIPT_TEXT = "Interviewer: Hi. Candidate: Hello."
    _EVALUATION_JSON = json.dumps({
        "strengths": ["Good fit"],
        "concerns": [],
        "recommendation": "yes",
        "score": 8,
        "summary": "Looks promising.",
    })

    def _make_interview_with_audio(self, session: Session, audio_path: Path) -> Interview:
        interview = Interview(
            org_id="org-test",
            type="Audio Upload",
            audio_file_path=str(audio_path),
        )
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def test_processInterviewAudio_shouldSetDone_whenSuccess(self, tmp_path: Path) -> None:
        audio_file = tmp_path / "audio.wav"
        audio_file.write_bytes(b"WAV data")

        session = _make_in_memory_session()
        interview = self._make_interview_with_audio(session, audio_file)

        mock_transcription_result = TranscriptionResult(
            text=self._TRANSCRIPT_TEXT,
            language="en",
            duration_seconds=10.0,
        )

        ai_engine_factory = _make_ai_engine_factory()
        ai_engine_factory.from_session.return_value._call = MagicMock(return_value=self._EVALUATION_JSON)
        service = TranscriptionService(upload_dir=tmp_path, ai_engine_factory=ai_engine_factory)

        with patch.object(service, "transcribe", return_value=mock_transcription_result):
            service.process_interview_audio(session, interview, "org-test")

        session.refresh(interview)
        assert interview.transcript_status == "done"
        assert interview.transcript_raw == self._TRANSCRIPT_TEXT
        assert interview.transcript_language == "en"
        assert interview.ai_evaluation is not None
        evaluation = json.loads(interview.ai_evaluation)
        assert evaluation["score"] == 8

    def test_processInterviewAudio_shouldSetFailed_whenExceptionRaised(self, tmp_path: Path) -> None:
        audio_file = tmp_path / "audio.wav"
        audio_file.write_bytes(b"WAV data")

        session = _make_in_memory_session()
        interview = self._make_interview_with_audio(session, audio_file)

        service = _make_service(tmp_path)

        with patch.object(service, "transcribe", side_effect=RuntimeError("Transcription failed")):
            service.process_interview_audio(session, interview, "org-test")

        session.refresh(interview)
        assert interview.transcript_status == "failed"
