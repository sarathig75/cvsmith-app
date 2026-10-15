"""Deleting a user's CV, or the whole account, with the stored files."""
import logging

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.models.cv import CV
from app.models.event import Event
from app.models.login_code import LoginCode
from app.models.suggestion import Suggestion
from app.models.user import User
from app.services import cv_service, event_service
from app.services.storage_service import StorageService
from app.utils import errors

logger = logging.getLogger("cvsmith.account")


def _delete_file(storage: StorageService, key) -> None:
    if not key:
        return
    try:
        storage.delete(key)
    except Exception:  # the data is gone either way; a stray file is logged, not fatal
        logger.exception("Could not delete stored file %s", key)


def delete_cv(db: Session, storage: StorageService, user: User) -> None:
    """Remove the CV (canvas, parsed data, uploaded file). Suggestions stay: they count toward the quota."""
    cv = cv_service.get_cv(db, user)
    if cv is None:
        raise errors.not_found("There is no CV to delete.")
    key = cv.raw_upload_path
    db.execute(update(Suggestion).where(Suggestion.cv_id == cv.id).values(cv_id=None))
    db.delete(cv)
    db.commit()
    _delete_file(storage, key)
    event_service.record(db, user.id, "cv_deleted")


def delete_account(db: Session, storage: StorageService, user: User) -> None:
    """Delete the user and everything about them. Funnel events stay without the user link
    (they never hold personal data or CV content)."""
    event_service.record(db, user.id, "account_deleted")
    cv = cv_service.get_cv(db, user)
    key = cv.raw_upload_path if cv else None
    user_id, email = user.id, user.email
    db.execute(delete(Suggestion).where(Suggestion.user_id == user_id))
    db.execute(delete(CV).where(CV.user_id == user_id))
    db.execute(delete(LoginCode).where(LoginCode.email == email))
    db.execute(update(Event).where(Event.user_id == user_id).values(user_id=None))
    db.execute(delete(User).where(User.id == user_id))
    db.commit()
    _delete_file(storage, key)
