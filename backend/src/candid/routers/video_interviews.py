from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session

from candid.database import Database
from candid.dependencies import UserCtx, require_org
from candid.models import VideoInterview
from candid.schemas import CompleteResponseRequest, VideoInterviewCreate
from candid.services.video_interview_service import VideoInterviewService

_DEFAULT_UPLOAD_DIR = Path("uploads")


class VideoInterviewsRouter:
    def __init__(self, db: Database, service: VideoInterviewService) -> None:
        self._db = db
        self._service = service
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
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._list(session, user.org_id)

        @self.router.get("/{video_interview_id}")
        def get_video_interview(
            video_interview_id: str,
            session: Session = Depends(db.get_session),
            user: UserCtx = Depends(require_org),
        ):
            return self._get(session, user.org_id, video_interview_id)

    def _create(
        self,
        session: Session,
        org_id: str,
        body: VideoInterviewCreate,
    ) -> dict:
        interview = self._service.create_invite(
            session, org_id, body.candidate_id, body.questions
        )
        return {**interview.model_dump(), "invite_link": f"/public/video/{interview.invite_token}"}

    def _list(self, session: Session, org_id: str) -> list:
        return [item.model_dump() for item in self._service.list_by_org(session, org_id)]

    def _get(self, session: Session, org_id: str, video_interview_id: str) -> dict:
        interview = self._service.get_by_id_and_org(session, video_interview_id, org_id)
        if interview is None:
            raise HTTPException(status_code=404, detail="Video interview not found")
        return interview.model_dump()


class PublicVideoRouter:
    def __init__(self, db: Database, service: VideoInterviewService) -> None:
        self._db = db
        self._service = service
        self._upload_dir = _DEFAULT_UPLOAD_DIR
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

    def _is_expired(self, interview: VideoInterview) -> bool:
        expiry = datetime.fromisoformat(interview.expires_at)
        now = datetime.now(timezone.utc)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        return now > expiry

    def _get_by_token(self, session: Session, token: str) -> dict:
        interview = self._service.get_by_token(session, token)
        if interview is None:
            raise HTTPException(status_code=404, detail="Interview not found")
        if self._is_expired(interview):
            raise HTTPException(status_code=410, detail="Interview link has expired")
        return interview.model_dump()

    def _start(self, session: Session, token: str) -> dict:
        interview = self._require_valid_interview(session, token)
        updated = self._service.start_interview(session, interview)
        return updated.model_dump()

    def _get_or_create_response(
        self,
        session: Session,
        token: str,
        question_index: int,
    ) -> dict:
        interview = self._require_valid_interview(session, token)
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
        self._require_valid_interview(session, token)
        chunk_data = chunk.file.read()
        self._service.record_chunk(
            session, response_id, chunk_index, chunk_data, self._upload_dir
        )
        return {"status": "ok", "chunk_index": chunk_index}

    def _complete_response(
        self,
        session: Session,
        token: str,
        response_id: str,
        body: CompleteResponseRequest,
    ) -> dict:
        self._require_valid_interview(session, token)
        response = self._service.complete_response(session, response_id, body.total_chunks)
        return response.model_dump()

    def _complete(self, session: Session, token: str) -> dict:
        interview = self._require_valid_interview(session, token)
        updated = self._service.complete_interview(session, interview)
        return updated.model_dump()
