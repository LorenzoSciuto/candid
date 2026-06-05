import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from sqlmodel import Session
    from candid.services.crypto import CryptoService

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, app_url) -> None:
        self._host = smtp_host
        self._port = smtp_port
        self._user = smtp_user
        self._password = smtp_password
        self._from = smtp_from
        self._app_url = app_url

    def send_email(self, to_email: str, subject: str, body: str) -> None:
        if not self._host:
            raise RuntimeError("SMTP not configured — set it in Settings → Email")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self._from
        msg["To"] = to_email
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP(self._host, self._port) as smtp:
            smtp.ehlo()
            smtp.starttls()
            if self._user and self._password:
                smtp.login(self._user, self._password)
            smtp.send_message(msg)
        logger.info("Email sent to %s", to_email)

    def is_configured(self) -> bool:
        return bool(self._host)

    def send_invitation(self, to_email: str, org_name: str, inviter_name: str, token: str) -> None:
        accept_url = f"{self._app_url}/index.html#accept-invite?token={token}"
        subject = f"You've been invited to join {org_name} on Candid"
        body_text = (
            f"Hi there,\n\n"
            f"{inviter_name} has invited you to join {org_name} on Candid, "
            f"the AI-powered recruiting assistant.\n\n"
            f"Accept the invitation:\n{accept_url}\n\n"
            f"This invitation expires in 7 days.\n\n"
            f"— The Candid Team"
        )
        body_html = f"""
<html><body style="font-family:sans-serif;color:#1c1917;max-width:520px;margin:40px auto;padding:0 20px">
  <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">You're invited to {org_name}</h2>
  <p style="color:#78716c">{inviter_name} has invited you to join <strong>{org_name}</strong> on Candid.</p>
  <a href="{accept_url}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#1c1917;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">
    Accept invitation →
  </a>
  <p style="color:#a8a29e;font-size:13px">This invitation expires in 7 days.<br>If you weren't expecting this, you can ignore this email.</p>
</body></html>"""

        if not self._host:
            logger.info(
                "SMTP not configured — invitation link for %s: %s", to_email, accept_url
            )
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self._from
        msg["To"] = to_email
        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        try:
            with smtplib.SMTP(self._host, self._port) as smtp:
                smtp.ehlo()
                smtp.starttls()
                if self._user and self._password:
                    smtp.login(self._user, self._password)
                smtp.send_message(msg)
            logger.info("Invitation sent to %s", to_email)
        except Exception:
            logger.exception("Failed to send invitation email to %s", to_email)
            raise

    def send_otp_email(self, recipient_email: str, otp_code: str, job_title: str) -> None:
        subject = f"Your verification code for {job_title}"
        body_text = self._build_otp_plain_body(otp_code, job_title)
        body_html = self._build_otp_html_body(otp_code, job_title)

        if not self._host:
            logger.info(
                "SMTP not configured — OTP for %s: %s", recipient_email, otp_code
            )
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self._from
        msg["To"] = recipient_email
        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        try:
            with smtplib.SMTP(self._host, self._port) as smtp:
                smtp.ehlo()
                smtp.starttls()
                if self._user and self._password:
                    smtp.login(self._user, self._password)
                smtp.send_message(msg)
            logger.info("OTP email sent to %s", recipient_email)
        except Exception:
            logger.exception("Failed to send OTP email to %s", recipient_email)
            raise

    def _build_otp_plain_body(self, otp_code: str, job_title: str) -> str:
        return (
            f"Hi there,\n\n"
            f"Your verification code for the {job_title} application is:\n\n"
            f"    {otp_code}\n\n"
            f"This code expires in 10 minutes.\n\n"
            f"If you did not request this code, you can safely ignore this email.\n\n"
            f"— The Candid Team"
        )

    def _build_otp_html_body(self, otp_code: str, job_title: str) -> str:
        return f"""
<html><body style="font-family:sans-serif;color:#1c1917;max-width:520px;margin:40px auto;padding:0 20px">
  <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Verify your application</h2>
  <p style="color:#78716c">Your verification code for the <strong>{job_title}</strong> application:</p>
  <div style="margin:24px 0;padding:20px;background:#f5f5f4;border-radius:12px;text-align:center">
    <span style="font-size:36px;font-weight:700;letter-spacing:0.15em;color:#1c1917">{otp_code}</span>
  </div>
  <p style="color:#a8a29e;font-size:13px">This code expires in 10 minutes.<br>If you did not request this, you can safely ignore this email.</p>
</body></html>"""


class LoggingEmailService:
    def __init__(
        self,
        email_service: EmailService,
        session: "Session",
        org_id: str,
        candidate_id: Optional[str] = None,
    ) -> None:
        self._email_service = email_service
        self._session = session
        self._org_id = org_id
        self._candidate_id = candidate_id

    def send_email(self, to_email: str, subject: str, body: str) -> None:
        self._email_service.send_email(to_email, subject, body)
        self._log_sent(to_email, subject, body, "general")

    def send_invitation(self, to_email: str, org_name: str, inviter_name: str, token: str) -> None:
        self._email_service.send_invitation(to_email, org_name, inviter_name, token)
        self._log_sent(to_email, f"You've been invited to join {org_name}", "", "invitation")

    def send_otp_email(self, recipient_email: str, otp_code: str, job_title: str) -> None:
        self._email_service.send_otp_email(recipient_email, otp_code, job_title)
        self._log_sent(recipient_email, f"Your verification code for {job_title}", "", "otp")

    def _log_sent(self, to_email: str, subject: str, body: str, email_type: str) -> None:
        from candid.models import EmailLog
        log_entry = EmailLog(
            org_id=self._org_id,
            direction="sent",
            to_email=to_email,
            from_email=self._email_service._from,
            subject=subject,
            body=body,
            email_type=email_type,
            candidate_id=self._candidate_id,
        )
        try:
            self._session.add(log_entry)
            self._session.commit()
        except Exception:
            logger.warning("Failed to log sent email", exc_info=True)
            self._session.rollback()


class EmailServiceFactory:
    def __init__(self, crypto_service: "CryptoService", app_url: str) -> None:
        self._crypto_service = crypto_service
        self._app_url = app_url

    def from_session(
        self,
        session: "Session",
        org_id: str,
        candidate_id: Optional[str] = None,
    ) -> Optional[LoggingEmailService]:
        from candid.models import OrgConfig
        cfg = session.get(OrgConfig, org_id)
        if not cfg or not cfg.smtp_host:
            return None
        password = None
        if cfg.smtp_password_encrypted:
            try:
                password = self._crypto_service.decrypt(cfg.smtp_password_encrypted)
            except Exception:
                pass
        email_service = EmailService(
            smtp_host=cfg.smtp_host,
            smtp_port=cfg.smtp_port,
            smtp_user=cfg.smtp_user,
            smtp_password=password,
            smtp_from=cfg.smtp_from or cfg.smtp_user or "noreply@candid.app",
            app_url=self._app_url,
        )
        return LoggingEmailService(email_service, session, org_id, candidate_id)
