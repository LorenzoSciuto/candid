import io
import json
import unittest.mock as mock

from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngine

_ANALYZE_RESPONSE = json.dumps({
    "overview": "Strong backend engineer with 8 years of experience.",
    "strengths": ["Distributed systems", "Python expertise"],
    "weaknesses": ["Frontend skills limited"],
    "deep_dive_questions": ["Describe your largest scale system."],
    "extracted_info": {
        "role": "Senior Backend Engineer",
        "location": "San Francisco",
        "experience": 8,
    },
    "career_history": [
        {"title": "Senior Engineer", "company": "Acme", "period": "2020–2024", "description": "Led backend platform."},
    ],
    "role_fits": [
        {"title": "Backend Lead", "score": 4.5, "reason": "Strong match."},
    ],
})


def _make_candidate(client: TestClient, **kwargs) -> str:
    payload = {"first_name": "A", "last_name": "B", **kwargs}
    return client.post("/candidates", json=payload).json()["id"]


def _make_docx_bytes() -> bytes:
    from docx import Document
    doc = Document()
    doc.add_paragraph("Jane Doe")
    doc.add_paragraph("Senior Engineer at Acme Corp, 8 years experience.")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ── Upload CV ─────────────────────────────────────────────────────────────────

class TestUploadCv:
    def test_upload_docx_returns_text_and_wordcount(self, client: TestClient) -> None:
        content = _make_docx_bytes()
        resp = client.post(
            "/upload-cv",
            files={"file": ("resume.docx", content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "Jane Doe" in data["text"]
        assert data["word_count"] > 0
        assert data["filename"] == "resume.docx"

    def test_upload_unsupported_type_returns_400(self, client: TestClient) -> None:
        resp = client.post(
            "/upload-cv",
            files={"file": ("notes.txt", b"some plain text", "text/plain")},
        )
        assert resp.status_code == 400

    def test_upload_empty_pdf_returns_400(self, client: TestClient) -> None:
        # Simulate image-only PDF (extractor raises ValueError)
        with mock.patch("candid.services.cv_extractor.CVExtractor.extract", side_effect=ValueError("image-only")):
            resp = client.post(
                "/upload-cv",
                files={"file": ("scan.pdf", b"fake-pdf", "application/pdf")},
            )
        assert resp.status_code == 400


# ── Analyze ───────────────────────────────────────────────────────────────────

class TestAnalyze:
    def test_returns_analysis_result(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", return_value=_ANALYZE_RESPONSE):
            resp = client.post("/analyze", json={
                "cv_text": "Jane Doe, Senior Engineer at Acme.",
                "job_title": "Backend Lead",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["overview"].startswith("Strong backend")
        assert "Distributed systems" in data["strengths"]
        assert len(data["career_history"]) == 1

    def test_stores_analysis_on_candidate(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        with mock.patch.object(AIEngine, "_call", return_value=_ANALYZE_RESPONSE):
            client.post("/analyze", json={
                "candidate_id": cid,
                "cv_text": "Jane Doe, 8 years backend.",
                "job_title": "Backend Lead",
            })
        detail = client.get(f"/candidates/{cid}").json()
        assert detail["ai_pre_analysis"]["overview"].startswith("Strong backend")
        assert detail["cv_text"] == "Jane Doe, 8 years backend."

    def test_stores_career_history_on_candidate(self, client: TestClient) -> None:
        cid = _make_candidate(client)
        with mock.patch.object(AIEngine, "_call", return_value=_ANALYZE_RESPONSE):
            client.post("/analyze", json={
                "candidate_id": cid,
                "cv_text": "Jane Doe cv text.",
                "job_title": "Backend Lead",
            })
        detail = client.get(f"/candidates/{cid}").json()
        assert isinstance(detail["career_history"], list)
        assert detail["career_history"][0]["company"] == "Acme"

    def test_backfills_current_role_when_missing(self, client: TestClient) -> None:
        cid = _make_candidate(client)  # no current_role
        with mock.patch.object(AIEngine, "_call", return_value=_ANALYZE_RESPONSE):
            client.post("/analyze", json={
                "candidate_id": cid,
                "cv_text": "Jane Doe cv.",
                "job_title": "Backend Lead",
            })
        detail = client.get(f"/candidates/{cid}").json()
        assert detail["current_role"] == "Senior Backend Engineer"

    def test_does_not_overwrite_existing_current_role(self, client: TestClient) -> None:
        cid = _make_candidate(client, current_role="Staff Engineer")
        with mock.patch.object(AIEngine, "_call", return_value=_ANALYZE_RESPONSE):
            client.post("/analyze", json={
                "candidate_id": cid,
                "cv_text": "Jane Doe cv.",
                "job_title": "Backend Lead",
            })
        detail = client.get(f"/candidates/{cid}").json()
        assert detail["current_role"] == "Staff Engineer"

    def test_no_candidate_id_still_returns_result(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", return_value=_ANALYZE_RESPONSE):
            resp = client.post("/analyze", json={
                "cv_text": "Jane Doe cv.",
                "job_title": "Backend Lead",
            })
        assert resp.status_code == 200
        assert "overview" in resp.json()

    def test_ai_error_returns_502(self, client: TestClient) -> None:
        with mock.patch.object(AIEngine, "_call", side_effect=RuntimeError("AI down")):
            resp = client.post("/analyze", json={
                "cv_text": "Jane Doe cv.",
                "job_title": "Backend Lead",
            })
        assert resp.status_code == 502

    def test_active_jds_passed_for_role_fit(self, client: TestClient) -> None:
        # Create a role, then an active JD linked to it
        role = client.post("/roles", json={"name": "Backend Lead", "headcount": 1}).json()
        client.post("/job-descriptions", json={
            "role_id": role["id"],
            "title": "Backend Lead",
            "status": "Active",
        })
        captured: list[str] = []

        def capture(prompt: str) -> str:
            captured.append(prompt)
            return _ANALYZE_RESPONSE

        with mock.patch.object(AIEngine, "_call", side_effect=capture):
            client.post("/analyze", json={"cv_text": "Jane Doe.", "job_title": "Backend"})

        assert len(captured) == 1
        assert "Backend Lead" in captured[0]

    def test_draft_jds_excluded_from_role_fit(self, client: TestClient) -> None:
        role = client.post("/roles", json={"name": "Draft Role", "headcount": 1}).json()
        client.post("/job-descriptions", json={
            "role_id": role["id"],
            "title": "Draft Role",
            "status": "Draft",
        })
        captured: list[str] = []

        def capture(prompt: str) -> str:
            captured.append(prompt)
            return _ANALYZE_RESPONSE

        with mock.patch.object(AIEngine, "_call", side_effect=capture):
            client.post("/analyze", json={"cv_text": "Jane Doe.", "job_title": "Backend"})

        assert "Draft Role" not in captured[0]
