import unittest.mock as mock

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from candid.commons.models import Candidate, EmailLog
from candid.services.email_service import EmailService
from tests.conftest import TEST_ORG_ID


def _make_candidate(db) -> Candidate:
    candidate = Candidate(
        org_id=TEST_ORG_ID,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        status="screening",
    )
    with Session(db._engine) as session:
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return candidate


@pytest.fixture()
def candidate(db):
    return _make_candidate(db)


class TestEmailsListEndpoint:
    def test_list_emails_should_return_empty_when_no_emails(self, client: TestClient) -> None:
        response = client.get("/emails")
        assert response.status_code == 200
        data = response.json()
        assert data["emails"] == []
        assert data["total"] == 0

    def test_list_emails_should_filter_by_direction_when_direction_provided(
        self, client: TestClient, db
    ) -> None:
        with Session(db._engine) as session:
            session.add(EmailLog(org_id=TEST_ORG_ID, direction="sent", subject="Hi", to_email="a@b.com"))
            session.add(EmailLog(org_id=TEST_ORG_ID, direction="received", subject="Re: Hi", from_email="a@b.com"))
            session.commit()

        response = client.get("/emails?direction=sent")
        assert response.status_code == 200
        assert response.json()["total"] == 1
        assert response.json()["emails"][0]["direction"] == "sent"

    def test_list_emails_should_filter_by_candidate_when_candidate_id_provided(
        self, client: TestClient, db, candidate: Candidate
    ) -> None:
        with Session(db._engine) as session:
            session.add(EmailLog(org_id=TEST_ORG_ID, direction="sent", subject="Rejection", candidate_id=candidate.id, to_email=candidate.email))
            session.add(EmailLog(org_id=TEST_ORG_ID, direction="sent", subject="Other", to_email="other@x.com"))
            session.commit()

        response = client.get(f"/emails?candidate_id={candidate.id}")
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_list_emails_should_return_counts_by_direction(self, client: TestClient, db) -> None:
        with Session(db._engine) as session:
            session.add(EmailLog(org_id=TEST_ORG_ID, direction="sent", subject="A", to_email="a@b.com"))
            session.add(EmailLog(org_id=TEST_ORG_ID, direction="sent", subject="B", to_email="b@c.com"))
            session.add(EmailLog(org_id=TEST_ORG_ID, direction="received", subject="C", from_email="c@d.com"))
            session.commit()

        response = client.get("/emails")
        assert response.status_code == 200
        data = response.json()
        assert data["sent_count"] == 2
        assert data["received_count"] == 1


class TestLoggingEmailService:
    def _make_logging_svc(self, session, candidate_id=None):
        email_svc = EmailService("smtp.example.com", 587, "user", "pass", "from@org.com", "http://localhost")
        from candid.services.email_service import LoggingEmailService
        return LoggingEmailService(email_svc, session, TEST_ORG_ID, candidate_id)

    def test_send_email_should_create_email_log_when_send_succeeds(self, db) -> None:
        with Session(db._engine) as session:
            logging_svc = self._make_logging_svc(session)
            with mock.patch.object(EmailService, "send_email", return_value=None):
                logging_svc.send_email("to@example.com", "Subject", "Body")

        with Session(db._engine) as session:
            logs = session.exec(__import__("sqlmodel").select(EmailLog).where(EmailLog.org_id == TEST_ORG_ID)).all()
        assert len(logs) == 1
        assert logs[0].direction == "sent"
        assert logs[0].to_email == "to@example.com"
        assert logs[0].email_type == "general"

    def test_send_email_should_log_with_candidate_id_when_provided(self, db, candidate: Candidate) -> None:
        with Session(db._engine) as session:
            logging_svc = self._make_logging_svc(session, candidate_id=candidate.id)
            with mock.patch.object(EmailService, "send_email", return_value=None):
                logging_svc.send_email(candidate.email, "Rejection", "We regret…")

        with Session(db._engine) as session:
            logs = session.exec(__import__("sqlmodel").select(EmailLog).where(EmailLog.candidate_id == candidate.id)).all()
        assert len(logs) == 1

    def test_send_invitation_should_log_invitation_type(self, db) -> None:
        with Session(db._engine) as session:
            logging_svc = self._make_logging_svc(session)
            with mock.patch.object(EmailService, "send_invitation", return_value=None):
                logging_svc.send_invitation("invitee@example.com", "Acme", "Alice", "tok-abc")

        with Session(db._engine) as session:
            logs = session.exec(__import__("sqlmodel").select(EmailLog).where(EmailLog.org_id == TEST_ORG_ID)).all()
        assert len(logs) == 1
        assert logs[0].email_type == "invitation"

