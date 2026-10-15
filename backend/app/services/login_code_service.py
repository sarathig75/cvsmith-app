"""Login with a one-time code sent by email (no passwords in Release 1).

A code is 6 digits, valid LOGIN_CODE_MINUTES, single use, and dies after
LOGIN_CODE_MAX_ATTEMPTS wrong tries. Asking for a new code replaces the previous one.
Codes are sent for any address, so answers never reveal whether an account exists.
"""
import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import Optional, Tuple

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.login_code import LoginCode
from app.models.user import User, utcnow
from app.schemas.common import as_utc
from app.services.email_service import EmailError, EmailSender
from app.utils import errors


def _hash(email: str, code: str) -> str:
    key = get_settings().JWT_SECRET.encode()
    return hmac.new(key, f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def _latest(db: Session, email: str) -> Optional[LoginCode]:
    return db.scalar(
        select(LoginCode).where(LoginCode.email == email).order_by(LoginCode.created_at.desc()).limit(1)
    )


def request_code(db: Session, sender: EmailSender, email: str) -> None:
    s = get_settings()
    now = utcnow()
    last = _latest(db, email)
    if last is not None and last.used_at is None:
        wait = s.LOGIN_CODE_RESEND_SECONDS - int((now - as_utc(last.created_at)).total_seconds())
        if wait > 0:
            raise errors.rate_limited(f"Please wait {wait} seconds before asking for a new code.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    # The new code replaces any earlier one.
    db.execute(update(LoginCode).where(LoginCode.email == email, LoginCode.used_at.is_(None)).values(used_at=now))
    db.add(LoginCode(email=email, code_hash=_hash(email, code), created_at=now,
                     expires_at=now + timedelta(minutes=s.LOGIN_CODE_MINUTES)))
    db.commit()
    try:
        sender.send_login_code(email, code)
    except EmailError:
        # Nothing was sent: drop the code so the user can ask again straight away.
        db.execute(update(LoginCode).where(LoginCode.email == email, LoginCode.used_at.is_(None)).values(used_at=now))
        db.commit()
        raise errors.email_failed()


def verify_code(db: Session, email: str, code: str) -> Tuple[User, bool]:
    """Returns the user (created on first login) and whether the account was just created."""
    s = get_settings()
    now = utcnow()
    row = _latest(db, email)
    if row is None or row.used_at is not None or as_utc(row.expires_at) <= now \
            or row.attempts >= s.LOGIN_CODE_MAX_ATTEMPTS:
        raise errors.invalid_code("This code has expired or was already used. Please ask for a new code.")
    if not hmac.compare_digest(row.code_hash, _hash(email, code)):
        row.attempts += 1
        db.commit()
        left = s.LOGIN_CODE_MAX_ATTEMPTS - row.attempts
        if left <= 0:
            raise errors.invalid_code("Too many wrong tries. Please ask for a new code.")
        raise errors.invalid_code(f"That code is not right. {left} {'try' if left == 1 else 'tries'} left.")
    # Single use, also when two requests race: only one of them marks the code used.
    used = db.execute(
        update(LoginCode).where(LoginCode.id == row.id, LoginCode.used_at.is_(None)).values(used_at=now)
    ).rowcount
    db.commit()
    if not used:
        raise errors.invalid_code("This code has expired or was already used. Please ask for a new code.")
    return _get_or_create_user(db, email)


def _get_or_create_user(db: Session, email: str) -> Tuple[User, bool]:
    user = db.scalar(select(User).where(User.email == email))
    created = user is None
    if created:
        user = User(email=email, email_verified=True, email_verified_at=utcnow())
        db.add(user)
    elif not user.email_verified:
        # Logging in with a code proves the address.
        user.email_verified, user.email_verified_at = True, utcnow()
    try:
        db.commit()
    except IntegrityError:  # the same first login raced: use the account that won
        db.rollback()
        return db.scalar(select(User).where(User.email == email)), False
    return user, created
