import io
import json
import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from candid.services.crypto import CryptoService
from candid.services.cv_extractor import CVExtractor
from candid.services.notification_service import NotificationService


class TestCryptoService:
    def setup_method(self) -> None:
        from cryptography.fernet import Fernet
        self.key = Fernet.generate_key().decode()
        self.svc = CryptoService(self.key)

    def test_encrypt_decrypt_roundtrip(self) -> None:
        plaintext = "sk-test-api-key-12345"
        assert self.svc.decrypt(self.svc.encrypt(plaintext)) == plaintext

    def test_encrypt_produces_different_ciphertext(self) -> None:
        plaintext = "same-input"
        # Fernet uses a random IV so ciphertexts differ
        assert self.svc.encrypt(plaintext) != self.svc.encrypt(plaintext)

    def test_decrypt_wrong_key_raises(self) -> None:
        from cryptography.fernet import Fernet
        other = CryptoService(Fernet.generate_key().decode())
        ciphertext = self.svc.encrypt("secret")
        with pytest.raises(Exception):
            other.decrypt(ciphertext)

    def test_mask_short_string(self) -> None:
        assert self.svc.mask("abc") == "****"

    def test_mask_long_string(self) -> None:
        result = self.svc.mask("sk-1234567890abcdef")
        assert result.startswith("sk-1")
        assert "****" in result
        assert result.endswith("cdef")

    def test_no_key_raises_on_encrypt(self) -> None:
        svc = CryptoService(key=None)
        with pytest.raises(RuntimeError, match="FERNET_KEY"):
            svc.encrypt("hello")


class TestCVExtractor:
    def setup_method(self) -> None:
        self.extractor = CVExtractor()

    def test_unsupported_extension_raises(self) -> None:
        with pytest.raises(ValueError, match="Unsupported"):
            self.extractor.extract("resume.txt", b"some text")

    def test_missing_extension_raises(self) -> None:
        with pytest.raises(ValueError):
            self.extractor.extract("resume", b"data")

    def test_docx_extraction(self) -> None:
        # Build a minimal DOCX in memory
        from docx import Document
        doc = Document()
        doc.add_paragraph("John Doe")
        doc.add_paragraph("Senior Engineer at Acme")
        buf = io.BytesIO()
        doc.save(buf)
        text = self.extractor.extract("cv.docx", buf.getvalue())
        assert "John Doe" in text
        assert "Senior Engineer" in text

    def test_pdf_image_only_raises(self) -> None:
        # A real image-only PDF is hard to construct in tests;
        # we verify the error path by patching fitz.
        import unittest.mock as mock
        mock_page = mock.MagicMock()
        mock_page.get_text.return_value = ""
        mock_doc = mock.MagicMock()
        mock_doc.__iter__ = mock.Mock(return_value=iter([mock_page]))
        with mock.patch("fitz.open", return_value=mock_doc):
            with pytest.raises(ValueError, match="image-only"):
                self.extractor.extract("scan.pdf", b"fake-pdf-bytes")


def _make_in_memory_session():
    """Return a fresh SQLite in-memory session with all tables created."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


class TestNotificationService:
    def setup_method(self) -> None:
        self.service = NotificationService()
        self.session = _make_in_memory_session()

    def teardown_method(self) -> None:
        self.session.close()

    def test_createNotification_shouldPersistRecord_whenCalledWithValidArgs(self) -> None:
        notification = self.service.create_notification(
            session=self.session,
            org_id="org-1",
            user_id="user-1",
            category="system",
            title="Test title",
            body="Test body",
            entity_id="ent-1",
            entity_type="candidate",
        )
        assert notification.id.startswith("ntf-")
        assert notification.org_id == "org-1"
        assert notification.user_id == "user-1"
        assert notification.category == "system"
        assert notification.title == "Test title"
        assert notification.body == "Test body"
        assert notification.entity_id == "ent-1"
        assert notification.entity_type == "candidate"
        assert notification.is_read is False

    def test_createCandidateAddedNotification_shouldSetCorrectCategoryAndTitle(self) -> None:
        notification = self.service.create_candidate_added_notification(
            session=self.session,
            org_id="org-1",
            user_id="user-1",
            candidate_first_name="Jane",
            candidate_last_name="Doe",
            candidate_id="c-abc",
        )
        assert notification.category == "candidate"
        assert "Jane Doe" in notification.title
        assert notification.entity_id == "c-abc"
        assert notification.entity_type == "candidate"
        assert notification.is_read is False

    def test_createAnalysisCompleteNotification_shouldSetCorrectCategoryAndTitle(self) -> None:
        notification = self.service.create_analysis_complete_notification(
            session=self.session,
            org_id="org-1",
            user_id="user-1",
            candidate_first_name="Jane",
            candidate_id="c-abc",
        )
        assert notification.category == "analysis"
        assert "Jane" in notification.title
        assert notification.entity_id == "c-abc"
        assert notification.entity_type == "candidate"

    def test_createInvitationAcceptedNotification_shouldSetCorrectCategoryAndTitle(self) -> None:
        notification = self.service.create_invitation_accepted_notification(
            session=self.session,
            org_id="org-1",
            user_id="user-1",
            invitee_email="newmember@example.com",
            org_name="Acme Corp",
        )
        assert notification.category == "invitation"
        assert "newmember@example.com" in notification.title
        assert "Acme Corp" in notification.title
        assert notification.entity_type == "invitation"

    def test_createNotification_shouldGenerateUniqueIds_whenCalledTwice(self) -> None:
        notification_a = self.service.create_notification(
            session=self.session,
            org_id="org-1",
            user_id="user-1",
            category="system",
            title="First",
            body="Body",
            entity_id="e-1",
            entity_type="candidate",
        )
        notification_b = self.service.create_notification(
            session=self.session,
            org_id="org-1",
            user_id="user-1",
            category="system",
            title="Second",
            body="Body",
            entity_id="e-2",
            entity_type="candidate",
        )
        assert notification_a.id != notification_b.id
