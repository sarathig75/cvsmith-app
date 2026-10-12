"""JWT creation/verification for access and email-verification tokens."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt

from app.config import get_settings

ACCESS = "access"
EMAIL_VERIFY = "email_verify"


def _encode(payload: Dict[str, Any], hours: int, token_type: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    claims = {
        **payload,
        "typ": token_type,
        "iat": now,
        "exp": now + timedelta(hours=hours),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(claims, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID) -> str:
    return _encode({"sub": str(user_id)}, get_settings().JWT_EXPIRATION_HOURS, ACCESS)


def create_verification_token(user_id: uuid.UUID, email: str) -> str:
    return _encode(
        {"sub": str(user_id), "email": email},
        get_settings().VERIFICATION_TOKEN_EXPIRATION_HOURS,
        EMAIL_VERIFY,
    )


def decode_token(token: str, expected_type: str) -> Optional[Dict[str, Any]]:
    """Return claims if the token is valid and of the expected type, else None."""
    s = get_settings()
    try:
        claims = jwt.decode(
            token,
            s.JWT_SECRET,
            algorithms=[s.JWT_ALGORITHM],
            options={"require": ["exp", "sub", "typ"]},
        )
    except jwt.PyJWTError:
        return None
    if claims.get("typ") != expected_type:
        return None
    return claims
