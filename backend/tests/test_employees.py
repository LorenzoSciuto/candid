from fastapi.testclient import TestClient

EMP_PAYLOAD = {
    "first_name": "Aisha",
    "last_name": "Okonkwo",
    "email": "aisha@company.io",
    "role_name": "Staff Engineer",
    "department": "Platform",
    "salary": 195000.0,
    "currency": "USD",
    "hire_date": "2022-03-14",
    "location": "Remote",
}


class TestCreateEmployee:
    def test_returns_201_with_id(self, client: TestClient) -> None:
        resp = client.post("/employees/", json=EMP_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"].startswith("emp-")
        assert data["first_name"] == "Aisha"

    def test_optional_fields_nullable(self, client: TestClient) -> None:
        resp = client.post("/employees/", json={"first_name": "Bob", "last_name": "Lee"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] is None
        assert data["salary"] is None


class TestListEmployees:
    def test_empty_list(self, client: TestClient) -> None:
        assert client.get("/employees/").json() == []

    def test_returns_all(self, client: TestClient) -> None:
        client.post("/employees/", json=EMP_PAYLOAD)
        client.post("/employees/", json={**EMP_PAYLOAD, "last_name": "Smith", "email": "s@c.io"})
        assert len(client.get("/employees/").json()) == 2


class TestUpdateEmployee:
    def test_updates_salary(self, client: TestClient) -> None:
        created = client.post("/employees/", json=EMP_PAYLOAD).json()
        resp = client.patch(f"/employees/{created['id']}", json={"salary": 210000.0})
        assert resp.status_code == 200
        assert resp.json()["salary"] == 210000.0

    def test_partial_update_preserves_other_fields(self, client: TestClient) -> None:
        created = client.post("/employees/", json=EMP_PAYLOAD).json()
        client.patch(f"/employees/{created['id']}", json={"location": "NYC"})
        emp = next(e for e in client.get("/employees/").json() if e["id"] == created["id"])
        assert emp["first_name"] == "Aisha"
        assert emp["location"] == "NYC"

    def test_404_for_unknown(self, client: TestClient) -> None:
        assert client.patch("/employees/nope", json={"salary": 0}).status_code == 404


class TestDeleteEmployee:
    def test_returns_204(self, client: TestClient) -> None:
        created = client.post("/employees/", json=EMP_PAYLOAD).json()
        assert client.delete(f"/employees/{created['id']}").status_code == 204

    def test_gone_after_delete(self, client: TestClient) -> None:
        created = client.post("/employees/", json=EMP_PAYLOAD).json()
        client.delete(f"/employees/{created['id']}")
        assert all(e["id"] != created["id"] for e in client.get("/employees/").json())

    def test_404_for_unknown(self, client: TestClient) -> None:
        assert client.delete("/employees/nope").status_code == 404
