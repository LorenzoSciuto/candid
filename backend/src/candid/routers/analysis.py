import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session

from candid.database import Database
from candid.models import Candidate
from candid.schemas import AnalyzeRequest
from candid.services.ai_engine import AIEngineFactory
from candid.services.cv_extractor import CVExtractor


class AnalysisRouter:
    def __init__(
        self,
        db: Database,
        ai_factory: AIEngineFactory,
        extractor: CVExtractor,
    ) -> None:
        self._db = db
        self._ai_factory = ai_factory
        self._extractor = extractor
        self.router = APIRouter(tags=["analysis"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.post("/upload-cv")
        async def upload_cv(file: UploadFile = File(...)):
            return await self._upload_cv(file)

        @self.router.post("/analyze")
        def analyze(
            body: AnalyzeRequest,
            session: Session = Depends(db.get_session),
        ):
            return self._analyze(session, body)

    # ── Implementations ────────────────────────────────────────────────────────

    async def _upload_cv(self, file: UploadFile) -> dict:
        content = await file.read()
        try:
            text = self._extractor.extract(file.filename or "file.pdf", content)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        return {
            "filename": file.filename,
            "text": text,
            "word_count": len(text.split()),
        }

    def _analyze(self, session: Session, body: AnalyzeRequest) -> dict:
        try:
            engine = self._ai_factory.from_session(session)
            result = engine.analyze_cv(
                cv_text=body.cv_text,
                jd_text=body.job_description,
                position_name=body.job_title,
            )
        except Exception as exc:
            raise HTTPException(502, f"AI error: {exc}") from exc

        if body.candidate_id:
            candidate = session.get(Candidate, body.candidate_id)
            if candidate:
                candidate.ai_pre_analysis = json.dumps(result)
                candidate.job_title = body.job_title
                candidate.job_description = body.job_description
                session.add(candidate)
                session.commit()

        return result
