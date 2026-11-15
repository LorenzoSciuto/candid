import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from candid.commons.database import Database
from candid.commons.dependencies import UserCtx, require_org
from candid.commons.models import Candidate, VideoInterview
from candid.commons.schemas import CompleteResponseRequest, VideoInterviewCreate
from candid.commons.tenancy import get_in_org
from candid.commons.uploads import MAX_VIDEO_CHUNK_BYTES, read_limited
from candid.services.video_interview_service import VideoInterviewService


class VideoInterviewsRouter:
    def __init__(self, db: Database, service: VideoInterviewService, upload_dir: Path) -> None:
        self._db = db
        self._service = service
        self._upload_dir = upload_dir
        self.router = APIRouter(prefix="/video-interviews", tags=["video-interviews"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.post("", status_code=201)
        def create_video_interview(
            body: VideoInterviewCreate,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._create(session, user.org_id, body)

        @self.router.get("")
        def list_video_interviews(
            candidate_id: str | None = None,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._list(session, user.org_id, candidate_id)

        @self.router.get("/{video_interview_id}")
        def get_video_interview(
            video_interview_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get(session, user.org_id, video_interview_id)

        @self.router.get("/{video_interview_id}/responses/{response_id}/video")
        def stream_response_video(
            video_interview_id: str,
            response_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._stream_video(session, user.org_id, video_interview_id, response_id)

    def _create(
        self,
        session: Session,
        org_id: str,
        body: VideoInterviewCreate,
    ) -> dict:
        get_in_org(session, Candidate, body.candidate_id, org_id)
        questions = [q.strip() for q in body.questions if q.strip()]
        if not questions:
            raise HTTPException(status_code=400, detail="At least one question is required")
        interview = self._service.create_invite(session, org_id, body.candidate_id, questions)
        return self._with_link(interview)

    @staticmethod
    def _with_link(interview: VideoInterview) -> dict:
        # Path of the candidate-facing page, relative to the frontend root.
        return {**interview.model_dump(), "invite_link": f"index.html#video/{interview.invite_token}"}

    def _list(self, session: Session, org_id: str, candidate_id: str | None) -> list:
        return [self._with_link(item) for item in self._service.list_by_org(session, org_id, candidate_id)]

    def _fetch(self, session: Session, org_id: str, video_interview_id: str) -> VideoInterview:
        interview = self._service.get_by_id_and_org(session, video_interview_id, org_id)
        if interview is None:
            raise HTTPException(status_code=404, detail="Video interview not found")
        return interview

    def _get(self, session: Session, org_id: str, video_interview_id: str) -> dict:
        interview = self._fetch(session, org_id, video_interview_id)
        responses = self._service.list_responses(session, interview)
        return {**self._with_link(interview), "responses": [r.model_dump() for r in responses]}

    def _stream_video(self, session: Session, org_id: str, video_interview_id: str, response_id: str):
        interview = self._fetch(session, org_id, video_interview_id)
        try:
            response = self._service.require_response(session, interview, response_id)
        except LookupError:
            raise HTTPException(status_code=404, detail="Response not found") from None
        paths = self._service.chunk_paths(response, self._upload_dir)
        if not paths:
            raise HTTPException(status_code=404, detail="No video recorded for this answer")

        def _iter_chunks():
            for path in paths:
                yield path.read_bytes()

        return StreamingResponse(_iter_chunks(), media_type="video/webm")


class PublicVideoRouter:
    def __init__(self, db: Database, service: VideoInterviewService, upload_dir: Path) -> None:
        self._db = db
        self._service = service
        self._upload_dir = upload_dir
        self.router = APIRouter(prefix="/public/video", tags=["public-video"])
        self._register()

    def _register(self) -> None:
        db = self._db

        @self.router.get("/{token}")
        def get_interview_by_token(
            token: str,
            session: Session = Depends(db.get_session),
        ):
            return self._get_by_token(session, token)

        @self.router.post("/{token}/start")
        def start_interview(
            token: str,
            session: Session = Depends(db.get_session),
        ):
            return self._start(session, token)

        @self.router.post("/{token}/responses/{question_index}")
        def get_or_create_response(
            token: str,
            question_index: int,
            session: Session = Depends(db.get_session),
        ):
            return self._get_or_create_response(session, token, question_index)

        @self.router.post("/{token}/responses/{response_id}/chunks")
        def upload_chunk(
            token: str,
            response_id: str,
            chunk_index: int = Form(...),
            chunk: UploadFile = File(...),
            session: Session = Depends(db.get_session),
        ):
            return self._upload_chunk(session, token, response_id, chunk_index, chunk)

        @self.router.post("/{token}/responses/{response_id}/complete")
        def complete_response(
            token: str,
            response_id: str,
            body: CompleteResponseRequest,
            session: Session = Depends(db.get_session),
        ):
            return self._complete_response(session, token, response_id, body)

        @self.router.post("/{token}/complete")
        def complete_interview(
            token: str,
            session: Session = Depends(db.get_session),
        ):
            return self._complete(session, token)

    def _require_valid_interview(self, session: Session, token: str) -> VideoInterview:
        interview = self._service.get_by_token(session, token)
        if interview is None:
            raise HTTPException(status_code=404, detail="Interview not found")
        if self._is_expired(interview):
            raise HTTPException(status_code=410, detail="Interview link has expired")
        return interview

    def _require_open_interview(self, session: Session, token: str) -> VideoInterview:
        """Valid link whose interview has not been submitted yet: recordings are immutable after that."""
        interview = self._require_valid_interview(session, token)
        if interview.status == "completed":
            raise HTTPException(status_code=409, detail="Interview already submitted")
        return interview

    def _is_expired(self, interview: VideoInterview) -> bool:
        expiry = datetime.fromisoformat(interview.expires_at)
        now = datetime.now(timezone.utc)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        return now > expiry

    def _get_by_token(self, session: Session, token: str) -> dict:
        interview = self._require_valid_interview(session, token)
        answered = [r.question_index for r in self._service.list_responses(session, interview) if r.status == "complete"]
        # The candidate only needs the questions and progress, never internal ids of the org.
        public = interview.model_dump(include={"invite_token", "questions", "status", "expires_at", "started_at", "completed_at"})
        return {**public, "answered_questions": answered}

    def _start(self, session: Session, token: str) -> dict:
        interview = self._require_open_interview(session, token)
        updated = self._service.start_interview(session, interview)
        return updated.model_dump(include={"invite_token", "questions", "status", "expires_at", "started_at"})

    def _get_or_create_response(
        self,
        session: Session,
        token: str,
        question_index: int,
    ) -> dict:
        interview = self._require_open_interview(session, token)
        if not 0 <= question_index < len(json.loads(interview.questions or "[]")):
            raise HTTPException(status_code=400, detail="Question index out of range")
        response = self._service.get_or_create_response(
            session, interview.id, question_index
        )
        return response.model_dump()

    def _upload_chunk(
        self,
        session: Session,
        token: str,
        response_id: str,
        chunk_index: int,
        chunk: UploadFile,
    ) -> dict:
        interview = self._require_open_interview(session, token)
        chunk_data = read_limited(chunk, MAX_VIDEO_CHUNK_BYTES)
        try:
            self._service.record_chunk(
                session, interview, response_id, chunk_index, chunk_data, self._upload_dir
            )
        except LookupError:
            raise HTTPException(status_code=404, detail="Response not found") from None
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"status": "ok", "chunk_index": chunk_index}

    def _complete_response(
        self,
        session: Session,
        token: str,
        response_id: str,
        body: CompleteResponseRequest,
    ) -> dict:
        interview = self._require_open_interview(session, token)
        try:
            response = self._service.complete_response(session, interview, response_id, body.total_chunks)
        except LookupError:
            raise HTTPException(status_code=404, detail="Response not found") from None
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return response.model_dump()

    def _complete(self, session: Session, token: str) -> dict:
        interview = self._require_open_interview(session, token)
        updated = self._service.complete_interview(session, interview)
        return updated.model_dump(include={"status", "completed_at"})
