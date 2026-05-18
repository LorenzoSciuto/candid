from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Interview
from candid.schemas import InterviewCreate, InterviewProcess, InterviewSummarize, InterviewUpdate
from candid.services.ai_engine import AIEngineFactory


class InterviewsRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory) -> None:
        self._db = db
        self._ai_factory = ai_factory
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
        try:
            engine = self._ai_factory.from_session(session, org_id)
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

    def _summarize(self, session, org_id, interview_id, body: InterviewSummarize) -> dict:
        self._fetch(session, org_id, interview_id)
        try:
            engine = self._ai_factory.from_session(session, org_id)
            result = engine.summarize_interview(body.text)
        except Exception as exc:
            raise HTTPException(502, f"AI error: {exc}") from exc
        return {"bullets": result.get("bullets", []), "summary": result.get("summary", "")}

    @staticmethod
    def _fetch(session, org_id, interview_id) -> Interview:
        iv = session.get(Interview, interview_id)
        if not iv or iv.org_id != org_id:
            raise HTTPException(404, "Interview not found")
        return iv
