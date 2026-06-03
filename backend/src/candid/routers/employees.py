from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import Employee, Notification
from candid.schemas import EmployeeCreate, EmployeeNotesUpdate, EmployeeReminderSet, EmployeeUpdate


class EmployeesRouter:
    def __init__(self, db: Database) -> None:
        self._db = db
        self.router = APIRouter(prefix="/employees", tags=["employees"])
        self._register()

    def _register(self) -> None:
        self._register_crud_routes()
        self._register_notes_route()
        self._register_reminder_routes()

    def _register_crud_routes(self) -> None:
        database = self._db

        @self.router.get("")
        def list_employees(
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return session.exec(select(Employee).where(Employee.org_id == user.org_id)).all()

        @self.router.post("", status_code=201)
        def create_employee(
            body: EmployeeCreate,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            employee = Employee(org_id=user.org_id, **body.model_dump())
            session.add(employee)
            session.commit()
            session.refresh(employee)
            return employee

        @self.router.patch("/{employee_id}")
        def update_employee(
            employee_id: str,
            body: EmployeeUpdate,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            employee = self._fetch(session, user.org_id, employee_id)
            for field_name, field_value in body.model_dump(exclude_none=True).items():
                setattr(employee, field_name, field_value)
            session.add(employee)
            session.commit()
            session.refresh(employee)
            return employee

        @self.router.delete("/{employee_id}", status_code=204)
        def delete_employee(
            employee_id: str,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            employee = self._fetch(session, user.org_id, employee_id)
            session.delete(employee)
            session.commit()

    def _register_notes_route(self) -> None:
        database = self._db

        @self.router.patch("/{employee_id}/notes")
        def update_notes(
            employee_id: str,
            body: EmployeeNotesUpdate,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            employee = self._fetch(session, user.org_id, employee_id)
            employee.notes = body.notes
            session.add(employee)
            session.commit()
            session.refresh(employee)
            return employee

    def _register_reminder_routes(self) -> None:
        database = self._db

        @self.router.post("/{employee_id}/reminder")
        def set_reminder(
            employee_id: str,
            body: EmployeeReminderSet,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            employee = self._fetch(session, user.org_id, employee_id)
            self._apply_reminder(session, employee, body.note)
            self._create_reminder_notification(session, user.org_id, employee)
            return employee

        @self.router.delete("/{employee_id}/reminder", status_code=204)
        def dismiss_reminder(
            employee_id: str,
            session: Session = Depends(database.get_session),
            user: UserCtx = Depends(require_org),
        ):
            employee = self._fetch(session, user.org_id, employee_id)
            self._clear_reminder(session, employee)

    def _apply_reminder(self, session: Session, employee: Employee, note: str) -> None:
        employee.reminder_note = note
        employee.reminder_active = True
        employee.reminder_created_at = datetime.now(timezone.utc).isoformat()
        session.add(employee)
        session.commit()
        session.refresh(employee)

    def _clear_reminder(self, session: Session, employee: Employee) -> None:
        employee.reminder_active = False
        employee.reminder_note = None
        employee.reminder_created_at = None
        session.add(employee)
        session.commit()

    def _create_reminder_notification(
        self, session: Session, org_id: str, employee: Employee
    ) -> None:
        full_name = f"{employee.first_name} {employee.last_name}"
        notification = Notification(
            org_id=org_id,
            notification_type="reminder",
            message=f"Reminder set for {full_name}: {employee.reminder_note}",
            reference_id=employee.id,
        )
        session.add(notification)
        session.commit()

    @staticmethod
    def _fetch(session: Session, org_id: str, employee_id: str) -> Employee:
        employee = session.get(Employee, employee_id)
        if not employee or employee.org_id != org_id:
            raise HTTPException(404, "Employee not found")
        return employee
