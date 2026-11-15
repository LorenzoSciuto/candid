from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org
from candid.commons.errors import ai_provider_error
from candid.commons.models import JobDescription, Role
from candid.commons.schemas import ImproveJDRequest, JobDescriptionCreate, JobDescriptionUpdate
from candid.commons.tenancy import get_in_org
from candid.services.ai_engine import AIEngineFactory


class JobDescriptionsRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory) -> None:
        self._db = db
        self._ai_factory = ai_factory
        self.router = APIRouter(prefix="/job-descriptions", tags=["job-descriptions"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("")
        def list_jds(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return session.exec(select(JobDescription).where(JobDescription.org_id == user.org_id)).all()

        @self.router.get("/{jd_id}")
        def get_jd(
            jd_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._fetch(session, user.org_id, jd_id)

        @self.router.post("", status_code=201)
        def create_jd(
            body: JobDescriptionCreate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            get_in_org(session, Role, body.role_id, user.org_id)
            jd = JobDescription(org_id=user.org_id, **body.model_dump())
            session.add(jd)
            session.commit()
            session.refresh(jd)
            return jd

        @self.router.patch("/{jd_id}")
        def update_jd(
            jd_id: str,
            body: JobDescriptionUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            jd = self._fetch(session, user.org_id, jd_id)
            for k, v in body.model_dump(exclude_none=True).items():
                setattr(jd, k, v)
            session.add(jd)
            session.commit()
            session.refresh(jd)
            return jd

        @self.router.delete("/{jd_id}", status_code=204)
        def delete_jd(
            jd_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            jd = self._fetch(session, user.org_id, jd_id)
            session.delete(jd)
            session.commit()

        @self.router.post("/improve-jd")
        def improve_jd(
            body: ImproveJDRequest,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            try:
                engine = self._ai_factory.from_session(session, user.org_id)
                return {"improved_text": engine.improve_jd(body.text, body.role_name)}
            except Exception as exc:
                raise ai_provider_error(exc) from exc

    @staticmethod
    def _fetch(session, org_id, jd_id) -> JobDescription:
        jd = session.get(JobDescription, jd_id)
        if not jd or jd.org_id != org_id:
            raise HTTPException(404, "JD not found")
        return jd
