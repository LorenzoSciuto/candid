"""Row-Level Security against a real PostgreSQL (skipped unless CANDID_TEST_DATABASE_URL is set).

    docker run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_USER=candid -e POSTGRES_PASSWORD=test postgres:19-alpine
    CANDID_TEST_DATABASE_URL=postgresql://candid:test@127.0.0.1:55432/candid uv run pytest tests/test_rls_postgres.py

The connection user is a superuser on purpose: RLS must hold even then,
because every transaction switches to the unprivileged ``candid_app`` role.
"""
import contextvars
import os
import uuid

import pytest
from sqlalchemy.exc import DBAPIError
from sqlmodel import Session, select

from candid.commons import tenancy
from candid.commons.database import Database
from candid.commons.models import Candidate, VideoInterview, VideoResponse

DATABASE_URL = os.environ.get("CANDID_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="CANDID_TEST_DATABASE_URL not set")


def _in_context(fn, org_id: str = "", bypass: bool = False):
    """Run fn in a fresh context, as a separate request would."""
    def run():
        if org_id:
            tenancy.set_org(org_id)
        if bypass:
            tenancy.enable_bypass()
        return fn()
    return contextvars.Context().run(run)


@pytest.fixture(scope="module")
def db() -> Database:
    database = Database(DATABASE_URL)
    database.migrate()
    return database


@pytest.fixture
def orgs(db: Database) -> tuple[str, str]:
    org_a, org_b = f"org-a-{uuid.uuid4().hex[:6]}", f"org-b-{uuid.uuid4().hex[:6]}"

    def seed():
        with Session(db._engine) as session:
            for org in (org_a, org_b):
                session.add(Candidate(org_id=org, first_name="Ada", last_name=org))
            session.commit()
    _in_context(seed, bypass=True)
    return org_a, org_b


def _visible_orgs(db: Database, org_a: str, org_b: str) -> set[str]:
    with Session(db._engine) as session:
        rows = session.exec(select(Candidate).where(Candidate.org_id.in_([org_a, org_b]))).all()
        return {c.org_id for c in rows}


def test_queries_should_only_see_current_org_even_without_where_clause(db, orgs) -> None:
    org_a, org_b = orgs
    assert _in_context(lambda: _visible_orgs(db, org_a, org_b), org_id=org_a) == {org_a}


def test_queries_should_see_nothing_when_no_tenant_context(db, orgs) -> None:
    assert _in_context(lambda: _visible_orgs(db, *orgs)) == set()


def test_explicit_bypass_should_see_all_orgs(db, orgs) -> None:
    assert _in_context(lambda: _visible_orgs(db, *orgs), bypass=True) == set(orgs)


def test_tenant_context_should_survive_commit(db, orgs) -> None:
    org_a, org_b = orgs

    def commit_then_query():
        with Session(db._engine) as session:
            session.add(Candidate(org_id=org_a, first_name="Grace", last_name="Hopper"))
            session.commit()
            return {c.org_id for c in session.exec(select(Candidate).where(Candidate.org_id.in_([org_a, org_b]))).all()}
    assert _in_context(commit_then_query, org_id=org_a) == {org_a}


def test_insert_into_another_org_should_be_rejected(db, orgs) -> None:
    org_a, org_b = orgs

    def insert_foreign():
        with Session(db._engine) as session:
            session.add(Candidate(org_id=org_b, first_name="Mallory", last_name="X"))
            session.commit()
    with pytest.raises(DBAPIError, match="row-level security"):
        _in_context(insert_foreign, org_id=org_a)


def test_video_responses_should_follow_their_interview_org(db, orgs) -> None:
    org_a, org_b = orgs

    def seed():
        with Session(db._engine) as session:
            interview = VideoInterview(org_id=org_b, candidate_id="c", invite_token=uuid.uuid4().hex, questions="[]", expires_at="2099-01-01")
            session.add(interview)
            session.flush()
            session.add(VideoResponse(video_interview_id=interview.id, question_index=0))
            session.commit()
            return interview.id
    interview_id = _in_context(seed, bypass=True)

    def count_responses():
        with Session(db._engine) as session:
            return len(session.exec(select(VideoResponse).where(VideoResponse.video_interview_id == interview_id)).all())
    assert _in_context(count_responses, org_id=org_a) == 0
    assert _in_context(count_responses, org_id=org_b) == 1
