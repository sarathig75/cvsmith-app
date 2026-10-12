"""Email sending behind a small interface."""
import logging
from typing import Protocol
from urllib.parse import quote

import requests

from app.config import get_settings

logger = logging.getLogger("cvsmith.email")


class EmailSender(Protocol):
    def send_verification(self, to_email: str, token: str) -> None: ...


def verification_link(token: str) -> str:
    base = get_settings().FRONTEND_URL.rstrip("/")
    return f"{base}/verify-email?token={quote(token)}"


class LoggingEmailSender:
    """Used when SENDGRID_API_KEY is unset. Logs the link in development only."""

    def send_verification(self, to_email: str, token: str) -> None:
        if get_settings().is_development:
            logger.info("[dev email] verification link: %s", verification_link(token))
        else:
            logger.warning("Email provider not configured; verification not sent.")


class SendGridEmailSender:
    def send_verification(self, to_email: str, token: str) -> None:
        s = get_settings()
        link = verification_link(token)
        resp = requests.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {s.SENDGRID_API_KEY}"},
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": s.SENDGRID_FROM_EMAIL},
                "subject": "Verify your CVSmith email",
                "content": [
                    {
                        "type": "text/plain",
                        "value": f"Verify your email: {link}\nThis link expires in "
                        f"{s.VERIFICATION_TOKEN_EXPIRATION_HOURS} hours.",
                    }
                ],
            },
            timeout=10,
        )
        resp.raise_for_status()


def get_email_sender() -> EmailSender:
    if get_settings().SENDGRID_API_KEY:
        return SendGridEmailSender()
    return LoggingEmailSender()
