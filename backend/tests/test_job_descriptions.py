import unittest.mock as mock

from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngine


def _make_role(client: TestClient) -> str:
    return client.post("/roles/", json={"name": "Engineer"}).json()["id"]


JD_PAYLOAD = {
    "title": "Senior Backend Engineer",
    "description": "Build scalable APIs and data pipelines.",
    "location": "Remote",
    "remote_ok": True,
    "status": "Draft",
    "openings": 2,
}


class TestCreateJD:
    def test_returns_201_with_id(self, client: TestClient) -> None:
        role_id = _make_role(client)
        resp = client.post("/job-descriptions/", json={**JD_PAYLOAD, "role_id": role_id})
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"].startswith("jd-")
        assert data["title"] == "Senior Backend Engineer"

    def test_default_status_is_draft(self, client: TestClient) -> None:
        role_id = _make_role(client)
        resp = client.post("/job-descriptions/", json={"role_id": role_id, "title": "PM"})
        assert resp.json()["status"] == "Draft"

    def test_openings_defaults_to_one(self, client: TestClient) -> None:
        role_id = _make_role(client)
        resp = client.post("/job-descriptions/", json={"role_id": role_id, "title": "Designer"})
        assert resp.json()["openings"] == 1


class TestListJDs:
    def test_empty(self, client: TestClient) -> None:
        assert client.get("/job-descriptions/").json() == []

    def test_returns_all(self, client: TestClient) -> None:
        role_id = _make_role(client)
        client.post("/job-descriptions/", json={**JD_PAYLOAD, "role_id": role_id})
        client.post("/job-descriptions/", json={**JD_PAYLOAD, "role_id": role_id, "title": "PM"})
        assert len(client.get("/job-descriptions/").json()) == 2


class TestGetJD:
    def test_returns_single_jd(self, client: TestClient) -> None:
        role_id = _make_role(client)
        created = client.post("/job-descriptions/", json={**JD_PAYLOAD, "role_id": role_id}).json()
        resp = client.get(f"/job-descriptions/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == created["id"]

    def test_404_for_unknown(self, client: TestClient) -> None:
        assert client.get("/job-descriptions/nope").status_code == 404


class TestUpdateJD:
    def test_updates_status(self, client: TestClient) -> None:
        role_id = _make_role(client)
        created = client.post("/job-descriptions/", json={**JD_PAYLOAD, "role_id": role_id}).json()
        resp = client.patch(f"/job-descriptions/{created['id']}", json={"status": "Active"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "Active"

    def test_partial_preserves_other_fields(self, client: TestClient) -> None:
        role_id = _make_role(client)
        created = client.post("/job-descriptions/", json={**JD_PAYLOAD, "role_id": role_id}).json()
        client.patch(f"/job-descriptions/{created['id']}", json={"openings": 5})
        updated = client.get(f"/job-descriptions/{created['id']}").json()
        assert updated["title"] == JD_PAYLOAD["title"]
        assert updated["openings"] == 5

    def test_404_for_unknown(self, client: TestClient) -> None:
        assert client.patch("/job-descriptions/nope", json={"status": "Active"}).status_code == 404


class TestDeleteJD:
    def test_returns_204(self, client: TestClient) -> None:
        role_id = _make_role(client)
        created = client.post("/job-descriptions/", json={**JD_PAYLOAD, "role_id": role_id}).json()
        assert client.delete(f"/job-descriptions/{created['id']}").status_code == 204

    def test_gone_after_delete(self, client: TestClient) -> None:
        role_id = _make_role(client)
        created = client.post("/job-descriptions/", json={**JD_PAYLOAD, "role_id": role_id}).json()
        client.delete(f"/job-descriptions/{created['id']}")
        assert client.get(f"/job-descriptions/{created['id']}").status_code == 404

    def test_404_for_unknown(self, client: TestClient) -> None:
        assert client.delete("/job-descriptions/nope").status_code == 404


class TestSalaryRange:
    def test_createJD_shouldPersistSalaryRange_whenProvided(self, client: TestClient) -> None:
        role_id = _make_role(client)
        resp = client.post("/job-descriptions/", json={
            "role_id": role_id, "title": "ML Engineer",
            "salary_min": 70000, "salary_max": 100000, "salary_currency": "USD",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["salary_min"] == 70000
        assert data["salary_max"] == 100000
        assert data["salary_currency"] == "USD"

    def test_updateJD_shouldPatchSalaryRange_whenProvided(self, client: TestClient) -> None:
        role_id = _make_role(client)
        created = client.post("/job-descriptions/", json={"role_id": role_id, "title": "Analyst"}).json()
        resp = client.patch(f"/job-descriptions/{created['id']}", json={"salary_min": 40000, "salary_max": 55000, "salary_currency": "GBP"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["salary_min"] == 40000
        assert data["salary_max"] == 55000
        assert data["salary_currency"] == "GBP"

    def test_createJD_shouldDefaultSalaryToNull_whenNotProvided(self, client: TestClient) -> None:
        role_id = _make_role(client)
        resp = client.post("/job-descriptions/", json={"role_id": role_id, "title": "Intern"}).json()
        assert resp["salary_min"] is None
        assert resp["salary_max"] is None


class TestImproveJD:
    def test_returns_improved_text(self, client: TestClient) -> None:
        ai_response = '{"improved_text": "A much better job description."}'
        with mock.patch.object(AIEngine, "_call", return_value=ai_response):
            resp = client.post("/job-descriptions/improve-jd", json={
                "text": "We need someone good at backend stuff.",
                "role_name": "Senior Backend Engineer",
            })
        assert resp.status_code == 200
        assert resp.json()["improved_text"] == "A much better job description."

    def test_ai_error_raises_500(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", side_effect=RuntimeError("API down")):
            resp = client.post("/job-descriptions/improve-jd", json={
                "text": "Some JD text",
                "role_name": "Engineer",
            })
        assert resp.status_code == 500
