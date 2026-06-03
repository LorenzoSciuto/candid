import io
import pytest
from unittest.mock import MagicMock, patch

from candid.services.auth_service import create_token, verify_token
from candid.services.crypto import CryptoService
from candid.services.cv_extractor import CVExtractor
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
        from datetime import datetime, timedelta, timezone
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
