import json
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlmodel import Session, select

from candid.commons.models import VideoInterview, VideoResponse


class VideoInterviewService:
    _EXPIRY_DAYS = 7
    MAX_CHUNKS = 360            # 30 min per answer at the 5 s timeslice used by the video portal

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

    def get_by_token(self, session: Session, token: str) -> VideoInterview | None:
        statement = select(VideoInterview).where(VideoInterview.invite_token == token)
        return session.exec(statement).first()

    def start_interview(self, session: Session, interview: VideoInterview) -> VideoInterview:
        interview.status = "in_progress"
        interview.started_at = datetime.now(UTC).isoformat()
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
        interview: VideoInterview,
        response_id: str,
        chunk_index: int,
        chunk_data: bytes,
        upload_dir: Path,
    ) -> None:
        response = self.require_response(session, interview, response_id)
        if response.status == "complete":
            raise ValueError("Response already completed")
        if not 0 <= chunk_index < self.MAX_CHUNKS:
            raise ValueError("Chunk index out of range")
        is_new_chunk = not self._chunk_path(upload_dir, response.id, chunk_index).exists()
        self._write_chunk_to_disk(response.id, chunk_index, chunk_data, upload_dir)
        if is_new_chunk:
            response.received_chunks += 1
            session.add(response)
            session.commit()

    def complete_response(
        self,
        session: Session,
        interview: VideoInterview,
        response_id: str,
        total_chunks: int,
    ) -> VideoResponse:
        response = self.require_response(session, interview, response_id)
        if not 0 <= total_chunks <= self.MAX_CHUNKS:
            raise ValueError("total_chunks out of range")
        response.status = "complete"
        response.total_chunks = total_chunks
        response.completed_at = datetime.now(UTC).isoformat()
        session.add(response)
        session.commit()
        session.refresh(response)
        return response

    def list_responses(self, session: Session, interview: VideoInterview) -> list[VideoResponse]:
        statement = (
            select(VideoResponse)
            .where(VideoResponse.video_interview_id == interview.id)
            .order_by(VideoResponse.question_index)
        )
        return list(session.exec(statement).all())

    def chunk_paths(self, response: VideoResponse, upload_dir: Path) -> list[Path]:
        """Recorded chunks in order; concatenated they form one playable WebM file."""
        paths = [self._chunk_path(upload_dir, response.id, i) for i in range(response.total_chunks or self.MAX_CHUNKS)]
        return [p for p in paths if p.exists()]

    def complete_interview(self, session: Session, interview: VideoInterview) -> VideoInterview:
        interview.status = "completed"
        interview.completed_at = datetime.now(UTC).isoformat()
        session.add(interview)
        session.commit()
        session.refresh(interview)
        return interview

    def list_by_org(self, session: Session, org_id: str, candidate_id: str | None = None) -> list[VideoInterview]:
        statement = select(VideoInterview).where(VideoInterview.org_id == org_id)
        if candidate_id:
            statement = statement.where(VideoInterview.candidate_id == candidate_id)
        return list(session.exec(statement.order_by(VideoInterview.created_at.desc())).all())

    def get_by_id_and_org(
        self,
        session: Session,
        video_interview_id: str,
        org_id: str,
    ) -> VideoInterview | None:
        statement = select(VideoInterview).where(
            VideoInterview.id == video_interview_id,
            VideoInterview.org_id == org_id,
        )
        return session.exec(statement).first()

    def _expiry_timestamp(self) -> str:
        return (datetime.now(UTC) + timedelta(days=self._EXPIRY_DAYS)).isoformat()

    def _find_response(
        self,
        session: Session,
        video_interview_id: str,
        question_index: int,
    ) -> VideoResponse | None:
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

    def _chunk_path(self, upload_dir: Path, response_id: str, chunk_index: int) -> Path:
        return upload_dir / "video" / response_id / f"chunk_{chunk_index}.webm"

    def _write_chunk_to_disk(
        self,
        response_id: str,
        chunk_index: int,
        chunk_data: bytes,
        upload_dir: Path,
    ) -> None:
        chunk_path = self._chunk_path(upload_dir, response_id, chunk_index)
        chunk_path.parent.mkdir(parents=True, exist_ok=True)
        chunk_path.write_bytes(chunk_data)

    def require_response(self, session: Session, interview: VideoInterview, response_id: str) -> VideoResponse:
        """The response must belong to *this* interview: a valid token never grants access to others."""
        statement = select(VideoResponse).where(
            VideoResponse.id == response_id,
            VideoResponse.video_interview_id == interview.id,
        )
        response = session.exec(statement).first()
        if response is None:
            raise LookupError(f"VideoResponse not found: {response_id}")
        return response
