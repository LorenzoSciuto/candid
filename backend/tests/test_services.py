import io
import json
from datetime import datetime, timedelta, timezone
import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from unittest.mock import MagicMock, patch

from candid.services.auth_service import create_token, verify_token
from candid.services.crypto import CryptoService
from candid.services.cv_extractor import CVExtractor
from candid.services.notification_service import NotificationService
from candid.services.otp_service import OtpService
from candid.services.email_service import EmailService


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


class TestOtpService:
    def setup_method(self) -> None:
        self.service = OtpService()

    def test_generateOtp_shouldReturnSixDigitString(self) -> None:
        otp_code = self.service.generate_otp()
        assert len(otp_code) == 6
        assert otp_code.isdigit()

    def test_hashOtp_shouldReturnDifferentHashForDifferentCodes(self) -> None:
        assert self.service.hash_otp("123456") != self.service.hash_otp("654321")

    def test_hashOtp_shouldReturnSameHashForSameCode_whenCalledTwice(self) -> None:
        assert self.service.hash_otp("999999") == self.service.hash_otp("999999")

    def test_isExpired_shouldReturnTrue_whenExpiryIsInThePast(self) -> None:
        assert self.service.is_expired((datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()) is True

    def test_isExpired_shouldReturnFalse_whenExpiryIsInTheFuture(self) -> None:
        assert self.service.is_expired((datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()) is False

    def test_verify_shouldReturnTrue_whenCodeCorrectAndNotExpired(self) -> None:
        stored_hash = self.service.hash_otp("123456")
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        assert self.service.verify("123456", stored_hash, future_expiry) is True

    def test_verify_shouldReturnFalse_whenCodeWrong(self) -> None:
        stored_hash = self.service.hash_otp("123456")
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        assert self.service.verify("000000", stored_hash, future_expiry) is False

    def test_verify_shouldReturnFalse_whenExpired(self) -> None:
        stored_hash = self.service.hash_otp("123456")
        past_expiry = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        assert self.service.verify("123456", stored_hash, past_expiry) is False


def _make_in_memory_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
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
            session=self.session, org_id="org-1", user_id="user-1",
            category="system", title="Test title", body="Test body",
            entity_id="ent-1", entity_type="candidate",
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
            session=self.session, org_id="org-1", user_id="user-1",
            candidate_first_name="Jane", candidate_last_name="Doe", candidate_id="c-abc",
        )
        assert notification.category == "candidate"
        assert "Jane Doe" in notification.title
        assert notification.entity_id == "c-abc"
        assert notification.entity_type == "candidate"
        assert notification.is_read is False

    def test_createAnalysisCompleteNotification_shouldSetCorrectCategoryAndTitle(self) -> None:
        notification = self.service.create_analysis_complete_notification(
            session=self.session, org_id="org-1", user_id="user-1",
            candidate_first_name="Jane", candidate_id="c-abc",
        )
        assert notification.category == "analysis"
        assert "Jane" in notification.title
        assert notification.entity_id == "c-abc"

    def test_createInvitationAcceptedNotification_shouldSetCorrectCategoryAndTitle(self) -> None:
        notification = self.service.create_invitation_accepted_notification(
            session=self.session, org_id="org-1", user_id="user-1",
            invitee_email="newmember@example.com", org_name="Acme Corp",
        )
        assert notification.category == "invitation"
        assert "newmember@example.com" in notification.title
        assert "Acme Corp" in notification.title
        assert notification.entity_type == "invitation"

    def test_createNotification_shouldGenerateUniqueIds_whenCalledTwice(self) -> None:
        notification_a = self.service.create_notification(
            session=self.session, org_id="org-1", user_id="user-1",
            category="system", title="First", body="Body", entity_id="e-1", entity_type="candidate",
        )
        notification_b = self.service.create_notification(
            session=self.session, org_id="org-1", user_id="user-1",
            category="system", title="Second", body="Body", entity_id="e-2", entity_type="candidate",
        )
        assert notification_a.id != notification_b.id


class TestAuthService:
    _SECRET = "test-secret-at-least-32-bytes-long!!"

    def test_create_and_verify_roundtrip(self) -> None:
        token = create_token({"sub": "user-1", "email": "a@b.com"}, self._SECRET)
        payload = verify_token(token, self._SECRET)
        assert payload["sub"] == "user-1"
        assert payload["email"] == "a@b.com"

    def test_verify_wrong_secret_raises(self) -> None:
        import jwt
        token = create_token({"sub": "x"}, self._SECRET)
        with pytest.raises(jwt.PyJWTError):
            verify_token(token, "wrong-secret-but-still-32-bytes!!!")

    def test_expired_token_raises(self) -> None:
        import jwt
        payload = {
            "sub": "user-exp",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
            "iat": datetime.now(timezone.utc) - timedelta(hours=1),
        }
        token = jwt.encode(payload, self._SECRET, algorithm="HS256")
        with pytest.raises(jwt.ExpiredSignatureError):
            verify_token(token, self._SECRET)


class TestEmailService:
    def _make_svc(self, host=None) -> EmailService:
        return EmailService(host, 587, None, None, "noreply@test.com", "http://localhost:8080")

    def test_is_configured_false_when_no_host(self) -> None:
        assert self._make_svc().is_configured() is False

    def test_is_configured_true_when_host_set(self) -> None:
        assert self._make_svc("smtp.example.com").is_configured() is True

    def test_send_email_raises_when_not_configured(self) -> None:
        with pytest.raises(RuntimeError, match="SMTP not configured"):
            self._make_svc().send_email("a@b.com", "Subject", "Body")

    def test_send_invitation_no_host_does_not_raise(self) -> None:
        self._make_svc().send_invitation("a@b.com", "Acme", "Alice", "tok-abc")

    def test_send_invitation_sends_via_smtp(self) -> None:
        svc = self._make_svc("smtp.example.com")
        mock_smtp = MagicMock()
        with patch("candid.services.email_service.smtplib.SMTP", return_value=mock_smtp) as mock_cls:
            mock_cls.return_value.__enter__ = MagicMock(return_value=mock_smtp)
            mock_cls.return_value.__exit__ = MagicMock(return_value=False)
            svc.send_invitation("a@b.com", "Acme", "Alice", "tok-abc")
        mock_smtp.send_message.assert_called_once()

    def test_send_email_sends_via_smtp(self) -> None:
        svc = self._make_svc("smtp.example.com")
        mock_smtp = MagicMock()
        with patch("candid.services.email_service.smtplib.SMTP", return_value=mock_smtp) as mock_cls:
            mock_cls.return_value.__enter__ = MagicMock(return_value=mock_smtp)
            mock_cls.return_value.__exit__ = MagicMock(return_value=False)
            svc.send_email("a@b.com", "Hello", "World")
        mock_smtp.send_message.assert_called_once()
