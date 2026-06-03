import io
import json
from datetime import datetime, timedelta, timezone
import pytest

from candid.services.crypto import CryptoService
from candid.services.cv_extractor import CVExtractor
from candid.services.otp_service import OtpService


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
        hash_a = self.service.hash_otp("123456")
        hash_b = self.service.hash_otp("654321")
        assert hash_a != hash_b

    def test_hashOtp_shouldReturnSameHashForSameCode_whenCalledTwice(self) -> None:
        otp_code = "999999"
        assert self.service.hash_otp(otp_code) == self.service.hash_otp(otp_code)

    def test_isExpired_shouldReturnTrue_whenExpiryIsInThePast(self) -> None:
        past_expiry = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        assert self.service.is_expired(past_expiry) is True

    def test_isExpired_shouldReturnFalse_whenExpiryIsInTheFuture(self) -> None:
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        assert self.service.is_expired(future_expiry) is False

    def test_verify_shouldReturnTrue_whenCodeCorrectAndNotExpired(self) -> None:
        otp_code = "123456"
        stored_hash = self.service.hash_otp(otp_code)
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        assert self.service.verify(otp_code, stored_hash, future_expiry) is True

    def test_verify_shouldReturnFalse_whenCodeWrong(self) -> None:
        stored_hash = self.service.hash_otp("123456")
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        assert self.service.verify("000000", stored_hash, future_expiry) is False

    def test_verify_shouldReturnFalse_whenExpired(self) -> None:
        otp_code = "123456"
        stored_hash = self.service.hash_otp(otp_code)
        past_expiry = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        assert self.service.verify(otp_code, stored_hash, past_expiry) is False
