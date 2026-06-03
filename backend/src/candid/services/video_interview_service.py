import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from sqlmodel import Session, select

from candid.models import VideoInterview, VideoResponse


class VideoInterviewService:
    _EXPIRY_DAYS = 7

    def create_invite(
        self,
        session: Session,
        org_id: str,
        candidate_id: str,
        questions: list[str],
    ) -> VideoInterview:
        interview = VideoInterview(
            org_id=org_id,
            candidate_id=candidate_id,
            invite_token=str(uuid.uuid4()),
            questions=json.dumps(questions),
            expires_at=self._expiry_timestamp(),
        )
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def get_by_token(self, session: Session, token: str) -> Optional[VideoInterview]:
        statement = select(VideoInterview).where(VideoInterview.invite_token == token)
        return session.exec(statement).first()

    def start_interview(self, session: Session, interview: VideoInterview) -> VideoInterview:
        interview.status = "in_progress"
        interview.started_at = datetime.now(timezone.utc).isoformat()
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def get_or_create_response(
        self,
        session: Session,
        video_interview_id: str,
        question_index: int,
    ) -> VideoResponse:
        existing = self._find_response(session, video_interview_id, question_index)
        if existing:
            return existing
        return self._create_response(session, video_interview_id, question_index)

    def record_chunk(
        self,
        session: Session,
        response_id: str,
        chunk_index: int,
        chunk_data: bytes,
        upload_dir: Path,
    ) -> None:
        self._write_chunk_to_disk(response_id, chunk_index, chunk_data, upload_dir)
        self._increment_received_chunks(session, response_id)

    def complete_response(
        self,
        session: Session,
        response_id: str,
        total_chunks: int,
    ) -> VideoResponse:
        response = self._require_response_by_id(session, response_id)
        response.status = "complete"
        response.total_chunks = total_chunks
        response.completed_at = datetime.now(timezone.utc).isoformat()
        session.add(response)
        session.commit()
        session.refresh(response)
        return response

    def complete_interview(self, session: Session, interview: VideoInterview) -> VideoInterview:
        interview.status = "completed"
        interview.completed_at = datetime.now(timezone.utc).isoformat()
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def list_by_org(self, session: Session, org_id: str) -> list[VideoInterview]:
        statement = select(VideoInterview).where(VideoInterview.org_id == org_id)
        return list(session.exec(statement).all())

    def get_by_id_and_org(
        self,
        session: Session,
        video_interview_id: str,
        org_id: str,
    ) -> Optional[VideoInterview]:
        statement = select(VideoInterview).where(
            VideoInterview.id == video_interview_id,
            VideoInterview.org_id == org_id,
        )
        return session.exec(statement).first()

    def _expiry_timestamp(self) -> str:
        return (datetime.now(timezone.utc) + timedelta(days=self._EXPIRY_DAYS)).isoformat()

    def _find_response(
        self,
        session: Session,
        video_interview_id: str,
        question_index: int,
    ) -> Optional[VideoResponse]:
        statement = select(VideoResponse).where(
            VideoResponse.video_interview_id == video_interview_id,
            VideoResponse.question_index == question_index,
        )
        return session.exec(statement).first()

    def _create_response(
        self,
        session: Session,
        video_interview_id: str,
        question_index: int,
    ) -> VideoResponse:
        response = VideoResponse(
            video_interview_id=video_interview_id,
            question_index=question_index,
        )
        session.add(response)
        session.commit()
        session.refresh(response)
        return response

    def _write_chunk_to_disk(
        self,
        response_id: str,
        chunk_index: int,
        chunk_data: bytes,
        upload_dir: Path,
    ) -> None:
        chunk_dir = upload_dir / "video" / response_id
        chunk_dir.mkdir(parents=True, exist_ok=True)
        chunk_path = chunk_dir / f"chunk_{chunk_index}.webm"
        chunk_path.write_bytes(chunk_data)

    def _increment_received_chunks(self, session: Session, response_id: str) -> None:
        response = self._require_response_by_id(session, response_id)
        response.received_chunks += 1
        session.add(response)
        session.commit()

    def _require_response_by_id(self, session: Session, response_id: str) -> VideoResponse:
        statement = select(VideoResponse).where(VideoResponse.id == response_id)
        response = session.exec(statement).first()
        if response is None:
            raise ValueError(f"VideoResponse not found: {response_id}")
        return response
