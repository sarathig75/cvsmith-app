import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.services import google_service
from app.utils import errors
from app.utils.security import burn_password_check, hash_password, verify_password

logger = logging.getLogger("cvsmith.auth")


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.scalar(select(User).where(User.email == email))


def signup(db: Session, email: str, password: str) -> User:
    if get_user_by_email(db, email):
        raise errors.email_exists()
    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise errors.email_exists()
    return user


def login(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if user is None or not user.password_hash:
        burn_password_check(password)
        raise errors.invalid_credentials()
    if not verify_password(password, user.password_hash):
        raise errors.invalid_credentials()
    return user


def google_login(db: Session, id_token: str) -> User:
    try:
        claims = google_service.verify_google_id_token(id_token)
    except google_service.GoogleVerificationError:
        raise errors.google_auth_failed()
    google_id = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not google_id or not email or claims.get("email_verified") is not True:
        raise errors.google_auth_failed()

    user = db.scalar(select(User).where(User.google_id == google_id))
    if user is None:
        user = get_user_by_email(db, email)
        if user is not None:
            # Link: Google asserts it verified this email address.
            user.google_id = google_id
            if not user.email_verified:
                user.email_verified = True
                user.email_verified_at = datetime.now(timezone.utc)
        else:
            user = User(
                email=email,
                google_id=google_id,
                email_verified=True,
                email_verified_at=datetime.now(timezone.utc),
            )
            db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise errors.google_auth_failed()
    return user


def mark_email_verified(db: Session, user: User) -> User:
    if not user.email_verified:
        user.email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        db.commit()
    return user
