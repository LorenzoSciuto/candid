import unittest.mock as mock

from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngine

class TestRewriteEndpoint:
    def test_rewrite_email_action(self, client: TestClient) -> None:
        ai_response = '{"result": "Hi there, we would love to chat!"}'
        with mock.patch.object(AIEngine, "_call", return_value=ai_response):
            resp = client.post("/ai/rewrite", json={
                "action": "rewrite_email",
                "text": "hey wanna talk about job",
                "to": "jane@example.com",
                "subject": "Opportunity",
            })
        assert resp.status_code == 200
        assert resp.json()["result"] == "Hi there, we would love to chat!"

    def test_rewrite_candidate_email_action(self, client: TestClient) -> None:
        ai_response = '{"result": "Dear Maya, we were impressed by your profile."}'
        with mock.patch.object(AIEngine, "_call", return_value=ai_response):
            resp = client.post("/ai/rewrite", json={
                "action": "rewrite_candidate_email",
                "text": "hey maya good job",
                "candidate_name": "Maya Chen",
                "role": "Staff Engineer",
            })
        assert resp.status_code == 200
        assert "Maya" in resp.json()["result"]

    def test_empty_text_returns_400(self, client: TestClient) -> None:
        resp = client.post("/ai/rewrite", json={
            "action": "rewrite_email",
            "text": "   ",
        })
        assert resp.status_code == 400

    def test_unknown_action_returns_400(self, client: TestClient) -> None:
        resp = client.post("/ai/rewrite", json={
            "action": "nonexistent_action",
            "text": "some text",
        })
        assert resp.status_code == 400

    def test_ai_error_returns_500(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", side_effect=RuntimeError("quota exceeded")):
            resp = client.post("/ai/rewrite", json={
                "action": "rewrite_email",
                "text": "hello",
            })
        assert resp.status_code == 500
