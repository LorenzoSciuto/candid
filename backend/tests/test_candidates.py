import unittest.mock as mock

from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngine

CANDIDATE_PAYLOAD = {
    "first_name": "Maya",
    "last_name": "Chen",
    "email": "maya.chen@hey.com",
    "phone": "+1 (415) 555-0142",
    "current_role": "Staff Frontend Engineer",
    "years_of_experience": 7,
    "status": "new",
    "source": "Referral",
}


class TestCreateCandidate:
    def test_returns_201_with_id(self, client: TestClient) -> None:
        resp = client.post("/candidates", json=CANDIDATE_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"].startswith("c-")
        assert data["first_name"] == "Maya"

    def test_default_status_is_new(self, client: TestClient) -> None:
        resp = client.post("/candidates", json={"first_name": "John", "last_name": "Doe"})
        assert resp.status_code == 201
        assert resp.json()["status"] == "new"

    def test_applied_at_set_automatically(self, client: TestClient) -> None:
        resp = client.post("/candidates", json=CANDIDATE_PAYLOAD)
        assert resp.json()["applied_at"] != ""

    def test_cv_filename_stored(self, client: TestClient) -> None:
        payload = {**CANDIDATE_PAYLOAD, "cv_filename": "resume.pdf", "cv_text": "Jane Doe, engineer"}
        created = client.post("/candidates", json=payload).json()
        detail = client.get(f"/candidates/{created['id']}").json()
        assert detail["cv_filename"] == "resume.pdf"
        assert detail["cv_text"] == "Jane Doe, engineer"

    def test_optional_fields_nullable(self, client: TestClient) -> None:
        resp = client.post("/candidates", json={"first_name": "A", "last_name": "B"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] is None
        assert data["phone"] is None


class TestListCandidates:
    def test_returns_all(self, client: TestClient) -> None:
        client.post("/candidates", json=CANDIDATE_PAYLOAD)
        client.post("/candidates", json={**CANDIDATE_PAYLOAD, "first_name": "Daniel", "last_name": "Park", "email": "d@p.com"})
        resp = client.get("/candidates")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_filter_by_status(self, client: TestClient) -> None:
        client.post("/candidates", json=CANDIDATE_PAYLOAD)
        client.post("/candidates", json={**CANDIDATE_PAYLOAD, "first_name": "X", "last_name": "Y", "email": "x@y.com", "status": "screening"})
        resp = client.get("/candidates?status=screening")
        assert all(c["status"] == "screening" for c in resp.json())

    def test_search_by_name(self, client: TestClient) -> None:
        client.post("/candidates", json=CANDIDATE_PAYLOAD)
        resp = client.get("/candidates?q=maya")
        assert len(resp.json()) == 1
        assert resp.json()[0]["first_name"] == "Maya"

    def test_search_by_email(self, client: TestClient) -> None:
        client.post("/candidates", json=CANDIDATE_PAYLOAD)
        resp = client.get("/candidates?q=maya.chen")
        assert len(resp.json()) == 1

    def test_empty_list(self, client: TestClient) -> None:
        resp = client.get("/candidates")
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetCandidate:
    def test_returns_candidate_with_interviews(self, client: TestClient) -> None:
        created = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()
        resp = client.get(f"/candidates/{created['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == created["id"]
        assert "interviews" in data
        assert isinstance(data["interviews"], list)

    def test_includes_evaluation_when_present(self, client: TestClient) -> None:
        cid = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()["id"]
        client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Strong Hire"})
        data = client.get(f"/candidates/{cid}").json()
        assert data["evaluation"]["final_recommendation"] == "Strong Hire"

    def test_404_for_unknown_id(self, client: TestClient) -> None:
        resp = client.get("/candidates/nonexistent")
        assert resp.status_code == 404


class TestUpdateCandidate:
    def test_updates_status(self, client: TestClient) -> None:
        created = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()
        resp = client.patch(f"/candidates/{created['id']}", json={"status": "screening"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "screening"

    def test_partial_update_preserves_other_fields(self, client: TestClient) -> None:
        created = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()
        client.patch(f"/candidates/{created['id']}", json={"score": 4.5})
        resp = client.get(f"/candidates/{created['id']}")
        assert resp.json()["first_name"] == "Maya"
        assert resp.json()["score"] == 4.5

    def test_404_for_unknown_id(self, client: TestClient) -> None:
        resp = client.patch("/candidates/nonexistent", json={"status": "screening"})
        assert resp.status_code == 404


class TestStatusHistory:
    def test_first_status_change_creates_history(self, client: TestClient) -> None:
        cid = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()["id"]
        client.patch(f"/candidates/{cid}", json={"status": "screening"})
        data = client.get(f"/candidates/{cid}").json()
        history = data.get("status_history", [])
        assert len(history) == 1
        assert history[0]["status"] == "screening"
        assert "at" in history[0]

    def test_multiple_changes_append_in_order(self, client: TestClient) -> None:
        cid = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()["id"]
        client.patch(f"/candidates/{cid}", json={"status": "screening"})
        client.patch(f"/candidates/{cid}", json={"status": "pre"})
        client.patch(f"/candidates/{cid}", json={"status": "eval"})
        data = client.get(f"/candidates/{cid}").json()
        history = data.get("status_history", [])
        assert len(history) == 3
        assert [h["status"] for h in history] == ["screening", "pre", "eval"]

    def test_same_status_does_not_append(self, client: TestClient) -> None:
        cid = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()["id"]
        # status starts at "new" — patching to same value should not append
        client.patch(f"/candidates/{cid}", json={"status": "new"})
        data = client.get(f"/candidates/{cid}").json()
        assert data.get("status_history") in (None, [])

    def test_non_status_update_does_not_add_history(self, client: TestClient) -> None:
        cid = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()["id"]
        client.patch(f"/candidates/{cid}", json={"score": 4.2})
        data = client.get(f"/candidates/{cid}").json()
        assert data.get("status_history") in (None, [])


class TestDeleteCandidate:
    def test_returns_204(self, client: TestClient) -> None:
        created = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()
        resp = client.delete(f"/candidates/{created['id']}")
        assert resp.status_code == 204

    def test_gone_after_delete(self, client: TestClient) -> None:
        created = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()
        client.delete(f"/candidates/{created['id']}")
        assert client.get(f"/candidates/{created['id']}").status_code == 404

    def test_404_for_unknown_id(self, client: TestClient) -> None:
        resp = client.delete("/candidates/nonexistent")
        assert resp.status_code == 404

    def test_cascade_deletes_interviews(self, client: TestClient) -> None:
        cid = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()["id"]
        iid = client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"}).json()["id"]
        client.delete(f"/candidates/{cid}")
        # Interview must no longer exist
        resp = client.get(f"/interviews?candidate_id={cid}")
        assert resp.json() == []
        resp2 = client.patch(f"/interviews/{iid}", json={"duration": "1m"})
        assert resp2.status_code == 404

    def test_cascade_deletes_evaluation(self, client: TestClient) -> None:
        cid = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()["id"]
        client.post("/evaluations", json={"candidate_id": cid, "final_recommendation": "Strong Hire"})
        client.delete(f"/candidates/{cid}")
        assert client.get(f"/evaluations/{cid}").status_code == 404


class TestCandidateStats:
    def test_empty_db_returns_zero_total(self, client: TestClient) -> None:
        resp = client.get("/candidates/stats")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_counts_active_candidates(self, client: TestClient) -> None:
        client.post("/candidates", json=CANDIDATE_PAYLOAD)
        client.post("/candidates", json={**CANDIDATE_PAYLOAD, "email": "b@b.com"})
        resp = client.get("/candidates/stats")
        assert resp.json()["total"] == 2

    def test_excludes_archived(self, client: TestClient) -> None:
        created = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()
        client.patch(f"/candidates/{created['id']}", json={"status": "archived"})
        assert client.get("/candidates/stats").json()["total"] == 0

    def test_excludes_hired(self, client: TestClient) -> None:
        created = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()
        client.patch(f"/candidates/{created['id']}", json={"status": "hired"})
        assert client.get("/candidates/stats").json()["total"] == 0

    def test_by_status_breakdown(self, client: TestClient) -> None:
        client.post("/candidates", json=CANDIDATE_PAYLOAD)
        c2 = client.post("/candidates", json={**CANDIDATE_PAYLOAD, "email": "x@x.com"}).json()
        client.patch(f"/candidates/{c2['id']}", json={"status": "screening"})
        stats = client.get("/candidates/stats").json()
        assert stats["by_status"]["new"] == 1
        assert stats["by_status"]["screening"] == 1

    def test_by_source_breakdown(self, client: TestClient) -> None:
        client.post("/candidates", json=CANDIDATE_PAYLOAD)
        client.post("/candidates", json={**CANDIDATE_PAYLOAD, "email": "b@b.com", "source": "LinkedIn"})
        stats = client.get("/candidates/stats").json()
        assert stats["by_source"]["Referral"] == 1
        assert stats["by_source"]["LinkedIn"] == 1

    def test_avg_score_computed(self, client: TestClient) -> None:
        c1 = client.post("/candidates", json=CANDIDATE_PAYLOAD).json()
        c2 = client.post("/candidates", json={**CANDIDATE_PAYLOAD, "email": "x@x.com"}).json()
        client.patch(f"/candidates/{c1['id']}", json={"score": 4.0})
        client.patch(f"/candidates/{c2['id']}", json={"score": 2.0})
        stats = client.get("/candidates/stats").json()
        assert stats["avg_score"] == 3.0

    def test_avg_score_none_when_no_scores(self, client: TestClient) -> None:
        client.post("/candidates", json=CANDIDATE_PAYLOAD)
        assert client.get("/candidates/stats").json()["avg_score"] is None
