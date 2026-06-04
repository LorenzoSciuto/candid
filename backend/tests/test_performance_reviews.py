"""Tests for the PerformanceReviewsRouter."""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngineFactory

EMP_PAYLOAD = {
    "first_name": "Priya",
    "last_name": "Sharma",
    "email": "priya@company.io",
    "role_name": "Lead Engineer",
    "department": "Engineering",
}

REVIEW_PAYLOAD = {
    "period": "Q1-2026",
    "self_evaluation": "I delivered all my OKRs and mentored two juniors.",
    "manager_feedback": "Good delivery, could improve communication with stakeholders.",
    "rating": "Meets Expectations",
    "action_goals": '["Improve cross-team comms", "Lead one architecture review"]',
    "next_review_date": "2026-07-01",
}


@pytest.fixture(autouse=True)
def seeded_employee(client: TestClient):
    """Create a fresh employee before each test and expose its id."""
    response = client.post("/employees/", json=EMP_PAYLOAD)
    assert response.status_code == 201
    return response.json()


def _employee_id(client: TestClient) -> str:
    employees = client.get("/employees/").json()
    assert len(employees) == 1, "Expected exactly one seeded employee"
    return employees[0]["id"]


class TestListReviews:
    def test_list_reviews_should_return_empty_when_no_reviews_exist(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.get(f"/employees/{employee_id}/reviews")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_reviews_should_return_404_when_employee_not_found(self, client: TestClient) -> None:
        response = client.get("/employees/emp-notexist/reviews")
        assert response.status_code == 404


class TestCreateReview:
    def test_create_review_should_return_201_with_review_id(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.post(f"/employees/{employee_id}/reviews", json=REVIEW_PAYLOAD)
        assert response.status_code == 201
        review_data = response.json()
        assert review_data["id"].startswith("pr-")
        assert review_data["employee_id"] == employee_id

    def test_create_review_should_persist_all_fields_when_all_fields_provided(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.post(f"/employees/{employee_id}/reviews", json=REVIEW_PAYLOAD)
        assert response.status_code == 201
        review_data = response.json()
        assert review_data["period"] == REVIEW_PAYLOAD["period"]
        assert review_data["self_evaluation"] == REVIEW_PAYLOAD["self_evaluation"]
        assert review_data["manager_feedback"] == REVIEW_PAYLOAD["manager_feedback"]
        assert review_data["rating"] == REVIEW_PAYLOAD["rating"]
        assert review_data["action_goals"] == REVIEW_PAYLOAD["action_goals"]
        assert review_data["next_review_date"] == REVIEW_PAYLOAD["next_review_date"]
        assert review_data["created_at"] is not None

    def test_create_review_should_return_201_when_only_required_field_provided(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.post(f"/employees/{employee_id}/reviews", json={"period": "Q2-2026"})
        assert response.status_code == 201
        review_data = response.json()
        assert review_data["period"] == "Q2-2026"
        assert review_data["rating"] is None

    def test_create_review_should_return_404_when_employee_not_found(self, client: TestClient) -> None:
        response = client.post("/employees/emp-ghost/reviews", json=REVIEW_PAYLOAD)
        assert response.status_code == 404


class TestGetReview:
    def test_get_review_should_return_404_when_review_not_found(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.get(f"/employees/{employee_id}/reviews/pr-notexist")
        assert response.status_code == 404

    def test_get_review_should_return_review_when_review_exists(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        created = client.post(f"/employees/{employee_id}/reviews", json=REVIEW_PAYLOAD).json()
        response = client.get(f"/employees/{employee_id}/reviews/{created['id']}")
        assert response.status_code == 200
        assert response.json()["id"] == created["id"]


class TestUpdateReview:
    def test_update_review_should_update_fields_when_review_exists(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        created = client.post(f"/employees/{employee_id}/reviews", json=REVIEW_PAYLOAD).json()
        response = client.patch(
            f"/employees/{employee_id}/reviews/{created['id']}",
            json={"rating": "Exceeds Expectations"},
        )
        assert response.status_code == 200
        assert response.json()["rating"] == "Exceeds Expectations"

    def test_update_review_should_preserve_unchanged_fields_when_partial_update_provided(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        created = client.post(f"/employees/{employee_id}/reviews", json=REVIEW_PAYLOAD).json()
        client.patch(
            f"/employees/{employee_id}/reviews/{created['id']}",
            json={"rating": "Below Expectations"},
        )
        fetched = client.get(f"/employees/{employee_id}/reviews/{created['id']}").json()
        assert fetched["period"] == REVIEW_PAYLOAD["period"]
        assert fetched["self_evaluation"] == REVIEW_PAYLOAD["self_evaluation"]

    def test_update_review_should_return_404_when_review_not_found(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.patch(
            f"/employees/{employee_id}/reviews/pr-ghost",
            json={"rating": "Exceeds Expectations"},
        )
        assert response.status_code == 404


class TestDeleteReview:
    def test_delete_review_should_return_204_and_remove_review(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        created = client.post(f"/employees/{employee_id}/reviews", json=REVIEW_PAYLOAD).json()
        delete_response = client.delete(f"/employees/{employee_id}/reviews/{created['id']}")
        assert delete_response.status_code == 204
        get_response = client.get(f"/employees/{employee_id}/reviews/{created['id']}")
        assert get_response.status_code == 404

    def test_delete_review_should_return_404_when_review_not_found(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.delete(f"/employees/{employee_id}/reviews/pr-nope")
        assert response.status_code == 404


class TestImproveReviewText:
    def test_improve_review_text_should_return_improved_text_when_manager_feedback_field(
        self, client: TestClient, ai_factory: AIEngineFactory
    ) -> None:
        employee_id = _employee_id(client)
        mock_engine = MagicMock()
        mock_engine.run_prompt.return_value = "Structured professional feedback text."
        original_from_session = ai_factory.from_session
        ai_factory.from_session = MagicMock(return_value=mock_engine)

        try:
            response = client.post(
                f"/employees/{employee_id}/reviews/improve-text",
                json={"text": REVIEW_PAYLOAD["manager_feedback"], "field": "manager_feedback"},
            )
            assert response.status_code == 200
            assert response.json()["improved_text"] == "Structured professional feedback text."
        finally:
            ai_factory.from_session = original_from_session

    def test_improve_review_text_should_return_improved_text_when_self_evaluation_field(
        self, client: TestClient, ai_factory: AIEngineFactory
    ) -> None:
        employee_id = _employee_id(client)
        mock_engine = MagicMock()
        mock_engine.run_prompt.return_value = "Polished self-assessment paragraph."
        original_from_session = ai_factory.from_session
        ai_factory.from_session = MagicMock(return_value=mock_engine)

        try:
            response = client.post(
                f"/employees/{employee_id}/reviews/improve-text",
                json={"text": REVIEW_PAYLOAD["self_evaluation"], "field": "self_evaluation"},
            )
            assert response.status_code == 200
            assert response.json()["improved_text"] == "Polished self-assessment paragraph."
        finally:
            ai_factory.from_session = original_from_session

    def test_improve_review_text_should_return_502_when_ai_engine_raises_error(
        self, client: TestClient, ai_factory: AIEngineFactory
    ) -> None:
        employee_id = _employee_id(client)
        mock_engine = MagicMock()
        mock_engine.run_prompt.side_effect = RuntimeError("Provider unavailable")
        original_from_session = ai_factory.from_session
        ai_factory.from_session = MagicMock(return_value=mock_engine)

        try:
            response = client.post(
                f"/employees/{employee_id}/reviews/improve-text",
                json={"text": "Some feedback text.", "field": "manager_feedback"},
            )
            assert response.status_code == 502
        finally:
            ai_factory.from_session = original_from_session

    def test_improve_review_text_should_return_422_when_text_is_empty(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.post(
            f"/employees/{employee_id}/reviews/improve-text",
            json={"text": "", "field": "manager_feedback"},
        )
        assert response.status_code == 422

    def test_improve_review_text_should_return_422_when_text_is_whitespace_only(self, client: TestClient) -> None:
        employee_id = _employee_id(client)
        response = client.post(
            f"/employees/{employee_id}/reviews/improve-text",
            json={"text": "   ", "field": "self_evaluation"},
        )
        assert response.status_code == 422
