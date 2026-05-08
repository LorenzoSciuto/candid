import unittest.mock as mock

from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngine


def _make_candidate(client: TestClient) -> str:
    resp = client.post("/candidates", json={"first_name": "A", "last_name": "B"})
    return resp.json()["id"]


class TestCreateInterview:
    def test_creates_with_candidate_id(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        resp = client.post("/interviews", json={
            "candidate_id": cid,
            "type": "Manual Paste",
            "title": "Recruiter Screen",
            "interviewer": "Devon Park",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"].startswith("i-")
        assert data["candidate_id"] == cid


class TestListInterviews:
    def test_filters_by_candidate(self, client: TestClient) -> None:
        cid1 = _make_candidate(client)
        cid2 = _make_candidate(client)
        client.post("/interviews", json={"candidate_id": cid1, "type": "Manual Paste"})
        client.post("/interviews", json={"candidate_id": cid2, "type": "Live Recording"})

        resp = client.get(f"/interviews?candidate_id={cid1}")
        assert all(i["candidate_id"] == cid1 for i in resp.json())

    def test_returns_all_without_filter(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"})
        client.post("/interviews", json={"candidate_id": cid, "type": "Live Recording"})
        resp = client.get("/interviews")
        assert len(resp.json()) == 2


class TestUpdateInterview:
    def test_updates_fields(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        created = client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"}).json()
        resp = client.patch(f"/interviews/{created['id']}", json={"duration": "42m", "title": "Tech Screen"})
        assert resp.status_code == 200
        assert resp.json()["duration"] == "42m"

    def test_404_for_unknown(self, client: TestClient) -> None:
        resp = client.patch("/interviews/nonexistent", json={"duration": "10m"})
        assert resp.status_code == 404


class TestProcessInterview:
    _AI_RESPONSE = """{
        "cleaned_transcript": "[Interviewer]: Tell me about yourself.\\n[Candidate]: Sure.",
        "summary": "Candidate showed good communication skills.",
        "extra_info": "Mentioned distributed systems experience."
    }"""

    def test_stores_cleaned_transcript_and_summary(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        iid = client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"}).json()["id"]
        with mock.patch.object(AIEngine, "_call", return_value=self._AI_RESPONSE):
            resp = client.post(f"/interviews/{iid}/process", json={
                "raw_content": "Interviewer: Tell me about yourself. Candidate: Sure."
            })
        assert resp.status_code == 200
        data = resp.json()
        assert "Interviewer" in data["cleaned_transcript"]
        assert data["ai_summary"] == "Candidate showed good communication skills."

    def test_404_for_unknown_interview(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", return_value=self._AI_RESPONSE):
            resp = client.post("/interviews/nonexistent/process", json={"raw_content": "x"})
        assert resp.status_code == 404

    def test_ai_error_returns_502(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        iid = client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"}).json()["id"]
        with mock.patch.object(AIEngine, "_call", side_effect=RuntimeError("AI down")):
            resp = client.post(f"/interviews/{iid}/process", json={"raw_content": "some text"})
        assert resp.status_code == 502
