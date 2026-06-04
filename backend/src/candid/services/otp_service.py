import hashlib
import random
import string
from datetime import datetime, timedelta, timezone


class OtpService:
    _OTP_LENGTH: int = 6
    _OTP_TTL_MINUTES: int = 10

    def generate_otp(self) -> str:
        """Return a zero-padded 6-digit string."""
        digits = random.choices(string.digits, k=self._OTP_LENGTH)
        return "".join(digits).zfill(self._OTP_LENGTH)

    def hash_otp(self, otp_code: str) -> str:
        """Return SHA-256 hex digest of the OTP string."""
        return hashlib.sha256(otp_code.encode()).hexdigest()

    def compute_expiry(self) -> str:
        """Return UTC ISO datetime string 10 minutes from now."""
        expiry_timestamp = datetime.now(timezone.utc) + timedelta(minutes=self._OTP_TTL_MINUTES)
        return expiry_timestamp.isoformat()

    def is_expired(self, expiry_timestamp: str) -> bool:
        """Return True if expiry_timestamp is in the past."""
        expiry_datetime = datetime.fromisoformat(expiry_timestamp)
        return datetime.now(timezone.utc) >= expiry_datetime

    def verify(self, otp_code: str, stored_hash: str, expiry_timestamp: str) -> bool:
        """Return True iff hash matches and not expired."""
        if self.is_expired(expiry_timestamp):
            return False
        return self.hash_otp(otp_code) == stored_hash
