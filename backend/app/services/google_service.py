"""Google ID token verification (swappable; tests monkeypatch this function)."""
from typing import Any, Dict

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import get_settings


class GoogleVerificationError(Exception):
    pass


def verify_google_id_token(token: str) -> Dict[str, Any]:
    """Verify a Google ID token and return its claims.

    Raises GoogleVerificationError on any failure.
    """
    client_id = get_settings().GOOGLE_OAUTH_CLIENT_ID
    if not client_id:
        raise GoogleVerificationError("Google sign-in is not configured.")
    try:
        return google_id_token.verify_oauth2_token(
            token, google_requests.Request(), client_id
        )
    except Exception as exc:  # google-auth raises ValueError/TransportError
        raise GoogleVerificationError("Invalid Google token.") from exc
