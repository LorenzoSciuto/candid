import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org
from candid.commons.errors import ai_provider_error
from candid.commons.models import Candidate, JobDescription
from candid.commons.pipeline import append_activity
from candid.commons.schemas import AnalyzeRequest
from candid.commons.uploads import MAX_CV_BYTES, read_limited
from candid.services.ai_engine import AIEngineFactory
from candid.services.cv_extractor import CVExtractor


class AnalysisRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory, extractor: CVExtractor) -> None:
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
            candidate_id: str | None = Form(None),
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return await self._upload_cv(file, candidate_id, user.org_id, session)

        @self.router.post("/analyze")
        def analyze(
            body: AnalyzeRequest,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._analyze(session, user.org_id, body)

    async def _upload_cv(self, file, candidate_id, org_id, session) -> dict:
        content = read_limited(file, MAX_CV_BYTES)
        try:
            text = self._extractor.extract(file.filename or "file.pdf", content)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        if candidate_id:
            c = session.get(Candidate, candidate_id)
            if c and c.org_id == org_id:
                c.cv_file = content
                c.cv_filename = file.filename
                append_activity(c, "cv_upload", f"CV uploaded: {file.filename}")
                session.add(c)
                session.commit()
        return {"filename": file.filename, "text": text, "word_count": len(text.split())}

    def _analyze(self, session, org_id, body: AnalyzeRequest) -> dict:
        active_jds = session.exec(
            select(JobDescription).where(
                JobDescription.org_id == org_id,
                JobDescription.status == "Active",
            )
        ).all()
        open_roles = [
            {"id": jd.id, "title": jd.title, "description": jd.description or ""}
            for jd in active_jds
        ]
        try:
            engine = self._ai_factory.from_session(session, org_id)
            result = engine.analyze_cv(
                cv_text=body.cv_text,
                position_name=body.job_title or "",
                jd_text=body.job_description,
                notes=body.notes,
                open_roles=open_roles or None,
            )
        except Exception as exc:
            raise ai_provider_error(exc) from exc
        if body.candidate_id:
            c = session.get(Candidate, body.candidate_id)
            if c and c.org_id == org_id:
                is_regen = c.ai_pre_analysis is not None
                c.ai_pre_analysis = json.dumps(result)
                c.cv_text = body.cv_text
                c.analysis_at = datetime.now(UTC).isoformat()
                role_fits = result.get("role_fits") or []
                if role_fits:
                    c.score = round(max(float(rf["score"]) for rf in role_fits if rf.get("score") is not None), 2)
                elif result.get("overall_score") is not None:
                    c.score = round(float(result["overall_score"]) / 2, 2)
                if body.job_title:
                    c.job_title = body.job_title
                if result.get("career_history"):
                    c.career_history = json.dumps(result["career_history"])
                extracted = result.get("extracted") or {}
                if extracted.get("role") and not c.current_role:
                    c.current_role = extracted["role"]
                note = "CV analysis regenerated" if is_regen else "CV analysis generated"
                append_activity(c, "analysis", note)
                session.add(c)
                session.commit()
        return result
