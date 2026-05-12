import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlmodel import Session, select

from candid.database import Database
from candid.models import Candidate, Evaluation, Interview
from candid.schemas import CandidateCreate, CandidateUpdate

_CV_MIME = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc":  "application/msword",
}

def _safe_dump(candidate: Candidate) -> dict:
    """model_dump excluding the large binary cv_file field."""
    return candidate.model_dump(exclude={"cv_file"})


class CandidatesRouter:
    def __init__(self, db: Database) -> None:
        self._db = db
        self.router = APIRouter(prefix="/candidates", tags=["candidates"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/stats")
        def candidate_stats(session: Session = Depends(db.get_session)):
            return self._stats(session)

        @self.router.get("/")
        def list_candidates(
            status: Optional[str] = None,
            q: Optional[str] = None,
            session: Session = Depends(db.get_session),
        ):
            return self._list(session, status, q)

        @self.router.post("/", status_code=201)
        def create_candidate(
            body: CandidateCreate,
            session: Session = Depends(db.get_session),
        ):
            return self._create(session, body)

        @self.router.get("/{candidate_id}/cv")
        def download_cv(
            candidate_id: str,
            session: Session = Depends(db.get_session),
        ):
            return self._download_cv(session, candidate_id)

        @self.router.get("/{candidate_id}")
        def get_candidate(
            candidate_id: str,
            session: Session = Depends(db.get_session),
        ):
            return self._get(session, candidate_id)

        @self.router.patch("/{candidate_id}")
        def update_candidate(
            candidate_id: str,
            body: CandidateUpdate,
            session: Session = Depends(db.get_session),
        ):
            return self._update(session, candidate_id, body)

        @self.router.delete("/{candidate_id}", status_code=204)
        def delete_candidate(
            candidate_id: str,
            session: Session = Depends(db.get_session),
        ):
            return self._delete(session, candidate_id)

    # ── Implementations ────────────────────────────────────────────────────────

    def _list(
        self,
        session: Session,
        status: Optional[str],
        q: Optional[str],
    ) -> list:
        candidates = session.exec(select(Candidate)).all()
        if status:
            candidates = [c for c in candidates if c.status == status]
        if q:
            ql = q.lower()
            candidates = [
                c for c in candidates
                if ql in f"{c.first_name} {c.last_name}".lower()
                or (c.email and ql in c.email.lower())
            ]

        # Batch-load evaluations to avoid N+1
        evals = {e.candidate_id: e for e in session.exec(select(Evaluation)).all()}

        result = []
        for c in candidates:
            d = _safe_dump(c)
            # Computed: best AI role-fit score
            d["has_ai"] = False
            d["ai_score"] = None
            if c.ai_pre_analysis:
                try:
                    pre = json.loads(c.ai_pre_analysis)
                    role_fits = pre.get("role_fits") or []
                    d["has_ai"] = True
                    d["ai_score"] = max((rf["score"] for rf in role_fits), default=None)
                except Exception:
                    pass
            # Computed: average manual evaluation score
            d["eval_avg"] = None
            ev = evals.get(c.id)
            if ev:
                scores: list = []
                for sk_json in (ev.human_skills, ev.technical_skills):
                    if sk_json:
                        try:
                            scores.extend(v for v in json.loads(sk_json).values() if isinstance(v, (int, float)) and v > 0)
                        except Exception:
                            pass
                if scores:
                    d["eval_avg"] = round(sum(scores) / len(scores), 1)
            result.append(d)
        return result

    def _create(self, session: Session, body: CandidateCreate) -> dict:
        candidate = Candidate(**body.model_dump())
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return _safe_dump(candidate)

    def _download_cv(self, session: Session, candidate_id: str) -> Response:
        candidate = session.get(Candidate, candidate_id)
        if not candidate or not candidate.cv_file:
            raise HTTPException(404, "No CV file stored for this candidate")
        filename = candidate.cv_filename or "cv"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
        media_type = _CV_MIME.get(ext, "application/octet-stream")
        return Response(
            content=candidate.cv_file,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    def _get(self, session: Session, candidate_id: str) -> dict:
        candidate = session.get(Candidate, candidate_id)
        if not candidate:
            raise HTTPException(404, "Candidate not found")

        result = _safe_dump(candidate)
        result["has_cv_file"] = bool(candidate.cv_file)

        interviews = session.exec(
            select(Interview).where(Interview.candidate_id == candidate_id)
        ).all()
        result["interviews"] = [i.model_dump() for i in interviews]

        evaluation = session.exec(
            select(Evaluation).where(Evaluation.candidate_id == candidate_id)
        ).first()
        if evaluation:
            result["evaluation"] = {
                "human_skills": json.loads(evaluation.human_skills) if evaluation.human_skills else {},
                "technical_skills": json.loads(evaluation.technical_skills) if evaluation.technical_skills else {},
                "final_recommendation": evaluation.final_recommendation,
                "notes": evaluation.notes,
            }

        if candidate.ai_pre_analysis:
            result["ai_pre_analysis"] = json.loads(candidate.ai_pre_analysis)

        if candidate.career_history:
            result["career_history"] = json.loads(candidate.career_history)

        if candidate.status_history:
            result["status_history"] = json.loads(candidate.status_history)

        return result

    def _update(
        self, session: Session, candidate_id: str, body: CandidateUpdate
    ) -> dict:
        candidate = session.get(Candidate, candidate_id)
        if not candidate:
            raise HTTPException(404, "Candidate not found")
        data = body.model_dump(exclude_none=True)
        if "status" in data and data["status"] != candidate.status:
            history = json.loads(candidate.status_history or "[]")
            history.append({
                "status": data["status"],
                "at": datetime.now(timezone.utc).isoformat(),
            })
            candidate.status_history = json.dumps(history)
        for field, value in data.items():
            setattr(candidate, field, value)
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return _safe_dump(candidate)

    def _delete(self, session: Session, candidate_id: str) -> None:
        candidate = session.get(Candidate, candidate_id)
        if not candidate:
            raise HTTPException(404, "Candidate not found")
        for iv in session.exec(select(Interview).where(Interview.candidate_id == candidate_id)).all():
            session.delete(iv)
        for ev in session.exec(select(Evaluation).where(Evaluation.candidate_id == candidate_id)).all():
            session.delete(ev)
        session.flush()  # send child deletes to DB before removing parent
        session.delete(candidate)
        session.commit()

    def _stats(self, session: Session) -> dict:
        candidates = session.exec(select(Candidate)).all()
        active = [c for c in candidates if c.status not in ("archived", "hired")]
        by_status: dict = {}
        for c in active:
            by_status[c.status] = by_status.get(c.status, 0) + 1
        by_source: dict = {}
        for c in active:
            src = c.source or "Unknown"
            by_source[src] = by_source.get(src, 0) + 1
        scores = [c.score for c in active if c.score is not None]
        return {
            "total": len(active),
            "by_status": by_status,
            "by_source": by_source,
            "avg_score": round(sum(scores) / len(scores), 2) if scores else None,
        }
