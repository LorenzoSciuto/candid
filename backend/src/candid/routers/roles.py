from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.models import Role
from candid.schemas import RoleCreate, RoleUpdate


class RolesRouter:
    def __init__(self, db: Database) -> None:
        self._db = db
        self.router = APIRouter(prefix="/roles", tags=["roles"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/")
        def list_roles(session: Session = Depends(db.get_session)):
            return self._list(session)

        @self.router.post("/", status_code=201)
        def create_role(body: RoleCreate, session: Session = Depends(db.get_session)):
            return self._create(body, session)

        @self.router.patch("/{role_id}")
        def update_role(role_id: str, body: RoleUpdate, session: Session = Depends(db.get_session)):
            return self._update(role_id, body, session)

        @self.router.delete("/{role_id}", status_code=204)
        def delete_role(role_id: str, session: Session = Depends(db.get_session)):
            self._delete(role_id, session)

    def _list(self, session: Session) -> list:
        return session.exec(select(Role)).all()

    def _create(self, body: RoleCreate, session: Session) -> Role:
        role = Role(**body.model_dump())
        session.add(role)
        session.commit()
        session.refresh(role)
        return role

    def _update(self, role_id: str, body: RoleUpdate, session: Session) -> Role:
        role = session.get(Role, role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(role, k, v)
        session.add(role)
        session.commit()
        session.refresh(role)
        return role

    def _delete(self, role_id: str, session: Session) -> None:
        role = session.get(Role, role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        session.delete(role)
        session.commit()
