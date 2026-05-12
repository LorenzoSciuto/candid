from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_user
from candid.models import Employee
from candid.schemas import EmployeeCreate, EmployeeUpdate


class EmployeesRouter:
    def __init__(self, db: Database) -> None:
        self._db = db
        self.router = APIRouter(prefix="/employees", tags=["employees"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/")
        def list_employees(
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            return session.exec(select(Employee).where(Employee.org_id == user.org_id)).all()

        @self.router.post("/", status_code=201)
        def create_employee(
            body: EmployeeCreate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            emp = Employee(org_id=user.org_id, **body.model_dump())
            session.add(emp)
            session.commit()
            session.refresh(emp)
            return emp

        @self.router.patch("/{employee_id}")
        def update_employee(
            employee_id: str,
            body: EmployeeUpdate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            emp = self._fetch(session, user.org_id, employee_id)
            for k, v in body.model_dump(exclude_none=True).items():
                setattr(emp, k, v)
            session.add(emp)
            session.commit()
            session.refresh(emp)
            return emp

        @self.router.delete("/{employee_id}", status_code=204)
        def delete_employee(
            employee_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_user),
        ):
            emp = self._fetch(session, user.org_id, employee_id)
            session.delete(emp)
            session.commit()

    @staticmethod
    def _fetch(session, org_id, employee_id) -> Employee:
        emp = session.get(Employee, employee_id)
        if not emp or emp.org_id != org_id:
            raise HTTPException(404, "Employee not found")
        return emp
