import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.models import Evaluation
from candid.schemas import EvaluationUpsert


class EvaluationsRouter:
    def __init__(self, db: Database) -> None:
        self._db = db
        self.router = APIRouter(prefix="/evaluations", tags=["evaluations"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/{candidate_id}")
        def get_evaluation(
            candidate_id: str,
            session: Session = Depends(db.get_session),
        ):
            return self._get(session, candidate_id)

        @self.router.post("/")
        def upsert_evaluation(
            body: EvaluationUpsert,
            session: Session = Depends(db.get_session),
        ):
            return self._upsert(session, body)

    # ── Implementations ────────────────────────────────────────────────────────

    def _get(self, session: Session, candidate_id: str) -> dict:
        evaluation = session.exec(
            select(Evaluation).where(Evaluation.candidate_id == candidate_id)
        ).first()
        if not evaluation:
            raise HTTPException(404, "Evaluation not found")
        return self._serialize(evaluation)

    def _upsert(self, session: Session, body: EvaluationUpsert) -> dict:
        evaluation = session.exec(
            select(Evaluation).where(Evaluation.candidate_id == body.candidate_id)
        ).first()
        if not evaluation:
            evaluation = Evaluation(candidate_id=body.candidate_id)

        evaluation.human_skills = json.dumps(body.human_skills or {})
        evaluation.technical_skills = json.dumps(body.technical_skills or {})
        evaluation.final_recommendation = body.final_recommendation
        evaluation.notes = body.notes

        session.add(evaluation)
        session.commit()
        session.refresh(evaluation)
        return self._serialize(evaluation)

    @staticmethod
    def _serialize(evaluation: Evaluation) -> dict:
        return {
            "id": evaluation.id,
            "candidate_id": evaluation.candidate_id,
            "human_skills": json.loads(evaluation.human_skills) if evaluation.human_skills else {},
            "technical_skills": json.loads(evaluation.technical_skills) if evaluation.technical_skills else {},
            "final_recommendation": evaluation.final_recommendation,
            "notes": evaluation.notes,
        }
