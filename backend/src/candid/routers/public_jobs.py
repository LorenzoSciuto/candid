import json
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from candid.database import Database
from candid.models import Candidate, JobDescription, Organization
from candid.schemas import (
    PortalApplicationRequest,
    PortalApplicationResponse,
    PublicJobItem,
    PublicJobListResponse,
)

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class PublicJobsRouter:
    def __init__(self, database: Database) -> None:
        self._db = database
        self.router = APIRouter(prefix="/public", tags=["public"])
        self._register()

    def _register(self) -> None:
        database = self._db

        @self.router.get(
            "/organizations/{org_slug}/jobs",
            response_model=PublicJobListResponse,
        )
        def list_public_jobs(
            org_slug: str,
            session: Session = Depends(database.get_session),
        ) -> PublicJobListResponse:
            return self._list_jobs(session, org_slug)

        @self.router.post(
            "/organizations/{org_slug}/jobs/{job_id}/apply",
            response_model=PortalApplicationResponse,
            status_code=201,
        )
        def apply_for_job(
            org_slug: str,
            job_id: str,
            body: PortalApplicationRequest,
            session: Session = Depends(database.get_session),
        ) -> PortalApplicationResponse:
            return self._apply(session, org_slug, job_id, body)

    # ── Implementations ────────────────────────────────────────────────────────

    def _list_jobs(
        self, session: Session, org_slug: str
    ) -> PublicJobListResponse:
        organization_record = self._fetch_org_by_slug(session, org_slug)
        active_jobs = self._fetch_active_jobs(session, organization_record.id)
        branding = self._parse_branding(organization_record.branding_config)
        return PublicJobListResponse(
            org_id=organization_record.id,
            org_name=organization_record.name,
            branding=branding,
            jobs=[self._to_public_job_item(job) for job in active_jobs],
        )

    def _apply(
        self,
        session: Session,
        org_slug: str,
        job_id: str,
        body: PortalApplicationRequest,
    ) -> PortalApplicationResponse:
        self._validate_email(body.email)
        organization_record = self._fetch_org_by_slug(session, org_slug)
        job_description_record = self._fetch_active_job(
            session, organization_record.id, job_id
        )
        candidate = self._create_portal_candidate(
            session, organization_record.id, job_description_record, body
        )
        return PortalApplicationResponse(ok=True, candidate_id=candidate.id)

    def _fetch_org_by_slug(self, session: Session, slug: str) -> Organization:
        organization_record = session.exec(
            select(Organization).where(Organization.slug == slug)
        ).first()
        if not organization_record:
            raise HTTPException(status_code=404, detail="Organization not found")
        return organization_record

    def _fetch_active_jobs(
        self, session: Session, org_id: str
    ) -> list[JobDescription]:
        return list(
            session.exec(
                select(JobDescription).where(
                    JobDescription.org_id == org_id,
                    JobDescription.status == "Active",
                )
            ).all()
        )

    def _fetch_active_job(
        self, session: Session, org_id: str, job_id: str
    ) -> JobDescription:
        job_description_record = session.get(JobDescription, job_id)
        if not job_description_record or job_description_record.org_id != org_id:
            raise HTTPException(status_code=404, detail="Job not found")
        if job_description_record.status != "Active":
            raise HTTPException(status_code=400, detail="Job is not active")
        return job_description_record

    def _create_portal_candidate(
        self,
        session: Session,
        org_id: str,
        job_description_record: "JobDescription",
        body: PortalApplicationRequest,
    ) -> Candidate:
        candidate = Candidate(
            org_id=org_id,
            first_name=body.first_name,
            last_name=body.last_name,
            email=body.email,
            phone=body.phone,
            cv_text=body.cv_text,
            status="pending_otp",
            source="Portal",
            job_title=job_description_record.title,
            job_description_id=job_description_record.id,
        )
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        return candidate

    @staticmethod
    def _parse_branding(branding_config: str | None) -> dict | None:
        if not branding_config:
            return None
        try:
            return json.loads(branding_config)
        except (json.JSONDecodeError, TypeError):
            return None

    @staticmethod
    def _to_public_job_item(job: JobDescription) -> PublicJobItem:
        return PublicJobItem(
            id=job.id,
            title=job.title,
            location=job.location,
            description=job.description,
            requirements=job.requirements,
            openings=job.openings,
        )

    @staticmethod
    def _validate_email(email: str) -> None:
        if not _EMAIL_PATTERN.match(email):
            raise HTTPException(status_code=422, detail="Invalid email address")
