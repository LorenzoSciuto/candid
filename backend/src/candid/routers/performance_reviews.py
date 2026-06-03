from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Employee, PerformanceReview
from candid.prompts import Prompts
from candid.schemas import ImproveReviewTextRequest, PerformanceReviewCreate, PerformanceReviewUpdate
from candid.services.ai_engine import AIEngineFactory


class PerformanceReviewsRouter:
    def __init__(self, database: Database, ai_engine_factory: AIEngineFactory) -> None:
        self._db = database
        self._ai_engine_factory = ai_engine_factory
        self.router = APIRouter(
            prefix="/employees/{employee_id}/reviews",
            tags=["performance-reviews"],
        )
        self._register()

    def _register(self) -> None:
        database = self._db

        @self.router.get("")
        def list_reviews(
            employee_id: str,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            self._fetch_employee(session, user.org_id, employee_id)
            return self._query_reviews_for_employee(session, user.org_id, employee_id)

        @self.router.post("", status_code=201)
        def create_review(
            employee_id: str,
            body: PerformanceReviewCreate,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            self._fetch_employee(session, user.org_id, employee_id)
            review_record = PerformanceReview(
                org_id=user.org_id,
                employee_id=employee_id,
                **body.model_dump(),
            )
            session.add(review_record)
            session.commit()
            session.refresh(review_record)
            return review_record

        @self.router.post("/improve-text")
        def improve_text_stateless(
            employee_id: str,
            body: ImproveReviewTextRequest,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            self._fetch_employee(session, user.org_id, employee_id)
            improved = self._improve_text(session, user.org_id, body.text, body.field)
            return {"improved_text": improved}

        @self.router.get("/{review_id}")
        def get_review(
            employee_id: str,
            review_id: str,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            self._fetch_employee(session, user.org_id, employee_id)
            return self._fetch_review(session, user.org_id, employee_id, review_id)

        @self.router.patch("/{review_id}")
        def update_review(
            employee_id: str,
            review_id: str,
            body: PerformanceReviewUpdate,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            self._fetch_employee(session, user.org_id, employee_id)
            review_record = self._fetch_review(session, user.org_id, employee_id, review_id)
            for field_name, field_value in body.model_dump(exclude_none=True).items():
                setattr(review_record, field_name, field_value)
            session.add(review_record)
            session.commit()
            session.refresh(review_record)
            return review_record

        @self.router.delete("/{review_id}", status_code=204)
        def delete_review(
            employee_id: str,
            review_id: str,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            self._fetch_employee(session, user.org_id, employee_id)
            review_record = self._fetch_review(session, user.org_id, employee_id, review_id)
            session.delete(review_record)
            session.commit()

    def _improve_text(
        self,
        session: Session,
        org_id: str,
        text: str,
        field: str,
    ) -> str:
        if not text or not text.strip():
            raise HTTPException(422, "text is empty — nothing to improve")
        try:
            engine = self._ai_engine_factory.from_session(session, org_id)
            if field == "self_evaluation":
                prompt = Prompts.IMPROVE_SELF_EVALUATION.format(raw_text=text)
            else:
                prompt = Prompts.IMPROVE_REVIEW_MANAGER_FEEDBACK.format(raw_text=text)
            return engine.run_prompt(prompt, result_key="improved_text")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(502, f"AI engine error: {exc}") from exc

    @staticmethod
    def _fetch_employee(session: Session, org_id: str, employee_id: str) -> Employee:
        employee_record = session.get(Employee, employee_id)
        if not employee_record or employee_record.org_id != org_id:
            raise HTTPException(404, "Employee not found")
        return employee_record

    @staticmethod
    def _fetch_review(
        session: Session,
        org_id: str,
        employee_id: str,
        review_id: str,
    ) -> PerformanceReview:
        review_record = session.get(PerformanceReview, review_id)
        if not review_record or review_record.org_id != org_id or review_record.employee_id != employee_id:
            raise HTTPException(404, "Performance review not found")
        return review_record

    @staticmethod
    def _query_reviews_for_employee(
        session: Session,
        org_id: str,
        employee_id: str,
    ) -> list:
        return session.exec(
            select(PerformanceReview).where(
                PerformanceReview.org_id == org_id,
                PerformanceReview.employee_id == employee_id,
            )
        ).all()
