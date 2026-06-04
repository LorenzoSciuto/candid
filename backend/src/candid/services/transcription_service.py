import dataclasses
import json
import subprocess
from pathlib import Path

from sqlmodel import Session

from candid.models import Interview
from candid.prompts import Prompts
from candid.services.ai_engine import AIEngine


@dataclasses.dataclass
class TranscriptionResult:
    text: str
    language: str
    duration_seconds: float


class TranscriptionService:
    _AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus"}
    _FFMPEG_TIMEOUT_SECONDS = 120

    def __init__(self, upload_dir: Path, ai_engine: AIEngine) -> None:
        self._upload_dir = upload_dir
        self._ai_engine = ai_engine

    def save_audio_file(self, interview_id: str, file_data: bytes, filename: str) -> Path:
        destination_dir = self._upload_dir / interview_id
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination_path = destination_dir / filename
        destination_path.write_bytes(file_data)
        return destination_path

    def extract_audio(self, input_path: Path) -> Path:
        if input_path.suffix.lower() in self._AUDIO_EXTENSIONS:
            return input_path
        return self._run_ffmpeg_extraction(input_path)

    def transcribe(self, audio_path: Path, api_key: str, provider: str, model: str) -> TranscriptionResult:
        if provider == "groq":
            return self._transcribe_with_groq(audio_path, api_key, model)
        return self._transcribe_with_openai(audio_path, api_key, model)

    def evaluate_transcript(self, transcript_text: str, interview_context: str) -> dict:
        prompt = Prompts.TRANSCRIPT_EVALUATION.format(
            interview_context=interview_context,
            transcript_text=transcript_text,
        )
        return self._parse_evaluation_response(prompt)

    def process_interview_audio(self, session: Session, interview: Interview) -> None:
        self._mark_processing(session, interview)
        try:
            self._execute_pipeline(session, interview)
        except Exception as pipeline_exception:
            self._mark_failed(session, interview, pipeline_exception)

    def _run_ffmpeg_extraction(self, input_path: Path) -> Path:
        output_path = input_path.with_suffix(".wav")
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(input_path), "-vn", "-acodec", "pcm_s16le", str(output_path)],
            check=True,
            capture_output=True,
            timeout=self._FFMPEG_TIMEOUT_SECONDS,
        )
        return output_path

    def _transcribe_with_openai(self, audio_path: Path, api_key: str, model: str) -> TranscriptionResult:
        from openai import OpenAI
        openai_client = OpenAI(api_key=api_key)
        with audio_path.open("rb") as audio_file:
            transcription = openai_client.audio.transcriptions.create(
                model=model,
                file=audio_file,
                response_format="verbose_json",
            )
        return TranscriptionResult(
            text=transcription.text,
            language=getattr(transcription, "language", "en") or "en",
            duration_seconds=float(getattr(transcription, "duration", 0.0) or 0.0),
        )

    def _transcribe_with_groq(self, audio_path: Path, api_key: str, model: str) -> TranscriptionResult:
        from groq import Groq
        groq_client = Groq(api_key=api_key)
        with audio_path.open("rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                model=model,
                file=audio_file,
                response_format="verbose_json",
            )
        return TranscriptionResult(
            text=transcription.text,
            language=getattr(transcription, "language", "en") or "en",
            duration_seconds=float(getattr(transcription, "duration", 0.0) or 0.0),
        )

    def _parse_evaluation_response(self, prompt: str) -> dict:
        raw = self._ai_engine._call(prompt)
        try:
            parsed = json.loads(raw.strip())
        except Exception:
            parsed = {}
        return {
            "strengths": parsed.get("strengths", []),
            "concerns": parsed.get("concerns", []),
            "recommendation": parsed.get("recommendation", ""),
            "score": parsed.get("score", 0),
            "summary": parsed.get("summary", ""),
        }

    def _build_interview_context(self, interview: Interview) -> str:
        parts = []
        if interview.title:
            parts.append(f"Title: {interview.title}")
        if interview.interviewer:
            parts.append(f"Interviewer: {interview.interviewer}")
        if interview.date:
            parts.append(f"Date: {interview.date}")
        return "; ".join(parts) if parts else "No additional context"

    def _execute_pipeline(self, session: Session, interview: Interview) -> None:
        input_path = Path(interview.audio_file_path)
        audio_path = self.extract_audio(input_path)
        transcription_result = self._run_transcription(audio_path, interview)
        evaluation_result = self.evaluate_transcript(
            transcript_text=transcription_result.text,
            interview_context=self._build_interview_context(interview),
        )
        self._persist_results(session, interview, transcription_result, evaluation_result)

    def _run_transcription(self, audio_path: Path, interview: Interview) -> TranscriptionResult:
        import os
        provider = os.environ.get("DEFAULT_PROVIDER", "openai")
        model = "whisper-1" if provider == "openai" else "whisper-large-v3"
        api_key = os.environ.get("OPENAI_API_KEY", "") if provider == "openai" else os.environ.get("GROQ_API_KEY", "")
        return self.transcribe(audio_path, api_key, provider, model)

    def _persist_results(
        self,
        session: Session,
        interview: Interview,
        transcription_result: TranscriptionResult,
        evaluation_result: dict,
    ) -> None:
        interview.transcript_raw = transcription_result.text
        interview.transcript_language = transcription_result.language
        interview.ai_evaluation = json.dumps(evaluation_result)
        interview.transcript_status = "done"
        session.add(interview)
        session.commit()

    def _mark_processing(self, session: Session, interview: Interview) -> None:
        interview.transcript_status = "processing"
        session.add(interview)
        session.commit()

    def _mark_failed(self, session: Session, interview: Interview, pipeline_exception: Exception) -> None:
        interview.transcript_status = "failed"
        session.add(interview)
        session.commit()
