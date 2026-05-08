from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.models import Interview
from candid.schemas import InterviewCreate, InterviewProcess, InterviewUpdate
from candid.services.ai_engine import AIEngineFactory


class InterviewsRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory) -> None:
        self._db = db
        self._ai_factory = ai_factory
        self.router = APIRouter(prefix="/interviews", tags=["interviews"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/")
        def list_interviews(
            candidate_id: Optional[str] = None,
            session: Session = Depends(db.get_session),
        ):
            return self._list(session, candidate_id)

        @self.router.post("/", status_code=201)
        def create_interview(
            body: InterviewCreate,
            session: Session = Depends(db.get_session),
        ):
            return self._create(session, body)

        @self.router.patch("/{interview_id}")
        def update_interview(
            interview_id: str,
            body: InterviewUpdate,
            session: Session = Depends(db.get_session),
        ):
            return self._update(session, interview_id, body)

        @self.router.post("/{interview_id}/process")
        def process_interview(
            interview_id: str,
            body: InterviewProcess,
            session: Session = Depends(db.get_session),
        ):
            return self._process(session, interview_id, body)

    # ── Implementations ────────────────────────────────────────────────────────

    def _list(self, session: Session, candidate_id: Optional[str]) -> list:
        stmt = select(Interview)
        if candidate_id:
            stmt = stmt.where(Interview.candidate_id == candidate_id)
        return session.exec(stmt).all()

    def _create(self, session: Session, body: InterviewCreate) -> Interview:
        interview = Interview(**body.model_dump())
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def _update(
        self, session: Session, interview_id: str, body: InterviewUpdate
    ) -> Interview:
        interview = session.get(Interview, interview_id)
        if not interview:
            raise HTTPException(404, "Interview not found")
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(interview, field, value)
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def _process(
        self, session: Session, interview_id: str, body: InterviewProcess
    ) -> Interview:
        interview = session.get(Interview, interview_id)
        if not interview:
            raise HTTPException(404, "Interview not found")
        try:
            engine = self._ai_factory.from_session(session)
            result = engine.process_transcript(body.raw_content)
        except Exception as exc:
            raise HTTPException(502, f"AI error: {exc}") from exc

        interview.raw_content = body.raw_content
        interview.cleaned_transcript = result.get("cleaned_transcript")
        interview.ai_summary = result.get("summary")
        interview.extra_info = result.get("extra_info")
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview
