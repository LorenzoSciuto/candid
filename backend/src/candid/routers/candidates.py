import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.models import Candidate, Evaluation, Interview
from candid.schemas import CandidateCreate, CandidateUpdate


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
        return candidates

    def _create(self, session: Session, body: CandidateCreate) -> Candidate:
        candidate = Candidate(**body.model_dump())
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return candidate

    def _get(self, session: Session, candidate_id: str) -> dict:
        candidate = session.get(Candidate, candidate_id)
        if not candidate:
            raise HTTPException(404, "Candidate not found")

        result = candidate.model_dump()

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

        return result

    def _update(
        self, session: Session, candidate_id: str, body: CandidateUpdate
    ) -> Candidate:
        candidate = session.get(Candidate, candidate_id)
        if not candidate:
            raise HTTPException(404, "Candidate not found")
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(candidate, field, value)
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return candidate

    def _delete(self, session: Session, candidate_id: str) -> None:
        candidate = session.get(Candidate, candidate_id)
        if not candidate:
            raise HTTPException(404, "Candidate not found")
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
