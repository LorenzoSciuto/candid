from typing import Optional

from cryptography.fernet import Fernet


class CryptoService:
    _MASK_VISIBLE = 4  # chars shown at each end

    def __init__(self, key: Optional[str] = None) -> None:
        self._fernet: Optional[Fernet] = Fernet(key.encode()) if key else None

    # ── Public interface ───────────────────────────────────────────────────────

    def encrypt(self, plaintext: str) -> str:
        self._require_key()
        return self._fernet.encrypt(plaintext.encode()).decode()  # type: ignore[union-attr]

    def decrypt(self, ciphertext: str) -> str:
        self._require_key()
        return self._fernet.decrypt(ciphertext.encode()).decode()  # type: ignore[union-attr]

    def mask(self, plaintext: str) -> str:
        n = self._MASK_VISIBLE
        if len(plaintext) <= n * 2:
            return "****"
        return plaintext[:n] + "*" * (len(plaintext) - n * 2) + plaintext[-n:]

    # ── Internal ───────────────────────────────────────────────────────────────

    def _require_key(self) -> None:
        if self._fernet is None:
            raise RuntimeError(
                "FERNET_KEY is not configured. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\""
            )
