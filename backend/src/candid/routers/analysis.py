import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Candidate, JobDescription
from candid.schemas import AnalyzeRequest
from candid.services.ai_engine import AIEngineFactory
from candid.services.cv_extractor import CVExtractor


def _append_activity(candidate: Candidate, event_type: str, note: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    log = json.loads(candidate.activity_log or "[]")
    log.append({"type": event_type, "at": now, "note": note})
    candidate.activity_log = json.dumps(log)


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
            candidate_id: Optional[str] = Form(None),
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
        content = await file.read()
        try:
            text = self._extractor.extract(file.filename or "file.pdf", content)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        if candidate_id:
            c = session.get(Candidate, candidate_id)
            if c and c.org_id == org_id:
                c.cv_file = content
                c.cv_filename = file.filename
                _append_activity(c, "cv_upload", f"CV uploaded: {file.filename}")
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
            raise HTTPException(502, f"AI error: {exc}") from exc
        if body.candidate_id:
            c = session.get(Candidate, body.candidate_id)
            if c and c.org_id == org_id:
                is_regen = c.ai_pre_analysis is not None
                c.ai_pre_analysis = json.dumps(result)
                c.cv_text = body.cv_text
                c.analysis_at = datetime.now(timezone.utc).isoformat()
                if body.job_title:
                    c.job_title = body.job_title
                if body.job_description:
                    c.job_description = body.job_description
                if result.get("career_history"):
                    c.career_history = json.dumps(result["career_history"])
                extracted = result.get("extracted") or {}
                if extracted.get("role") and not c.current_role:
                    c.current_role = extracted["role"]
                note = "CV analysis regenerated" if is_regen else "CV analysis generated"
                _append_activity(c, "analysis", note)
                session.add(c)
                session.commit()
        return result
