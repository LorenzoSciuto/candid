import io
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org
from candid.commons.models import Candidate, VideoInterview, VideoResponse
from candid.routers.video_interviews import PublicVideoRouter, VideoInterviewsRouter
from candid.services.video_interview_service import VideoInterviewService

TEST_ORG_ID = "org-video-test"
_TEST_USER = UserCtx(
    user_id="test-user",
    email="test@candid.test",
    name="Test User",
    org_id=TEST_ORG_ID,
    role="owner",
)

_QUESTIONS = ["Tell me about yourself.", "Describe a challenge you overcame."]


@pytest.fixture(scope="module")
def video_db() -> Database:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    database = Database.__new__(Database)
    database._engine = engine
    SQLModel.metadata.create_all(engine)
    return database


@pytest.fixture(scope="module")
def video_service() -> VideoInterviewService:
    return VideoInterviewService()


@pytest.fixture(scope="module")
def upload_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return tmp_path_factory.mktemp("uploads")


@pytest.fixture(scope="module")
def authenticated_client(video_db: Database, video_service: VideoInterviewService, upload_dir: Path) -> TestClient:
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield

    application = FastAPI(lifespan=lifespan)
    application.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    application.dependency_overrides[require_org] = lambda: _TEST_USER
    application.include_router(VideoInterviewsRouter(video_db, video_service, upload_dir).router)
    return TestClient(application)


@pytest.fixture(scope="module")
def public_client(video_db: Database, video_service: VideoInterviewService, upload_dir: Path) -> TestClient:
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield

    application = FastAPI(lifespan=lifespan)
    application.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    application.include_router(PublicVideoRouter(video_db, video_service, upload_dir).router)
    return TestClient(application)


@pytest.fixture(autouse=True)
def clean_video_tables(video_db: Database) -> None:
    with Session(video_db._engine) as session:
        for row in session.exec(select(VideoResponse)).all():
            session.delete(row)
        for row in session.exec(select(VideoInterview)).all():
            session.delete(row)
        for row in session.exec(select(Candidate)).all():
            session.delete(row)
        session.add(Candidate(id="cand-001", org_id=TEST_ORG_ID, first_name="Ada", last_name="Lovelace"))
        session.add(Candidate(id="cand-other-org", org_id="org-other", first_name="Eve", last_name="Other"))
        session.commit()


def _create_interview_via_db(
    video_db: Database,
    video_service: VideoInterviewService,
    org_id: str = TEST_ORG_ID,
    questions: list[str] | None = None,
    expires_days: int = 7,
) -> VideoInterview:
    questions = questions or _QUESTIONS
    with Session(video_db._engine) as session:
        interview = video_service.create_invite(session, org_id, "cand-001", questions)
        if expires_days < 0:
            interview.expires_at = (
                datetime.now(UTC) + timedelta(days=expires_days)
            ).isoformat()
            session.add(interview)
            session.commit()
            session.refresh(interview)
        interview_id = interview.id
    with Session(video_db._engine) as session:
        result = session.exec(
            select(VideoInterview).where(VideoInterview.id == interview_id)
        ).first()
        return result


# ── VideoInterviewService unit tests ─────────────────────────────────────────

class TestVideoInterviewService:
    def test_createInvite_shouldReturnToken_whenValidInput(
        self, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        with Session(video_db._engine) as session:
            interview = video_service.create_invite(
                session, TEST_ORG_ID, "cand-001", _QUESTIONS
            )
        assert interview.invite_token is not None
        assert len(interview.invite_token) > 0
        assert interview.status == "pending"
        assert json.loads(interview.questions) == _QUESTIONS

    def test_getByToken_shouldReturnInterview_whenTokenExists(
        self, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        with Session(video_db._engine) as session:
            result = video_service.get_by_token(session, stored.invite_token)
        assert result is not None
        assert result.id == stored.id

    def test_getByToken_shouldReturnNone_whenTokenNotFound(
        self, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        with Session(video_db._engine) as session:
            result = video_service.get_by_token(session, "nonexistent-token")
        assert result is None

    def test_startInterview_shouldSetInProgress_whenPending(
        self, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        with Session(video_db._engine) as session:
            interview = video_service.get_by_token(session, stored.invite_token)
            updated = video_service.start_interview(session, interview)
        assert updated.status == "in_progress"
        assert updated.started_at is not None

    def test_completeResponse_shouldMarkComplete_whenAllChunksReceived(
        self, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        with Session(video_db._engine) as session:
            response = video_service.get_or_create_response(session, stored.id, 0)
            interview = video_service.get_by_token(session, stored.invite_token)
            completed = video_service.complete_response(session, interview, response.id, total_chunks=3)
        assert completed.status == "complete"
        assert completed.total_chunks == 3
        assert completed.completed_at is not None

    def test_completeInterview_shouldMarkCompleted_whenAllResponsesDone(
        self, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        with Session(video_db._engine) as session:
            interview = video_service.get_by_token(session, stored.invite_token)
            completed = video_service.complete_interview(session, interview)
        assert completed.status == "completed"
        assert completed.completed_at is not None


# ── Public router HTTP tests ──────────────────────────────────────────────────

class TestPublicGetInterview:
    def test_publicGetInterview_shouldReturn200_whenValidToken(
        self,
        public_client: TestClient,
        video_db: Database,
        video_service: VideoInterviewService,
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        response = public_client.get(f"/public/video/{stored.invite_token}")
        assert response.status_code == 200
        assert response.json()["questions"] == stored.questions
        assert "org_id" not in response.json()

    def test_publicGetInterview_shouldReturn404_whenExpired(
        self,
        public_client: TestClient,
        video_db: Database,
        video_service: VideoInterviewService,
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service, expires_days=-1)
        response = public_client.get(f"/public/video/{stored.invite_token}")
        assert response.status_code == 410

    def test_publicGetInterview_shouldReturn404_whenTokenNotFound(
        self, public_client: TestClient
    ) -> None:
        response = public_client.get("/public/video/no-such-token")
        assert response.status_code == 404


class TestPublicStartInterview:
    def test_publicStartInterview_shouldReturn200_whenPending(
        self,
        public_client: TestClient,
        video_db: Database,
        video_service: VideoInterviewService,
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        response = public_client.post(f"/public/video/{stored.invite_token}/start")
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"


class TestPublicUploadChunk:
    def test_publicUploadChunk_shouldReturn200_whenValidRequest(
        self,
        public_client: TestClient,
        video_db: Database,
        video_service: VideoInterviewService,
        tmp_path: Path,
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        with Session(video_db._engine) as session:
            video_response = video_service.get_or_create_response(session, stored.id, 0)

        with patch.object(
            VideoInterviewService, "record_chunk", return_value=None
        ) as mock_record:
            response = public_client.post(
                f"/public/video/{stored.invite_token}/responses/{video_response.id}/chunks",
                data={"chunk_index": "0"},
                files={"chunk": ("chunk_0.webm", io.BytesIO(b"fake-webm-data"), "video/webm")},
            )
        assert response.status_code == 200
        assert response.json()["chunk_index"] == 0
        mock_record.assert_called_once()


class TestPublicCompleteResponse:
    def test_publicCompleteResponse_shouldReturn200_whenValid(
        self,
        public_client: TestClient,
        video_db: Database,
        video_service: VideoInterviewService,
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        with Session(video_db._engine) as session:
            video_response = video_service.get_or_create_response(session, stored.id, 0)

        response = public_client.post(
            f"/public/video/{stored.invite_token}/responses/{video_response.id}/complete",
            json={"total_chunks": 5},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "complete"
        assert response.json()["total_chunks"] == 5


class TestPublicCompleteInterview:
    def test_publicCompleteInterview_shouldReturn200_whenAllDone(
        self,
        public_client: TestClient,
        video_db: Database,
        video_service: VideoInterviewService,
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        response = public_client.post(f"/public/video/{stored.invite_token}/complete")
        assert response.status_code == 200
        assert response.json()["status"] == "completed"


# ── Authenticated router HTTP tests ──────────────────────────────────────────

class TestCreateVideoInterviewAuthenticated:
    def test_createInvite_shouldReturn401_whenNoAuth(
        self, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        from contextlib import asynccontextmanager

        @asynccontextmanager
        async def lifespan(_: FastAPI):
            yield

        application = FastAPI(lifespan=lifespan)
        application.include_router(VideoInterviewsRouter(video_db, video_service, Path("unused")).router)
        unauth_client = TestClient(application, raise_server_exceptions=False)

        response = unauth_client.post(
            "/video-interviews",
            json={"candidate_id": "cand-001", "questions": _QUESTIONS},
        )
        assert response.status_code in (401, 403)

    def test_listVideoInterviews_shouldReturn200_whenAuthenticated(
        self, authenticated_client: TestClient
    ) -> None:
        response = authenticated_client.get("/video-interviews")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_createInvite_shouldReturnInviteLink_whenValidInput(
        self, authenticated_client: TestClient
    ) -> None:
        response = authenticated_client.post(
            "/video-interviews",
            json={"candidate_id": "cand-001", "questions": _QUESTIONS},
        )
        assert response.status_code == 201
        data = response.json()
        assert "invite_link" in data
        assert data["invite_link"] == f"index.html#video/{data['invite_token']}"
        assert data["status"] == "pending"


class TestVideoInterviewIsolation:
    def test_upload_chunk_should_return_404_when_response_belongs_to_another_interview(
        self, public_client: TestClient, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        mine = _create_interview_via_db(video_db, video_service)
        victim = _create_interview_via_db(video_db, video_service, org_id="org-other")
        with Session(video_db._engine) as session:
            victim_response = video_service.get_or_create_response(session, victim.id, 0)
        response = public_client.post(
            f"/public/video/{mine.invite_token}/responses/{victim_response.id}/chunks",
            data={"chunk_index": "0"},
            files={"chunk": ("c.webm", io.BytesIO(b"x"), "video/webm")},
        )
        assert response.status_code == 404
        complete = public_client.post(
            f"/public/video/{mine.invite_token}/responses/{victim_response.id}/complete",
            json={"total_chunks": 1},
        )
        assert complete.status_code == 404

    def test_upload_chunk_should_return_400_when_chunk_index_out_of_range(
        self, public_client: TestClient, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        with Session(video_db._engine) as session:
            video_response = video_service.get_or_create_response(session, stored.id, 0)
        response = public_client.post(
            f"/public/video/{stored.invite_token}/responses/{video_response.id}/chunks",
            data={"chunk_index": str(VideoInterviewService.MAX_CHUNKS)},
            files={"chunk": ("c.webm", io.BytesIO(b"x"), "video/webm")},
        )
        assert response.status_code == 400

    def test_get_or_create_response_should_return_400_when_question_index_out_of_range(
        self, public_client: TestClient, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        response = public_client.post(f"/public/video/{stored.invite_token}/responses/{len(_QUESTIONS)}")
        assert response.status_code == 400

    def test_public_endpoints_should_return_409_when_interview_already_submitted(
        self, public_client: TestClient, video_db: Database, video_service: VideoInterviewService
    ) -> None:
        stored = _create_interview_via_db(video_db, video_service)
        assert public_client.post(f"/public/video/{stored.invite_token}/complete").status_code == 200
        response = public_client.post(f"/public/video/{stored.invite_token}/responses/0")
        assert response.status_code == 409

    def test_create_invite_should_return_404_when_candidate_belongs_to_another_org(
        self, authenticated_client: TestClient
    ) -> None:
        response = authenticated_client.post(
            "/video-interviews", json={"candidate_id": "cand-other-org", "questions": _QUESTIONS}
        )
        assert response.status_code == 404


class TestVideoPlayback:
    def test_recorded_answer_should_be_listed_and_streamed_to_recruiter(
        self, public_client: TestClient, authenticated_client: TestClient
    ) -> None:
        created = authenticated_client.post(
            "/video-interviews", json={"candidate_id": "cand-001", "questions": _QUESTIONS}
        ).json()
        token = created["invite_token"]
        answer = public_client.post(f"/public/video/{token}/responses/0").json()
        for index, payload in enumerate([b"first-", b"second"]):
            public_client.post(
                f"/public/video/{token}/responses/{answer['id']}/chunks",
                data={"chunk_index": str(index)},
                files={"chunk": ("c.webm", io.BytesIO(payload), "video/webm")},
            )
        public_client.post(f"/public/video/{token}/responses/{answer['id']}/complete", json={"total_chunks": 2})

        listed = authenticated_client.get("/video-interviews", params={"candidate_id": "cand-001"}).json()
        assert [item["id"] for item in listed] == [created["id"]]
        assert listed[0]["invite_link"] == f"index.html#video/{token}"
        progress = public_client.get(f"/public/video/{token}").json()
        assert progress["answered_questions"] == [0]  # lets the portal resume at question 2 after a reload
        detail = authenticated_client.get(f"/video-interviews/{created['id']}").json()
        assert detail["responses"][0]["received_chunks"] == 2

        video = authenticated_client.get(f"/video-interviews/{created['id']}/responses/{answer['id']}/video")
        assert video.status_code == 200
        assert video.headers["content-type"] == "video/webm"
        assert video.content == b"first-second"
