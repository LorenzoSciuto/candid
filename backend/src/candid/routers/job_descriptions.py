from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.models import JobDescription
from candid.schemas import (
    ImproveJDRequest,
    JobDescriptionCreate,
    JobDescriptionUpdate,
)
from candid.services.ai_engine import AIEngineFactory


class JobDescriptionsRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory) -> None:
        self._db = db
        self._ai_factory = ai_factory
        self.router = APIRouter(prefix="/job-descriptions", tags=["job-descriptions"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/")
        def list_jds(session: Session = Depends(db.get_session)):
            return self._list(session)

        @self.router.get("/{jd_id}")
        def get_jd(jd_id: str, session: Session = Depends(db.get_session)):
            return self._get(jd_id, session)

        @self.router.post("/", status_code=201)
        def create_jd(body: JobDescriptionCreate, session: Session = Depends(db.get_session)):
            return self._create(body, session)

        @self.router.patch("/{jd_id}")
        def update_jd(jd_id: str, body: JobDescriptionUpdate, session: Session = Depends(db.get_session)):
            return self._update(jd_id, body, session)

        @self.router.delete("/{jd_id}", status_code=204)
        def delete_jd(jd_id: str, session: Session = Depends(db.get_session)):
            self._delete(jd_id, session)

        @self.router.post("/improve-jd")
        def improve_jd(body: ImproveJDRequest, session: Session = Depends(db.get_session)):
            return self._improve(body, session)

    def _list(self, session: Session) -> list:
        return session.exec(select(JobDescription)).all()

    def _get(self, jd_id: str, session: Session) -> JobDescription:
        jd = session.get(JobDescription, jd_id)
        if not jd:
            raise HTTPException(status_code=404, detail="JD not found")
        return jd

    def _create(self, body: JobDescriptionCreate, session: Session) -> JobDescription:
        jd = JobDescription(**body.model_dump())
        session.add(jd)
        session.commit()
        session.refresh(jd)
        return jd

    def _update(self, jd_id: str, body: JobDescriptionUpdate, session: Session) -> JobDescription:
        jd = session.get(JobDescription, jd_id)
        if not jd:
            raise HTTPException(status_code=404, detail="JD not found")
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(jd, k, v)
        session.add(jd)
        session.commit()
        session.refresh(jd)
        return jd

    def _delete(self, jd_id: str, session: Session) -> None:
        jd = session.get(JobDescription, jd_id)
        if not jd:
            raise HTTPException(status_code=404, detail="JD not found")
        session.delete(jd)
        session.commit()

    def _improve(self, body: ImproveJDRequest, session: Session) -> dict:
        try:
            engine = self._ai_factory.from_session(session)
            improved = engine.improve_jd(body.text, body.role_name)
            return {"improved_text": improved}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
