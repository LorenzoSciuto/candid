from fastapi.testclient import TestClient


def _make_candidate(client: TestClient) -> str:
    return client.post("/candidates", json={"first_name": "A", "last_name": "B"}).json()["id"]


class TestUpsertEvaluation:
    def test_creates_evaluation(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        resp = client.post("/evaluations", json={
            "candidate_id": cid,
            "human_skills": {"Communication": 5, "Problem Solving": 4},
            "technical_skills": {"Domain Knowledge": 5},
            "final_recommendation": "Strong Hire",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["final_recommendation"] == "Strong Hire"
        assert data["human_skills"]["Communication"] == 5

    def test_upsert_updates_existing(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Pending"})
        resp = client.post("/evaluations", json={
            "candidate_id": cid,
            "final_recommendation": "Lean Hire",
        })
        assert resp.json()["final_recommendation"] == "Lean Hire"


class TestGetEvaluation:
    def test_retrieves_after_create(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Strong Hire"})
        resp = client.get(f"/evaluations/{cid}")
        assert resp.status_code == 200
        assert resp.json()["final_recommendation"] == "Strong Hire"

    def test_404_when_missing(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        resp = client.get(f"/evaluations/{cid}")
        assert resp.status_code == 404
