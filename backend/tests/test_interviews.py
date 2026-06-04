import io
import json
import unittest.mock as mock

from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngine
from candid.services.transcription_service import TranscriptionResult, TranscriptionService


def _make_candidate(client: TestClient) -> str:
    resp = client.post("/candidates", json={"first_name": "A", "last_name": "B"})
    return resp.json()["id"]


class TestCreateInterview:
    def test_creates_with_candidate_id(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        resp = client.post("/interviews", json={
            "candidate_id": cid,
            "type": "Manual Paste",
            "title": "Recruiter Screen",
            "interviewer": "Devon Park",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"].startswith("i-")
        assert data["candidate_id"] == cid


class TestListInterviews:
    def test_filters_by_candidate(self, client: TestClient) -> None:
        cid1 = _make_candidate(client)
        cid2 = _make_candidate(client)
        client.post("/interviews", json={"candidate_id": cid1, "type": "Manual Paste"})
        client.post("/interviews", json={"candidate_id": cid2, "type": "Live Recording"})

        resp = client.get(f"/interviews?candidate_id={cid1}")
        assert all(i["candidate_id"] == cid1 for i in resp.json())

    def test_returns_all_without_filter(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"})
        client.post("/interviews", json={"candidate_id": cid, "type": "Live Recording"})
        resp = client.get("/interviews")
        assert len(resp.json()) == 2


class TestUpdateInterview:
    def test_updates_fields(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        created = client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"}).json()
        resp = client.patch(f"/interviews/{created['id']}", json={"duration": "42m", "title": "Tech Screen"})
        assert resp.status_code == 200
        assert resp.json()["duration"] == "42m"

    def test_404_for_unknown(self, client: TestClient) -> None:
        resp = client.patch("/interviews/nonexistent", json={"duration": "10m"})
        assert resp.status_code == 404


class TestProcessInterview:
    _AI_RESPONSE = """{
        "cleaned_transcript": "[Interviewer]: Tell me about yourself.\\n[Candidate]: Sure.",
        "summary": "Candidate showed good communication skills.",
        "extra_info": "Mentioned distributed systems experience."
    }"""

    def test_stores_cleaned_transcript_and_summary(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        iid = client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"}).json()["id"]
        with mock.patch.object(AIEngine, "_call", return_value=self._AI_RESPONSE):
            resp = client.post(f"/interviews/{iid}/process", json={
                "raw_content": "Interviewer: Tell me about yourself. Candidate: Sure."
            })
        assert resp.status_code == 200
        data = resp.json()
        assert "Interviewer" in data["cleaned_transcript"]
        assert data["ai_summary"] == "Candidate showed good communication skills."

    def test_404_for_unknown_interview(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", return_value=self._AI_RESPONSE):
            resp = client.post("/interviews/nonexistent/process", json={"raw_content": "x"})
        assert resp.status_code == 404

    def test_ai_error_returns_502(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        iid = client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"}).json()["id"]
        with mock.patch.object(AIEngine, "_call", side_effect=RuntimeError("AI down")):
            resp = client.post(f"/interviews/{iid}/process", json={"raw_content": "some text"})
        assert resp.status_code == 502


class TestUploadAudio:
    _MOCK_TRANSCRIPTION_RESULT = TranscriptionResult(
        text="Hello, my name is Alex.",
        language="en",
        duration_seconds=4.0,
    )
    _MOCK_EVALUATION_JSON = json.dumps({
        "strengths": ["Articulate"],
        "concerns": [],
        "recommendation": "yes",
        "score": 8,
        "summary": "Good candidate.",
    })

    def test_uploadAudio_shouldReturn200_whenValidFile(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        iid = client.post("/interviews", json={"candidate_id": cid, "type": "Audio Upload"}).json()["id"]

        fake_audio = io.BytesIO(b"RIFF fake wav data")
        fake_audio.name = "recording.wav"

        with mock.patch.object(TranscriptionService, "transcribe", return_value=self._MOCK_TRANSCRIPTION_RESULT):
            with mock.patch.object(AIEngine, "_call", return_value=self._MOCK_EVALUATION_JSON):
                resp = client.post(
                    f"/interviews/{iid}/upload-audio",
                    files={"file": ("recording.wav", fake_audio, "audio/wav")},
                )

        assert resp.status_code == 200
        assert resp.json()["status"] == "processing"

    def test_uploadAudio_shouldReturn404_whenInterviewNotFound(self, client: TestClient) -> None:
        fake_audio = io.BytesIO(b"RIFF fake wav data")
        resp = client.post(
            "/interviews/nonexistent/upload-audio",
            files={"file": ("recording.wav", fake_audio, "audio/wav")},
        )
        assert resp.status_code == 404


class TestGetTranscript:
    def test_getTranscript_shouldReturn200_whenInterviewExists(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        iid = client.post("/interviews", json={"candidate_id": cid, "type": "Manual Paste"}).json()["id"]

        resp = client.get(f"/interviews/{iid}/transcript")

        assert resp.status_code == 200
        data = resp.json()
        assert "transcript_raw" in data
        assert "transcript_status" in data
        assert "transcript_language" in data
        assert "ai_evaluation" in data

    def test_getTranscript_shouldReturn404_whenInterviewNotFound(self, client: TestClient) -> None:
        resp = client.get("/interviews/nonexistent/transcript")
        assert resp.status_code == 404
