import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

from candid.commons.dependencies import UserCtx, require_org
from candid.commons.models import Membership, Organization, User
from candid.routers.branding import BrandingRouter

TEST_ORG_ID = "org-test"
TEST_USER_ID = "test-user"
TEST_SLUG = "test-corp"

_BRANDING_USER = UserCtx(
    user_id=TEST_USER_ID,
    email="test@candid.test",
    name="Test User",
    org_id=TEST_ORG_ID,
    role="owner",
)


@pytest.fixture(autouse=True)
def seed_org(db) -> None:
    with Session(db._engine) as session:
        organization_record = Organization(
            id=TEST_ORG_ID,
            name="Test Corp",
            slug=TEST_SLUG,
            owner_id=TEST_USER_ID,
        )
        user_record = User(id=TEST_USER_ID, email="test@candid.test", name="Test User")
        membership_record = Membership(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, role="owner")
        session.add(organization_record)
        session.add(user_record)
        session.add(membership_record)
        session.commit()


@pytest.fixture()
def branding_client(db) -> TestClient:
    application = FastAPI()
    application.dependency_overrides[require_org] = lambda: _BRANDING_USER
    application.include_router(BrandingRouter(db).router)
    return TestClient(application)


class TestGetPublicBranding:
    def test_getPublicBranding_shouldReturnBranding_whenOrgExists(
        self, branding_client: TestClient
    ) -> None:
        response = branding_client.get(f"/public/organizations/{TEST_SLUG}/branding")
        assert response.status_code == 200
        data = response.json()
        assert data["org_id"] == TEST_ORG_ID
        assert data["org_name"] == "Test Corp"

    def test_getPublicBranding_shouldReturn404_whenSlugNotFound(
        self, branding_client: TestClient
    ) -> None:
        response = branding_client.get("/public/organizations/nonexistent-slug/branding")
        assert response.status_code == 404

    def test_getPublicBranding_shouldReturnNullFields_whenNoBrandingSet(
        self, branding_client: TestClient
    ) -> None:
        response = branding_client.get(f"/public/organizations/{TEST_SLUG}/branding")
        assert response.status_code == 200
        data = response.json()
        assert data["primary_color"] is None
        assert data["background_color"] is None
        assert data["font_family"] is None
        assert data["logo_url"] is None


class TestGetCurrentBranding:
    def test_getCurrentBranding_shouldReturnBranding_whenAuthenticated(
        self, branding_client: TestClient
    ) -> None:
        response = branding_client.get("/organizations/current/branding")
        assert response.status_code == 200
        data = response.json()
        assert data["org_id"] == TEST_ORG_ID
        assert data["org_name"] == "Test Corp"


class TestUpdateBranding:
    def test_updateBranding_shouldPersistColors_whenValidColorsProvided(
        self, branding_client: TestClient
    ) -> None:
        branding_client.patch(
            "/organizations/current/branding",
            json={"primary_color": "#FF5733", "background_color": "#FFFFFF"},
        )
        response = branding_client.get("/organizations/current/branding")
        data = response.json()
        assert data["primary_color"] == "#FF5733"
        assert data["background_color"] == "#FFFFFF"

    def test_updateBranding_shouldMergePartialUpdate_whenOnlySomeFieldsProvided(
        self, branding_client: TestClient, db
    ) -> None:
        initial_config = {"primary_color": "#111111", "font_family": "Roboto"}
        with Session(db._engine) as session:
            organization_record = session.get(Organization, TEST_ORG_ID)
            organization_record.branding_config = json.dumps(initial_config)
            session.add(organization_record)
            session.commit()

        branding_client.patch(
            "/organizations/current/branding",
            json={"background_color": "#EEEEEE"},
        )
        response = branding_client.get("/organizations/current/branding")
        data = response.json()
        assert data["primary_color"] == "#111111"
        assert data["font_family"] == "Roboto"
        assert data["background_color"] == "#EEEEEE"

    def test_updateBranding_shouldReturn200_withUpdatedConfig(
        self, branding_client: TestClient
    ) -> None:
        response = branding_client.patch(
            "/organizations/current/branding",
            json={"primary_color": "#4F46E5", "logo_url": "https://example.com/logo.png"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["primary_color"] == "#4F46E5"
        assert data["logo_url"] == "https://example.com/logo.png"
        assert data["org_id"] == TEST_ORG_ID
