from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_user
from candid.models import Role
from candid.schemas import ImproveJDRequest, RoleCreate, RoleUpdate
from candid.services.ai_engine import AIEngineFactory


class RolesRouter:
    def __init__(self, db: Database, ai_factory: AIEngineFactory) -> None:
        self._db = db
        self._ai_factory = ai_factory
        self.router = APIRouter(prefix="/roles", tags=["roles"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/")
        def list_roles(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            return session.exec(select(Role).where(Role.org_id == user.org_id)).all()

        @self.router.post("/improve-description")
        def improve_description(
            body: ImproveJDRequest,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            try:
                engine = self._ai_factory.from_session(session, user.org_id)
                return {"improved_text": engine.improve_role_description(body.text, body.role_name)}
            except Exception as exc:
                raise HTTPException(500, str(exc)) from exc

        @self.router.post("/", status_code=201)
        def create_role(
            body: RoleCreate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            role = Role(org_id=user.org_id, **body.model_dump())
            session.add(role)
            session.commit()
            session.refresh(role)
            return role

        @self.router.patch("/{role_id}")
        def update_role(
            role_id: str,
            body: RoleUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            role = self._fetch(session, user.org_id, role_id)
            for k, v in body.model_dump(exclude_none=True).items():
                setattr(role, k, v)
            session.add(role)
            session.commit()
            session.refresh(role)
            return role

        @self.router.delete("/{role_id}", status_code=204)
        def delete_role(
            role_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            role = self._fetch(session, user.org_id, role_id)
            session.delete(role)
            session.commit()

    @staticmethod
    def _fetch(session, org_id, role_id) -> Role:
        r = session.get(Role, role_id)
        if not r or r.org_id != org_id:
            raise HTTPException(404, "Role not found")
        return r
