import html
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlmodel import Session

    from candid.services.crypto import CryptoService

logger = logging.getLogger(__name__)


class EmailService:
    _IMPLICIT_TLS_PORT = 465

    def __init__(self, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, app_url) -> None:
        self._host = smtp_host
        self._port = smtp_port
        self._user = smtp_user
        self._password = smtp_password
        self._from = smtp_from
        self._app_url = app_url

    def is_configured(self) -> bool:
        return bool(self._host)

    def send_email(self, to_email: str, subject: str, body: str) -> None:
        if not self._host:
            raise RuntimeError("SMTP not configured — set it in Settings → Email")
        self._send(to_email, subject, body)
        logger.info("Email sent to %s", to_email)

    def send_invitation(self, to_email: str, org_name: str, inviter_name: str, token: str) -> None:
        if not self._host:
            raise RuntimeError("SMTP not configured — set it in Settings → Email")
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
        # Names are user-controlled: escape them so nobody can inject markup into the email.
        org, inviter, url = html.escape(org_name), html.escape(inviter_name), html.escape(accept_url)
        body_html = f"""
<html><body style="font-family:sans-serif;color:#1c1917;max-width:520px;margin:40px auto;padding:0 20px">
  <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">You're invited to {org}</h2>
  <p style="color:#78716c">{inviter} has invited you to join <strong>{org}</strong> on Candid.</p>
  <a href="{url}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#1c1917;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">
    Accept invitation →
  </a>
  <p style="color:#a8a29e;font-size:13px">This invitation expires in 7 days.<br>If you weren't expecting this, you can ignore this email.</p>
</body></html>"""
        self._send(to_email, subject, body_text, body_html)
        logger.info("Invitation sent to %s", to_email)

    def _send(self, to_email: str, subject: str, body_text: str, body_html: str | None = None) -> None:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self._from
        msg["To"] = to_email
        msg.attach(MIMEText(body_text, "plain"))
        if body_html:
            msg.attach(MIMEText(body_html, "html"))
        # Always verify the server certificate: credentials must never go to an impostor.
        context = ssl.create_default_context()
        if self._port == self._IMPLICIT_TLS_PORT:
            smtp_conn = smtplib.SMTP_SSL(self._host, self._port, context=context, timeout=30)
        else:
            smtp_conn = smtplib.SMTP(self._host, self._port, timeout=30)
        with smtp_conn as smtp:
            if self._port != self._IMPLICIT_TLS_PORT:
                smtp.ehlo()
                smtp.starttls(context=context)
            if self._user and self._password:
                smtp.login(self._user, self._password)
            smtp.send_message(msg)


class LoggingEmailService:
    def __init__(
        self,
        email_service: EmailService,
        session: "Session",
        org_id: str,
        candidate_id: str | None = None,
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

    def _log_sent(self, to_email: str, subject: str, body: str, email_type: str) -> None:
        from candid.commons.models import EmailLog
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
        candidate_id: str | None = None,
    ) -> LoggingEmailService | None:
        from candid.commons.models import OrgConfig
        cfg = session.get(OrgConfig, org_id)
        if not cfg or not cfg.smtp_host:
            return None
        password = None
        if cfg.smtp_password_encrypted:
            try:
                password = self._crypto_service.decrypt(cfg.smtp_password_encrypted)
            except Exception:
                logger.warning("Cannot decrypt the SMTP password for org %s (was FERNET_KEY rotated?)", org_id)
        email_service = EmailService(
            smtp_host=cfg.smtp_host,
            smtp_port=cfg.smtp_port,
            smtp_user=cfg.smtp_user,
            smtp_password=password,
            smtp_from=cfg.smtp_from or cfg.smtp_user or "noreply@candid.app",
            app_url=self._app_url,
        )
        return LoggingEmailService(email_service, session, org_id, candidate_id)
