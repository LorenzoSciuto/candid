import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_user
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
            user: UserCtx = Depends(require_user),
        ):
            return self._get(session, user.org_id, candidate_id)

        @self.router.post("/")
        def upsert_evaluation(
            body: EvaluationUpsert,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            return self._upsert(session, user.org_id, body)

    def _get(self, session, org_id, candidate_id) -> dict:
        ev = session.exec(
            select(Evaluation).where(
                Evaluation.candidate_id == candidate_id,
                Evaluation.org_id == org_id,
            )
        ).first()
        if not ev:
            raise HTTPException(404, "Evaluation not found")
        return self._serialize(ev)

    def _upsert(self, session, org_id, body: EvaluationUpsert) -> dict:
        ev = session.exec(
            select(Evaluation).where(Evaluation.candidate_id == body.candidate_id)
        ).first()
        if not ev:
            ev = Evaluation(candidate_id=body.candidate_id, org_id=org_id)
        ev.human_skills = json.dumps(body.human_skills or {})
        ev.technical_skills = json.dumps(body.technical_skills or {})
        ev.final_recommendation = body.final_recommendation
        ev.notes = body.notes
        session.add(ev)
        session.commit()
        session.refresh(ev)
        return self._serialize(ev)

    @staticmethod
    def _serialize(ev: Evaluation) -> dict:
        return {
            "id": ev.id,
            "candidate_id": ev.candidate_id,
            "human_skills": json.loads(ev.human_skills) if ev.human_skills else {},
            "technical_skills": json.loads(ev.technical_skills) if ev.technical_skills else {},
            "final_recommendation": ev.final_recommendation,
            "notes": ev.notes,
        }
