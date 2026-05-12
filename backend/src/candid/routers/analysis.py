import json
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlmodel import Session, select

from candid.database import Database
from candid.models import Candidate, JobDescription
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
        async def upload_cv(
            file: UploadFile = File(...),
            candidate_id: Optional[str] = Form(None),
            session: Session = Depends(db.get_session),
        ):
            return await self._upload_cv(file, candidate_id, session)

        @self.router.post("/analyze")
        def analyze(
            body: AnalyzeRequest,
            session: Session = Depends(db.get_session),
        ):
            return self._analyze(session, body)

    # ── Implementations ────────────────────────────────────────────────────────

    async def _upload_cv(
        self, file: UploadFile, candidate_id: Optional[str], session: Session
    ) -> dict:
        content = await file.read()
        try:
            text = self._extractor.extract(file.filename or "file.pdf", content)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        if candidate_id:
            candidate = session.get(Candidate, candidate_id)
            if candidate:
                candidate.cv_file = content
                candidate.cv_filename = file.filename
                session.add(candidate)
                session.commit()
        return {
            "filename": file.filename,
            "text": text,
            "word_count": len(text.split()),
        }

    def _analyze(self, session: Session, body: AnalyzeRequest) -> dict:
        # Fetch active JDs for role-fit scoring
        active_jds = session.exec(
            select(JobDescription).where(JobDescription.status == "Active")
        ).all()
        open_roles = [
            {"id": jd.id, "title": jd.title, "description": jd.description or ""}
            for jd in active_jds
        ]

        try:
            engine = self._ai_factory.from_session(session)
            result = engine.analyze_cv(
                cv_text=body.cv_text,
                position_name=body.job_title or "",
                jd_text=body.job_description,
                notes=body.notes,
                open_roles=open_roles or None,
            )
        except Exception as exc:
            raise HTTPException(502, f"AI error: {exc}") from exc

        if body.candidate_id:
            candidate = session.get(Candidate, body.candidate_id)
            if candidate:
                candidate.ai_pre_analysis = json.dumps(result)
                candidate.cv_text = body.cv_text
                if body.job_title:
                    candidate.job_title = body.job_title
                if body.job_description:
                    candidate.job_description = body.job_description
                if result.get("career_history"):
                    candidate.career_history = json.dumps(result["career_history"])
                # Backfill current_role from extracted info if missing
                extracted = result.get("extracted") or {}
                if extracted.get("role") and not candidate.current_role:
                    candidate.current_role = extracted["role"]
                session.add(candidate)
                session.commit()

        return result
