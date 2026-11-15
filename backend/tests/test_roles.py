from fastapi.testclient import TestClient

ROLE_PAYLOAD = {
    "name": "Senior Engineer",
    "department": "Engineering",
    "description": "IC contributor on backend systems",
    "headcount": 3,
}


class TestCreateRole:
    def test_returns_201_with_id(self, client: TestClient) -> None:
        resp = client.post("/roles/", json=ROLE_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"].startswith("r-")
        assert data["name"] == "Senior Engineer"

    def test_headcount_defaults_to_one(self, client: TestClient) -> None:
        resp = client.post("/roles/", json={"name": "Designer"})
        assert resp.status_code == 201
        assert resp.json()["headcount"] == 1

    def test_optional_fields_nullable(self, client: TestClient) -> None:
        resp = client.post("/roles/", json={"name": "PM"})
        data = resp.json()
        assert data["department"] is None
        assert data["description"] is None


class TestListRoles:
    def test_returns_empty_list(self, client: TestClient) -> None:
        resp = client.get("/roles/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_all_created(self, client: TestClient) -> None:
        client.post("/roles/", json=ROLE_PAYLOAD)
        client.post("/roles/", json={**ROLE_PAYLOAD, "name": "Designer"})
        resp = client.get("/roles/")
        assert len(resp.json()) == 2


class TestUpdateRole:
    def test_updates_name(self, client: TestClient) -> None:
        created = client.post("/roles/", json=ROLE_PAYLOAD).json()
        resp = client.patch(f"/roles/{created['id']}", json={"name": "Staff Engineer"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Staff Engineer"

    def test_partial_update_preserves_other_fields(self, client: TestClient) -> None:
        created = client.post("/roles/", json=ROLE_PAYLOAD).json()
        client.patch(f"/roles/{created['id']}", json={"headcount": 5})
        resp = client.get("/roles/")
        role = next(r for r in resp.json() if r["id"] == created["id"])
        assert role["department"] == "Engineering"
        assert role["headcount"] == 5

    def test_404_for_unknown(self, client: TestClient) -> None:
        resp = client.patch("/roles/nonexistent", json={"name": "X"})
        assert resp.status_code == 404


class TestDeleteRole:
    def test_returns_204(self, client: TestClient) -> None:
        created = client.post("/roles/", json=ROLE_PAYLOAD).json()
        resp = client.delete(f"/roles/{created['id']}")
        assert resp.status_code == 204

    def test_gone_after_delete(self, client: TestClient) -> None:
        created = client.post("/roles/", json=ROLE_PAYLOAD).json()
        client.delete(f"/roles/{created['id']}")
        roles = client.get("/roles/").json()
        assert all(r["id"] != created["id"] for r in roles)

    def test_404_for_unknown(self, client: TestClient) -> None:
        resp = client.delete("/roles/nonexistent")
        assert resp.status_code == 404
