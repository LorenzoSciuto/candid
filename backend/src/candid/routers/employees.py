from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
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
        def list_employees(session: Session = Depends(db.get_session)):
            return self._list(session)

        @self.router.post("/", status_code=201)
        def create_employee(body: EmployeeCreate, session: Session = Depends(db.get_session)):
            return self._create(body, session)

        @self.router.patch("/{employee_id}")
        def update_employee(employee_id: str, body: EmployeeUpdate, session: Session = Depends(db.get_session)):
            return self._update(employee_id, body, session)

        @self.router.delete("/{employee_id}", status_code=204)
        def delete_employee(employee_id: str, session: Session = Depends(db.get_session)):
            self._delete(employee_id, session)

    def _list(self, session: Session) -> list:
        return session.exec(select(Employee)).all()

    def _create(self, body: EmployeeCreate, session: Session) -> Employee:
        emp = Employee(**body.model_dump())
        session.add(emp)
        session.commit()
        session.refresh(emp)
        return emp

    def _update(self, employee_id: str, body: EmployeeUpdate, session: Session) -> Employee:
        emp = session.get(Employee, employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(emp, k, v)
        session.add(emp)
        session.commit()
        session.refresh(emp)
        return emp

    def _delete(self, employee_id: str, session: Session) -> None:
        emp = session.get(Employee, employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        session.delete(emp)
        session.commit()
