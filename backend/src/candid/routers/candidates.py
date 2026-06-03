import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Candidate, Evaluation, Interview
from candid.schemas import CandidateCreate, CandidateUpdate
from candid.services.notification_service import NotificationService

_CV_MIME = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc":  "application/msword",
}


def _safe_dump(candidate: Candidate) -> dict:
    return candidate.model_dump(exclude={"cv_file"})


class CandidatesRouter:
    def __init__(self, db: Database, notification_service: NotificationService | None = None) -> None:
        self._db = db
        self._notification_service = notification_service or NotificationService()
        self.router = APIRouter(prefix="/candidates", tags=["candidates"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/stats")
        def candidate_stats(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._stats(session, user.org_id)

        @self.router.get("")
        def list_candidates(
            status: Optional[str] = None,
            q: Optional[str] = None,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._list(session, user.org_id, status, q)

        @self.router.post("", status_code=201)
        def create_candidate(
            body: CandidateCreate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._create(session, user, body)

        @self.router.get("/{candidate_id}/cv")
        def download_cv(
            candidate_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._download_cv(session, user.org_id, candidate_id)

        @self.router.get("/{candidate_id}")
        def get_candidate(
            candidate_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get(session, user.org_id, candidate_id)

        @self.router.patch("/{candidate_id}")
        def update_candidate(
            candidate_id: str,
            body: CandidateUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._update(session, user, candidate_id, body)

        @self.router.delete("/{candidate_id}", status_code=204)
        def delete_candidate(
            candidate_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            self._delete(session, user.org_id, candidate_id)

    # ── Implementations ────────────────────────────────────────────────────────

    def _list(self, session, org_id, status, q) -> list:
        candidates = session.exec(
            select(Candidate).where(Candidate.org_id == org_id)
        ).all()
        if status:
            candidates = [c for c in candidates if c.status == status]
        if q:
            ql = q.lower()
            candidates = [
                c for c in candidates
                if ql in f"{c.first_name} {c.last_name}".lower()
                or (c.email and ql in c.email.lower())
            ]

        evals = {
            e.candidate_id: e
            for e in session.exec(select(Evaluation).where(Evaluation.org_id == org_id)).all()
        }

        result = []
        for c in candidates:
            d = _safe_dump(c)
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
            d["eval_avg"] = None
            ev = evals.get(c.id)
            if ev:
                scores: list = []
                for sk_json in (ev.human_skills, ev.technical_skills):
                    if sk_json:
                        try:
                            scores.extend(
                                v for v in json.loads(sk_json).values()
                                if isinstance(v, (int, float)) and v > 0
                            )
                        except Exception:
                            pass
                if scores:
                    d["eval_avg"] = round(sum(scores) / len(scores), 1)
            result.append(d)
        return result

    def _create(self, session, user: UserCtx, body: CandidateCreate) -> dict:
        candidate = Candidate(org_id=user.org_id, **body.model_dump())
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        result = _safe_dump(candidate)
        self._notify_candidate_added(session, user, candidate)
        return result

    def _notify_candidate_added(self, session, user: UserCtx, candidate: Candidate) -> None:
        self._notification_service.create_candidate_added_notification(
            session=session,
            org_id=user.org_id,
            user_id=user.user_id,
            candidate_first_name=candidate.first_name,
            candidate_last_name=candidate.last_name,
            candidate_id=candidate.id,
        )

    def _download_cv(self, session, org_id, candidate_id) -> Response:
        candidate = self._fetch(session, org_id, candidate_id)
        if not candidate.cv_file:
            raise HTTPException(404, "No CV file stored for this candidate")
        filename = candidate.cv_filename or "cv"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
        media_type = _CV_MIME.get(ext, "application/octet-stream")
        return Response(
            content=candidate.cv_file,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    def _get(self, session, org_id, candidate_id) -> dict:
        candidate = self._fetch(session, org_id, candidate_id)
        result = _safe_dump(candidate)
        result["has_cv_file"] = bool(candidate.cv_file)

        result["interviews"] = [
            i.model_dump()
            for i in session.exec(
                select(Interview).where(
                    Interview.candidate_id == candidate_id,
                    Interview.org_id == org_id,
                )
            ).all()
        ]

        evaluation = session.exec(
            select(Evaluation).where(Evaluation.candidate_id == candidate_id)
        ).first()
        if evaluation:
            result["evaluation"] = {
                "human_skills": json.loads(evaluation.human_skills) if evaluation.human_skills else {},
                "technical_skills": json.loads(evaluation.technical_skills) if evaluation.technical_skills else {},
                "final_recommendation": evaluation.final_recommendation,
                "notes": evaluation.notes,
                "updated_at": evaluation.updated_at,
            }

        if candidate.ai_pre_analysis:
            result["ai_pre_analysis"] = json.loads(candidate.ai_pre_analysis)
        if candidate.career_history:
            result["career_history"] = json.loads(candidate.career_history)
        if candidate.status_history:
            result["status_history"] = json.loads(candidate.status_history)

        return result

    def _update(self, session, user: UserCtx, candidate_id, body: CandidateUpdate) -> dict:
        candidate = self._fetch(session, user.org_id, candidate_id)
        data = body.model_dump(exclude_none=True)
        if "status" in data and data["status"] != candidate.status:
            history = json.loads(candidate.status_history or "[]")
            history.append({
                "status": data["status"],
                "at": datetime.now(timezone.utc).isoformat(),
                "by": user.name,
            })
            candidate.status_history = json.dumps(history)
        for field, value in data.items():
            setattr(candidate, field, value)
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return _safe_dump(candidate)

    def _delete(self, session, org_id, candidate_id) -> None:
        candidate = self._fetch(session, org_id, candidate_id)
        for iv in session.exec(
            select(Interview).where(Interview.candidate_id == candidate_id)
        ).all():
            session.delete(iv)
        for ev in session.exec(
            select(Evaluation).where(Evaluation.candidate_id == candidate_id)
        ).all():
            session.delete(ev)
        session.flush()
        session.delete(candidate)
        session.commit()

    def _stats(self, session, org_id) -> dict:
        candidates = session.exec(
            select(Candidate).where(Candidate.org_id == org_id)
        ).all()
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

    @staticmethod
    def _fetch(session, org_id, candidate_id) -> Candidate:
        c = session.get(Candidate, candidate_id)
        if not c or c.org_id != org_id:
            raise HTTPException(404, "Candidate not found")
        return c
