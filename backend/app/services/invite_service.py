"""Invite-only mode for the pilot: only invited addresses (and existing accounts) can log in."""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.invite import Invite
from app.models.user import User
from app.utils import errors


def normalize(email: str) -> str:
    return email.strip().lower()


def is_allowed(db: Session, email: str) -> bool:
    if not get_settings().INVITE_ONLY:
        return True
    email = normalize(email)
    return bool(
        db.scalar(select(Invite.email).where(Invite.email == email))
        or db.scalar(select(User.id).where(User.email == email))
    )


def check(db: Session, email: str) -> None:
    """Raises NOT_INVITED. Says only that the address is not invited, never whether an account exists."""
    if not is_allowed(db, email):
        raise errors.not_invited()


def add(db: Session, emails: List[str], note: Optional[str] = None) -> List[str]:
    added = []
    for email in {normalize(e) for e in emails if e.strip()}:
        if db.get(Invite, email) is None:
            db.add(Invite(email=email, note=note))
            added.append(email)
    db.commit()
    return sorted(added)


def remove(db: Session, emails: List[str]) -> List[str]:
    removed = []
    for email in {normalize(e) for e in emails}:
        row = db.get(Invite, email)
        if row is not None:
            db.delete(row)
            removed.append(email)
    db.commit()
    return sorted(removed)


def list_all(db: Session) -> List[Invite]:
    return list(db.scalars(select(Invite).order_by(Invite.created_at)))
