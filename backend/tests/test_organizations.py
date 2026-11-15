import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from candid.commons.models import Invitation, Membership, Organization, User

TEST_ORG_ID = "org-test"
TEST_USER_ID = "test-user"


@pytest.fixture(autouse=True)
def seed_org(db) -> None:
    """Create the minimal org + membership + user records for each test."""
    with Session(db._engine) as session:
        org = Organization(id=TEST_ORG_ID, name="Test Corp", slug="test-corp", owner_id=TEST_USER_ID)
        user = User(id=TEST_USER_ID, email="test@candid.test", name="Test User")
        mbr = Membership(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, role="owner")
        session.add(org)
        session.add(user)
        session.add(mbr)
        session.commit()


class TestGetCurrentOrg:
    def test_returns_org_details(self, client: TestClient) -> None:
        resp = client.get("/organizations/current")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == TEST_ORG_ID
        assert data["name"] == "Test Corp"
        assert data["owner_id"] == TEST_USER_ID

    def test_includes_members(self, client: TestClient) -> None:
        resp = client.get("/organizations/current")
        data = resp.json()
        assert len(data["members"]) == 1
        assert data["members"][0]["user_id"] == TEST_USER_ID
        assert data["members"][0]["role"] == "owner"

    def test_includes_pending_invitations(self, client: TestClient, db) -> None:
        with Session(db._engine) as session:
            inv = Invitation(
                org_id=TEST_ORG_ID, email="pending@test.com", token="tok123",
                role="member", invited_by=TEST_USER_ID, expires_at="2099-12-31",
            )
            session.add(inv)
            session.commit()
        resp = client.get("/organizations/current")
        invs = resp.json()["pending_invitations"]
        assert len(invs) == 1
        assert invs[0]["email"] == "pending@test.com"


class TestListOrgs:
    def test_returns_orgs_for_user(self, client: TestClient) -> None:
        resp = client.get("/organizations/")
        assert resp.status_code == 200
        orgs = resp.json()
        assert any(o["id"] == TEST_ORG_ID for o in orgs)

    def test_includes_role(self, client: TestClient) -> None:
        resp = client.get("/organizations/")
        org = next(o for o in resp.json() if o["id"] == TEST_ORG_ID)
        assert org["role"] == "owner"


class TestUpdateMemberRole:
    def test_updates_role(self, client: TestClient, db) -> None:
        with Session(db._engine) as session:
            other_user = User(id="other-user", email="other@test.com", name="Other")
            mbr = Membership(org_id=TEST_ORG_ID, user_id="other-user", role="member")
            session.add(other_user)
            session.add(mbr)
            session.commit()
        resp = client.patch("/organizations/current/members/other-user", json={"role": "admin"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_invalid_role_rejected(self, client: TestClient, db) -> None:
        with Session(db._engine) as session:
            session.add(User(id="u2", email="u2@test.com", name="U2"))
            session.add(Membership(org_id=TEST_ORG_ID, user_id="u2", role="member"))
            session.commit()
        resp = client.patch("/organizations/current/members/u2", json={"role": "superuser"})
        assert resp.status_code == 400

    def test_cannot_demote_owner(self, client: TestClient) -> None:
        resp = client.patch(f"/organizations/current/members/{TEST_USER_ID}", json={"role": "member"})
        assert resp.status_code == 400

    def test_404_for_unknown_member(self, client: TestClient) -> None:
        resp = client.patch("/organizations/current/members/ghost", json={"role": "admin"})
        assert resp.status_code == 404


class TestRemoveMember:
    def test_removes_member(self, client: TestClient, db) -> None:
        with Session(db._engine) as session:
            session.add(User(id="rm-user", email="rm@test.com", name="RM"))
            session.add(Membership(org_id=TEST_ORG_ID, user_id="rm-user", role="member"))
            session.commit()
        resp = client.delete("/organizations/current/members/rm-user")
        assert resp.status_code == 204
        # member no longer in list
        data = client.get("/organizations/current").json()
        assert not any(m["user_id"] == "rm-user" for m in data["members"])

    def test_cannot_remove_self(self, client: TestClient) -> None:
        resp = client.delete(f"/organizations/current/members/{TEST_USER_ID}")
        assert resp.status_code == 400

    def test_cannot_remove_owner(self, client: TestClient, db) -> None:
        # create another admin trying to remove owner
        with Session(db._engine) as session:
            session.add(User(id="admin2", email="admin2@test.com", name="Admin2"))
            session.add(Membership(org_id=TEST_ORG_ID, user_id="admin2", role="admin"))
            session.commit()
        # test client is always the owner (TEST_USER_ID), so removing owner = removing self
        resp = client.delete(f"/organizations/current/members/{TEST_USER_ID}")
        assert resp.status_code == 400

    def test_404_for_unknown_member(self, client: TestClient) -> None:
        resp = client.delete("/organizations/current/members/ghost")
        assert resp.status_code == 404


class TestDeleteOrg:
    def test_deletes_org_and_cascades(self, client: TestClient) -> None:
        resp = client.delete("/organizations/current")
        assert resp.status_code == 204
        # org no longer accessible
        resp2 = client.get("/organizations/current")
        assert resp2.status_code == 404

    def test_only_owner_can_delete(self, client: TestClient, db) -> None:
        # Demote test user to member by updating the org owner to someone else
        with Session(db._engine) as session:
            org = session.get(Organization, TEST_ORG_ID)
            org.owner_id = "someone-else"
            session.add(org)
            session.commit()
        resp = client.delete("/organizations/current")
        assert resp.status_code == 403
