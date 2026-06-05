import json

import pytest
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.database import Database
from candid.models import JobDescription, Organization, Role
from candid.routers.public_jobs import PublicJobsRouter

TEST_ORG_SLUG = "acme-corp"
TEST_ORG_ID = "org-public-test"
_TEST_DB_URL = "sqlite://"


@pytest.fixture(scope="module")
def portal_db() -> Database:
    engine = create_engine(
        _TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    database = Database.__new__(Database)
    database._engine = engine
    SQLModel.metadata.create_all(engine)
    return database


@pytest.fixture(scope="module")
def portal_client(portal_db: Database) -> TestClient:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield

    application = FastAPI(lifespan=lifespan)
    application.include_router(PublicJobsRouter(portal_db).router)
    return TestClient(application)


@pytest.fixture(autouse=True)
def seed_portal_data(portal_db: Database) -> None:
    """Seed org + active JD + draft JD before each test, clean up after."""
    with Session(portal_db._engine) as session:
        organization_record = Organization(
            id=TEST_ORG_ID,
            name="Acme Corp",
            slug=TEST_ORG_SLUG,
            owner_id="user-owner",
        )
        role_record = Role(
            id="role-eng",
            org_id=TEST_ORG_ID,
            name="Engineering",
        )
        active_job = JobDescription(
            id="jd-active-1",
            org_id=TEST_ORG_ID,
            role_id="role-eng",
            title="Senior Backend Engineer",
            description="Build scalable APIs.",
            requirements="5+ years Python",
            location="Remote",
            status="Active",
            openings=2,
            salary_min=60000,
            salary_max=90000,
            salary_currency="EUR",
        )
        draft_job = JobDescription(
            id="jd-draft-1",
            org_id=TEST_ORG_ID,
            role_id="role-eng",
            title="Product Designer",
            description="Design beautiful UIs.",
            status="Draft",
            openings=1,
        )
        closed_job = JobDescription(
            id="jd-closed-1",
            org_id=TEST_ORG_ID,
            role_id="role-eng",
            title="DevOps Engineer",
            description="Manage infrastructure.",
            status="Closed",
            openings=1,
        )
        for record in (organization_record, role_record, active_job, draft_job, closed_job):
            session.add(record)
        session.commit()

    yield

    with Session(portal_db._engine) as session:
        for model_class in (JobDescription, Role, Organization):
            for row in session.exec(__import__("sqlmodel").select(model_class)).all():
                session.delete(row)
        session.commit()


# ── GET /public/organizations/{slug}/jobs ─────────────────────────────────────

class TestListPublicJobs:
    def test_listJobs_shouldReturnActiveJobs_whenOrgExists(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.get(f"/public/organizations/{TEST_ORG_SLUG}/jobs")
        assert response.status_code == 200
        data = response.json()
        assert data["org_id"] == TEST_ORG_ID
        assert data["org_name"] == "Acme Corp"
        assert len(data["jobs"]) == 1
        assert data["jobs"][0]["id"] == "jd-active-1"
        assert data["jobs"][0]["title"] == "Senior Backend Engineer"

    def test_listJobs_shouldExcludeDraftAndClosedJobs(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.get(f"/public/organizations/{TEST_ORG_SLUG}/jobs")
        assert response.status_code == 200
        returned_ids = [job["id"] for job in response.json()["jobs"]]
        assert "jd-draft-1" not in returned_ids
        assert "jd-closed-1" not in returned_ids

    def test_listJobs_shouldReturn404_whenSlugNotFound(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.get("/public/organizations/nonexistent-slug/jobs")
        assert response.status_code == 404

    def test_listJobs_shouldIncludeBranding_whenBrandingConfigSet(
        self, portal_client: TestClient, portal_db: Database
    ) -> None:
        branding_data = {"primary_color": "#3B82F6", "bg_color": "#1E3A5F"}
        with Session(portal_db._engine) as session:
            organization_record = session.get(Organization, TEST_ORG_ID)
            organization_record.branding_config = json.dumps(branding_data)
            session.add(organization_record)
            session.commit()

        response = portal_client.get(f"/public/organizations/{TEST_ORG_SLUG}/jobs")
        assert response.status_code == 200
        returned_branding = response.json()["branding"]
        assert returned_branding is not None
        assert returned_branding["primary_color"] == "#3B82F6"
        assert returned_branding["bg_color"] == "#1E3A5F"

    def test_listJobs_shouldReturnNullBranding_whenNoBrandingConfigSet(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.get(f"/public/organizations/{TEST_ORG_SLUG}/jobs")
        assert response.status_code == 200
        assert response.json()["branding"] is None

    def test_listJobs_shouldIncludeSalaryRange_whenSet(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.get(f"/public/organizations/{TEST_ORG_SLUG}/jobs")
        assert response.status_code == 200
        job = response.json()["jobs"][0]
        assert job["salary_min"] == 60000
        assert job["salary_max"] == 90000
        assert job["salary_currency"] == "EUR"


# ── POST /public/organizations/{slug}/jobs/{job_id}/apply ─────────────────────

_APPLICATION_PAYLOAD = {
    "cv_text": "Alice Smith — alice@example.com — 8 years of Python backend experience.",
}


class TestApplyForJob:
    def test_applyForJob_shouldCreateCandidateWithNewStatus(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.post(
            f"/public/organizations/{TEST_ORG_SLUG}/jobs/jd-active-1/apply",
            json=_APPLICATION_PAYLOAD,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["ok"] is True
        assert data["candidate_id"].startswith("c-")

    def test_applyForJob_shouldReturn404_whenOrgSlugNotFound(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.post(
            "/public/organizations/ghost-org/jobs/jd-active-1/apply",
            json=_APPLICATION_PAYLOAD,
        )
        assert response.status_code == 404

    def test_applyForJob_shouldReturn404_whenJobNotFound(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.post(
            f"/public/organizations/{TEST_ORG_SLUG}/jobs/jd-nonexistent/apply",
            json=_APPLICATION_PAYLOAD,
        )
        assert response.status_code == 404

    def test_applyForJob_shouldReturn400_whenJobIsNotActive(
        self, portal_client: TestClient
    ) -> None:
        response = portal_client.post(
            f"/public/organizations/{TEST_ORG_SLUG}/jobs/jd-draft-1/apply",
            json=_APPLICATION_PAYLOAD,
        )
        assert response.status_code == 400

    def test_applyForJob_shouldSetSourceToPortal(
        self, portal_client: TestClient, portal_db: Database
    ) -> None:
        response = portal_client.post(
            f"/public/organizations/{TEST_ORG_SLUG}/jobs/jd-active-1/apply",
            json=_APPLICATION_PAYLOAD,
        )
        assert response.status_code == 201
        candidate_id = response.json()["candidate_id"]

        from candid.models import Candidate
        with Session(portal_db._engine) as session:
            candidate = session.get(Candidate, candidate_id)
        assert candidate is not None
        assert candidate.source == "Portal"
        assert candidate.status == "new"
        assert candidate.job_title == "Senior Backend Engineer"
