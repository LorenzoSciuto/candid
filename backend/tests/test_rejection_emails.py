import json
import unittest.mock as mock

import pytest
from fastapi.testclient import TestClient

from candid.commons.models import Candidate
from candid.services.ai_engine import AIEngine
from candid.services.email_service import EmailService, EmailServiceFactory
from tests.conftest import TEST_ORG_ID

CANDIDATE_BASE = {
    "first_name": "Ada",
    "last_name": "Lovelace",
    "email": "ada@example.com",
    "status": "screening",
}

AI_ANALYSIS = {
    "overview": "Strong candidate with backend focus.",
    "strengths": ["Python", "System design"],
    "weaknesses": ["Lacks cloud experience", "Limited leadership history"],
    "questions": ["Tell me about your cloud projects."],
    "extracted": {},
    "career_history": [],
    "role_fits": [],
}

AI_REJECTION_RESPONSE = json.dumps({
    "subject": "Your application for Senior Engineer",
    "body": "Dear Ada,\n\nThank you for applying...\n\nUnfortunately...\n\nWe wish you well.",
})


def _make_candidate(db, ai_pre_analysis=None) -> Candidate:
    from sqlmodel import Session

    candidate = Candidate(
        org_id=TEST_ORG_ID,
        **CANDIDATE_BASE,
        ai_pre_analysis=json.dumps(ai_pre_analysis) if ai_pre_analysis else None,
    )
    with Session(db._engine) as session:
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return candidate


@pytest.fixture()
def candidate_with_analysis(db):
    return _make_candidate(db, ai_pre_analysis=AI_ANALYSIS)


@pytest.fixture()
def candidate_no_analysis(db):
    return _make_candidate(db, ai_pre_analysis=None)


class TestRejectionDraft:
    def test_rejection_draft_should_return_subject_and_body_when_candidate_has_analysis(
        self,
        client: TestClient,
        candidate_with_analysis: Candidate,
    ) -> None:
        with mock.patch.object(AIEngine, "_call", return_value=AI_REJECTION_RESPONSE):
            resp = client.post(
                f"/candidates/{candidate_with_analysis.id}/rejection-draft",
                json={"job_title": "Senior Engineer", "notes": ""},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "subject" in data
        assert "body" in data
        assert data["subject"] != ""
        assert data["body"] != ""

    def test_rejection_draft_should_return404_when_candidate_not_found(
        self,
        client: TestClient,
    ) -> None:
        resp = client.post(
            "/candidates/nonexistent-id/rejection-draft",
            json={"job_title": "Engineer"},
        )
        assert resp.status_code == 404

    def test_rejection_draft_should_handle_missing_analysis_gracefully(
        self,
        client: TestClient,
        candidate_no_analysis: Candidate,
    ) -> None:
        with mock.patch.object(AIEngine, "_call", return_value=AI_REJECTION_RESPONSE):
            resp = client.post(
                f"/candidates/{candidate_no_analysis.id}/rejection-draft",
                json={"job_title": "Engineer"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "subject" in data
        assert "body" in data

    def test_rejection_draft_should_pass_weaknesses_to_ai_when_analysis_present(
        self,
        client: TestClient,
        candidate_with_analysis: Candidate,
    ) -> None:
        captured_prompts: list[str] = []

        def capture_call(self_inner, prompt: str) -> str:
            captured_prompts.append(prompt)
            return AI_REJECTION_RESPONSE

        with mock.patch.object(AIEngine, "_call", capture_call):
            client.post(
                f"/candidates/{candidate_with_analysis.id}/rejection-draft",
                json={"job_title": "Senior Engineer"},
            )
        assert len(captured_prompts) == 1
        assert "Lacks cloud experience" in captured_prompts[0]


class TestRejectCandidate:
    def test_reject_should_update_status_to_rejected_when_called(
        self,
        client: TestClient,
        candidate_with_analysis: Candidate,
    ) -> None:
        resp = client.post(
            f"/candidates/{candidate_with_analysis.id}/reject",
            json={"subject": "Update", "body": "Sorry.", "send_email": False},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        detail = client.get(f"/candidates/{candidate_with_analysis.id}").json()
        assert detail["status"] == "Rejected"

    def test_reject_should_append_to_status_history_when_status_changes(
        self,
        client: TestClient,
        candidate_with_analysis: Candidate,
    ) -> None:
        client.post(
            f"/candidates/{candidate_with_analysis.id}/reject",
            json={"subject": "Update", "body": "Sorry.", "send_email": False},
        )
        detail = client.get(f"/candidates/{candidate_with_analysis.id}").json()
        history = detail.get("status_history", [])
        assert len(history) >= 1
        assert history[-1]["status"] == "Rejected"
        assert "at" in history[-1]

    def test_reject_should_send_email_when_smtp_configured_and_send_email_true(
        self,
        client: TestClient,
        candidate_with_analysis: Candidate,
    ) -> None:
        mock_email_svc = mock.MagicMock(spec=EmailService)
        with mock.patch.object(EmailServiceFactory, "from_session", return_value=mock_email_svc):
            resp = client.post(
                f"/candidates/{candidate_with_analysis.id}/reject",
                json={"subject": "Rejection", "body": "We regret…", "send_email": True},
            )
        assert resp.status_code == 200
        assert resp.json()["email_sent"] is True
        mock_email_svc.send_email.assert_called_once_with(
            CANDIDATE_BASE["email"],
            "Rejection",
            "We regret…",
        )

    def test_reject_should_not_send_email_when_send_email_false(
        self,
        client: TestClient,
        candidate_with_analysis: Candidate,
    ) -> None:
        mock_email_svc = mock.MagicMock(spec=EmailService)
        with mock.patch.object(EmailServiceFactory, "from_session", return_value=mock_email_svc):
            resp = client.post(
                f"/candidates/{candidate_with_analysis.id}/reject",
                json={"subject": "Rejection", "body": "We regret…", "send_email": False},
            )
        assert resp.status_code == 200
        assert resp.json()["email_sent"] is False
        mock_email_svc.send_email.assert_not_called()

    def test_reject_should_return200_with_email_sent_false_when_smtp_not_configured(
        self,
        client: TestClient,
        candidate_with_analysis: Candidate,
    ) -> None:
        with mock.patch.object(EmailServiceFactory, "from_session", return_value=None):
            resp = client.post(
                f"/candidates/{candidate_with_analysis.id}/reject",
                json={"subject": "Rejection", "body": "We regret…", "send_email": True},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["email_sent"] is False
        assert data.get("reason") == "SMTP not configured"

    def test_reject_should_return404_when_candidate_not_found(
        self,
        client: TestClient,
    ) -> None:
        resp = client.post(
            "/candidates/nonexistent-id/reject",
            json={"subject": "Rejection", "body": "We regret…", "send_email": False},
        )
        assert resp.status_code == 404
