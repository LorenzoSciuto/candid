import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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
            raise RuntimeError("SMTP not configured — set SMTP_HOST in .env")
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
