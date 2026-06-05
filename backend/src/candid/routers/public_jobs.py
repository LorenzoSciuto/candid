import json
from typing import Optional

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
from candid.services.ai_engine import AIEngineFactory


class PublicJobsRouter:
    def __init__(self, database: Database, ai_engine_factory: Optional[AIEngineFactory] = None) -> None:
        self._db = database
        self._ai_factory = ai_engine_factory
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
        organization_record = self._fetch_org_by_slug(session, org_slug)
        job_description_record = self._fetch_active_job(
            session, organization_record.id, job_id
        )
        parsed = self._parse_cv(session, organization_record.id, body.cv_text or "")
        candidate = self._create_portal_candidate(
            session, organization_record.id, job_description_record, body, parsed
        )
        return PortalApplicationResponse(ok=True, candidate_id=candidate.id)

    def _parse_cv(self, session: Session, org_id: str, cv_text: str) -> dict:
        if not cv_text.strip() or self._ai_factory is None:
            return {}
        try:
            engine = self._ai_factory.from_session(session, org_id)
            return engine.parse_quick_add(cv_text)
        except Exception:
            return {}

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
        parsed: dict,
    ) -> Candidate:
        first_name = parsed.get("first_name") or "Unknown"
        last_name  = parsed.get("last_name")  or ""
        email      = parsed.get("email")      or None
        phone      = parsed.get("phone")      or None
        candidate = Candidate(
            org_id=org_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            current_role=parsed.get("current_role") or None,
            years_of_experience=parsed.get("years_of_experience") or None,
            location=parsed.get("location") or None,
            cv_text=body.cv_text,
            status="new",
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
            salary_min=job.salary_min,
            salary_max=job.salary_max,
            salary_currency=job.salary_currency,
        )

