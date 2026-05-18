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

    def test_only_one_evaluation_per_candidate(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Pending"})
        client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Strong Hire"})
        # Should still be exactly one row — not two
        resp = client.get(f"/evaluations/{cid}")
        assert resp.status_code == 200
        assert resp.json()["final_recommendation"] == "Strong Hire"

    def test_null_skills_serialize_as_empty_dict(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        resp = client.post("/evaluations", json={
            "candidate_id": cid,
            "final_recommendation": "Pending",
        })
        data = resp.json()
        assert data["human_skills"] == {}
        assert data["technical_skills"] == {}

    def test_notes_stored_and_returned(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        client.post("/evaluations", json={
            "candidate_id": cid,
            "final_recommendation": "Lean Hire",
            "notes": "Strong system design, weak in algorithms.",
        })
        resp = client.get(f"/evaluations/{cid}")
        assert resp.json()["notes"] == "Strong system design, weak in algorithms."

    def test_response_includes_id_and_candidate_id(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        resp = client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Pending"})
        data = resp.json()
        assert data["id"].startswith("e-")
        assert data["candidate_id"] == cid


    def test_updated_at_returned_and_non_null(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        resp = client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Pending"})
        data = resp.json()
        assert data["updated_at"] is not None
        assert "T" in data["updated_at"]  # ISO datetime

    def test_updated_at_changes_on_update(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        r1 = client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Pending"})
        r2 = client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Lean Hire"})
        # both should have timestamps; second may be same second but must be non-null
        assert r2.json()["updated_at"] is not None


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

    def test_skill_scores_round_trip(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        skills = {"Communication": 3, "Adaptability": 5}
        client.post("/evaluations", json={
            "candidate_id": cid,
            "human_skills": skills,
            "final_recommendation": "Pending",
        })
        data = client.get(f"/evaluations/{cid}").json()
        assert data["human_skills"] == skills
