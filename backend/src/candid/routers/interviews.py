from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Candidate, Interview
from candid.schemas import InterviewCreate, InterviewProcess, InterviewSummarize, InterviewUpdate
from candid.services.ai_engine import AIEngineFactory
from candid.services.transcription_service import TranscriptionService


class InterviewsRouter:
    def __init__(
        self,
        db: Database,
        ai_factory: AIEngineFactory,
        transcription_service: Optional[TranscriptionService] = None,
    ) -> None:
        self._db = db
        self._ai_factory = ai_factory
        self._transcription_service = transcription_service
        self.router = APIRouter(prefix="/interviews", tags=["interviews"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("")
        def list_interviews(
            candidate_id: Optional[str] = None,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._list(session, user.org_id, candidate_id)

        @self.router.post("", status_code=201)
        def create_interview(
            body: InterviewCreate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._create(session, user.org_id, body)

        @self.router.patch("/{interview_id}")
        def update_interview(
            interview_id: str,
            body: InterviewUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._update(session, user.org_id, interview_id, body)

        @self.router.post("/{interview_id}/process")
        def process_interview(
            interview_id: str,
            body: InterviewProcess,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._process(session, user.org_id, interview_id, body)

        @self.router.post("/{interview_id}/summarize")
        def summarize_interview(
            interview_id: str,
            body: InterviewSummarize,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._summarize(session, user.org_id, interview_id, body)

        @self.router.post("/{interview_id}/upload-audio")
        def upload_audio(
            interview_id: str,
            file: UploadFile,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._upload_audio(session, user.org_id, interview_id, file)

        @self.router.get("/{interview_id}/transcript")
        def get_transcript(
            interview_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get_transcript(session, user.org_id, interview_id)

    def _list(self, session, org_id, candidate_id) -> list:
        stmt = select(Interview).where(Interview.org_id == org_id)
        if candidate_id:
            stmt = stmt.where(Interview.candidate_id == candidate_id)
        return session.exec(stmt).all()

    def _create(self, session, org_id, body: InterviewCreate) -> Interview:
        interview = Interview(org_id=org_id, **body.model_dump())
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def _update(self, session, org_id, interview_id, body: InterviewUpdate) -> Interview:
        interview = self._fetch(session, org_id, interview_id)
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(interview, field, value)
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def _process(self, session, org_id, interview_id, body: InterviewProcess) -> Interview:
        interview = self._fetch(session, org_id, interview_id)
        candidate = session.get(Candidate, interview.candidate_id)
        cv_context = candidate.cv_text if candidate else None
        try:
            engine = self._ai_factory.from_session(session, org_id)
            result = engine.process_transcript(body.raw_content, cv_context=cv_context)
        except Exception as exc:
            raise HTTPException(502, f"AI error: {exc}") from exc
        interview.raw_content = body.raw_content
        interview.cleaned_transcript = result.get("cleaned_transcript")
        interview.ai_summary = result.get("summary")
        interview.extra_info = result.get("extra_info")
        cleaned = interview.cleaned_transcript or body.raw_content
        try:
            summary_result = engine.summarize_interview(cleaned)
            interview.ai_summary = summary_result.get("summary") or interview.ai_summary
            interview.extra_info = (
                "\n".join(summary_result.get("bullets", []))
                or interview.extra_info
            )
        except Exception:
            pass
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def _summarize(self, session, org_id, interview_id, body: InterviewSummarize) -> dict:
        self._fetch(session, org_id, interview_id)
        try:
            engine = self._ai_factory.from_session(session, org_id)
            result = engine.summarize_interview(body.text)
        except Exception as exc:
            raise HTTPException(502, f"AI error: {exc}") from exc
        return {"bullets": result.get("bullets", []), "summary": result.get("summary", "")}

    def _upload_audio(self, session, org_id, interview_id, file: UploadFile) -> dict:
        interview = self._fetch(session, org_id, interview_id)
        if self._transcription_service is None:
            raise HTTPException(503, "Transcription service not configured")
        file_data = file.file.read()
        saved_path = self._transcription_service.save_audio_file(interview_id, file_data, file.filename or "audio")
        interview.audio_file_path = str(saved_path)
        interview.transcript_status = "pending"
        session.add(interview)
        session.commit()
        session.refresh(interview)
        self._transcription_service.process_interview_audio(session, interview)
        return {"status": "processing"}

    def _get_transcript(self, session, org_id, interview_id) -> dict:
        interview = self._fetch(session, org_id, interview_id)
        return {
            "transcript_raw": interview.transcript_raw,
            "transcript_status": interview.transcript_status,
            "transcript_language": interview.transcript_language,
            "ai_evaluation": interview.ai_evaluation,
        }

    @staticmethod
    def _fetch(session, org_id, interview_id) -> Interview:
        interview = session.get(Interview, interview_id)
        if not interview or interview.org_id != org_id:
            raise HTTPException(404, "Interview not found")
        return interview
