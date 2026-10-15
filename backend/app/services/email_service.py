"""Email sending behind a small interface. The provider is a setting (EMAIL_PROVIDER):

- "log":      development only; the code is written to the backend log (never sent).
- "sendgrid": SendGrid's HTTP API (SENDGRID_API_KEY).
- "smtp":     any SMTP service, e.g. Resend, Brevo, Mailgun or Amazon SES (SMTP_* settings).

Left empty, it is "sendgrid" when SENDGRID_API_KEY is set, otherwise "log".
"""
import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

import requests

from app.config import get_settings

logger = logging.getLogger("cvsmith.email")


class EmailError(Exception):
    """The email could not be sent."""


class EmailSender(Protocol):
    def send_login_code(self, to_email: str, code: str) -> None: ...


def login_code_message(code: str) -> tuple:
    minutes = get_settings().LOGIN_CODE_MINUTES
    subject = f"Your CVSmith login code: {code}"
    body = (
        f"Your CVSmith login code is {code}\n\n"
        f"It expires in {minutes} minutes and works once. If you didn't ask for it, you can ignore this email."
    )
    return subject, body


class LoggingEmailSender:
    def send_login_code(self, to_email: str, code: str) -> None:
        if not get_settings().is_development:
            # Logging codes outside development would let anyone with log access sign in.
            logger.error("No email provider configured: login code not sent.")
            raise EmailError("no email provider")
        logger.info("[dev email] login code for %s: %s", to_email, code)


class SendGridEmailSender:
    def send_login_code(self, to_email: str, code: str) -> None:
        s = get_settings()
        subject, body = login_code_message(code)
        try:
            resp = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {s.SENDGRID_API_KEY}"},
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": s.EMAIL_FROM},
                    "subject": subject,
                    "content": [{"type": "text/plain", "value": body}],
                },
                timeout=10,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.error("SendGrid could not send a login code: %s", exc)
            raise EmailError from exc


class SmtpEmailSender:
    def send_login_code(self, to_email: str, code: str) -> None:
        s = get_settings()
        subject, body = login_code_message(code)
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = s.EMAIL_FROM, to_email, subject
        msg.set_content(body)
        try:
            with smtplib.SMTP(s.SMTP_HOST, s.SMTP_PORT, timeout=10) as smtp:
                if s.SMTP_STARTTLS:
                    smtp.starttls()
                if s.SMTP_USERNAME:
                    smtp.login(s.SMTP_USERNAME, s.SMTP_PASSWORD)
                smtp.send_message(msg)
        except (smtplib.SMTPException, OSError) as exc:
            logger.error("SMTP could not send a login code: %s", exc)
            raise EmailError from exc


def get_email_sender() -> EmailSender:
    s = get_settings()
    provider = (s.EMAIL_PROVIDER or ("sendgrid" if s.SENDGRID_API_KEY else "log")).lower()
    if provider == "sendgrid":
        return SendGridEmailSender()
    if provider == "smtp":
        return SmtpEmailSender()
    return LoggingEmailSender()
