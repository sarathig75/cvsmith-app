import uuid
from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils import errors
from app.utils.jwt_handler import ACCESS, decode_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise errors.unauthorized()
    claims = decode_token(creds.credentials, ACCESS)
    if claims is None:
        raise errors.unauthorized("Invalid or expired token.")
    try:
        user_id = uuid.UUID(claims["sub"])
    except ValueError:
        raise errors.unauthorized("Invalid or expired token.")
    user = db.get(User, user_id)
    # A token from before the user's sessions were ended (e.g. account changes) is refused.
    if user is None or claims.get("ver", 0) != user.token_version:
        raise errors.unauthorized("Invalid or expired token.")
    return user
