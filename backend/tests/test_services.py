import io
import json
import pytest

from candid.services.crypto import CryptoService
from candid.services.cv_extractor import CVExtractor


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
