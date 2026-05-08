import unittest.mock as mock

from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngine

PARSED_RESPONSE = """{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@smith.com",
  "phone": "+1 555 000 1234",
  "current_role": "Senior Engineer at Acme",
  "years_of_experience": 6,
  "summary": "Strong backend engineer with distributed systems experience."
}"""


class TestQuickAdd:
    def test_returns_parsed_fields(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", return_value=PARSED_RESPONSE):
            resp = client.post("/quick-add", json={
                "text": "Jane Smith, jane@smith.com, 6 years backend at Acme"
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["first_name"] == "Jane"
        assert data["last_name"] == "Smith"
        assert data["years_of_experience"] == 6

    def test_ai_error_returns_502(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", side_effect=RuntimeError("AI down")):
            resp = client.post("/quick-add", json={"text": "some notes"})
        assert resp.status_code == 502
