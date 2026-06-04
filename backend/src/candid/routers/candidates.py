import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Candidate, Evaluation, Interview
from candid.schemas import CandidateCreate, CandidateUpdate
from candid.services.ai_engine import AIEngineFactory
from candid.services.email_service import EmailService
from candid.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

_CV_MIME = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc":  "application/msword",
}


def _safe_dump(candidate: Candidate) -> dict:
    return candidate.model_dump(exclude={"cv_file"})


class RejectionDraftRequest(BaseModel):
    job_title: str = ""
    notes: str = ""


class RejectRequest(BaseModel):
    subject: str = ""
    body: str = ""
    send_email: bool = False


class CandidatesRouter:
    def __init__(
        self,
        db: Database,
        notification_service: NotificationService | None = None,
        ai_engine_factory: Optional[AIEngineFactory] = None,
        email_service: Optional[EmailService] = None,
    ) -> None:
        self._db = db
        self._notification_service = notification_service or NotificationService()
        self._ai_factory = ai_engine_factory
        self._email = email_service
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

        @self.router.post("/{candidate_id}/rejection-draft")
        def rejection_draft(
            candidate_id: str,
            body: RejectionDraftRequest,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._rejection_draft(session, user.org_id, candidate_id, body)

        @self.router.post("/{candidate_id}/reject")
        def reject_candidate(
            candidate_id: str,
            body: RejectRequest,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._reject(session, user, candidate_id, body)

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
        safe_filename = filename.replace('"', "").replace("\n", "").replace("\r", "")
        ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else "bin"
        media_type = _CV_MIME.get(ext, "application/octet-stream")
        return Response(
            content=candidate.cv_file,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
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
            select(Evaluation).where(
                Evaluation.candidate_id == candidate_id,
                Evaluation.org_id == org_id,
            )
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
        if candidate.activity_log:
            result["activity_log"] = json.loads(candidate.activity_log)
        result["analysis_at"] = candidate.analysis_at

        return result

    def _update(self, session, user: UserCtx, candidate_id, body: CandidateUpdate) -> dict:
        candidate = self._fetch(session, user.org_id, candidate_id)
        data = body.model_dump(exclude_none=True)
        if "status" in data and data["status"] != candidate.status:
            now = datetime.now(timezone.utc).isoformat()
            history = json.loads(candidate.status_history or "[]")
            history.append({"status": data["status"], "at": now, "by": user.name})
            candidate.status_history = json.dumps(history)
            log = json.loads(candidate.activity_log or "[]")
            log.append({"type": "stage", "at": now, "note": f"Stage moved to {data['status']}", "by": user.name})
            candidate.activity_log = json.dumps(log)
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

    def _rejection_draft(
        self,
        session: Session,
        org_id: str,
        candidate_id: str,
        body: RejectionDraftRequest,
    ) -> dict:
        candidate = self._fetch(session, org_id, candidate_id)
        if not self._ai_factory:
            raise HTTPException(503, "AI engine not configured")
        weaknesses = self._extract_weaknesses(candidate)
        candidate_name = f"{candidate.first_name} {candidate.last_name}"
        job_title = body.job_title or candidate.job_title or "the position"
        engine = self._ai_factory.from_session(session, org_id)
        return engine.generate_rejection_email(candidate_name, job_title, weaknesses, body.notes)

    def _extract_weaknesses(self, candidate: Candidate) -> list[str]:
        if not candidate.ai_pre_analysis:
            return []
        try:
            analysis = json.loads(candidate.ai_pre_analysis)
            return analysis.get("weaknesses", [])
        except Exception:
            return []

    def _reject(
        self,
        session: Session,
        user: UserCtx,
        candidate_id: str,
        body: RejectRequest,
    ) -> dict:
        candidate = self._fetch(session, user.org_id, candidate_id)
        self._apply_rejection_status(session, candidate, user)
        email_sent = self._maybe_send_rejection_email(candidate, body)
        if body.send_email and not email_sent:
            return {"ok": True, "email_sent": False, "reason": "SMTP not configured"}
        return {"ok": True, "email_sent": email_sent}

    def _apply_rejection_status(
        self,
        session: Session,
        candidate: Candidate,
        user: UserCtx,
    ) -> None:
        history = json.loads(candidate.status_history or "[]")
        history.append({
            "status": "Rejected",
            "at": datetime.now(timezone.utc).isoformat(),
            "by": user.name,
        })
        candidate.status = "Rejected"
        candidate.status_history = json.dumps(history)
        session.add(candidate)
        session.commit()
        session.refresh(candidate)

    def _maybe_send_rejection_email(self, candidate: Candidate, body: RejectRequest) -> bool:
        if not body.send_email:
            return False
        if not self._email or not self._email.is_configured():
            return False
        if not candidate.email:
            return False
        try:
            self._email.send_email(candidate.email, body.subject, body.body)
            return True
        except Exception:
            logger.exception("Failed to send rejection email to %s", candidate.email)
            return False

    @staticmethod
    def _fetch(session, org_id, candidate_id) -> Candidate:
        candidate_record = session.get(Candidate, candidate_id)
        if not candidate_record or candidate_record.org_id != org_id:
            raise HTTPException(404, "Candidate not found")
        return candidate_record
