import io


class CVExtractor:
    _SUPPORTED = {"pdf", "docx", "doc"}

    def extract(self, filename: str, content: bytes) -> str:
        ext = self._extension(filename)
        if ext not in self._SUPPORTED:
            raise ValueError(
                f"Unsupported file type: .{ext}. "
                f"Accepted formats: {', '.join(sorted(self._SUPPORTED))}."
            )
        if ext == "pdf":
            return self._from_pdf(content)
        return self._from_docx(content)

    # ── Private ────────────────────────────────────────────────────────────────

    @staticmethod
    def _extension(filename: str) -> str:
        return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    @staticmethod
    def _from_pdf(content: bytes) -> str:
        import pymupdf

        doc = pymupdf.open(stream=content, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc).strip()
        doc.close()
        if not text:
            raise ValueError(
                "PDF contains no extractable text (image-only). "
                "Please use a text-based PDF."
            )
        return text

    @staticmethod
    def _from_docx(content: bytes) -> str:
        from docx import Document

        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
