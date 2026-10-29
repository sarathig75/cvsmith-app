import io
import zipfile
from pathlib import PurePosixPath
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.cv import CV, pending_parts
from app.models.user import User, utcnow
from app.services.storage_service import StorageService
from app.utils import errors
from app.utils.security import sanitize_filename_stem

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
ALLOWED = {".pdf": PDF_MIME, ".docx": DOCX_MIME}


def get_cv(db: Session, user: User) -> Optional[CV]:
    return db.scalar(select(CV).where(CV.user_id == user.id))


def _looks_like_docx(data: bytes) -> bool:
    if not data.startswith(b"PK\x03\x04"):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            return "word/document.xml" in zf.namelist()
    except zipfile.BadZipFile:
        return False


def validate_upload(
    filename: str, content_type: Optional[str], data: bytes
) -> Tuple[str, str]:
    """Return (extension, canonical mime) or raise a contract error."""
    max_size = get_settings().MAX_UPLOAD_SIZE
    ext = PurePosixPath((filename or "").replace("\\", "/")).suffix.lower()
    if ext not in ALLOWED:
        raise errors.unsupported_file_type("Only PDF and DOCX files are supported.")
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime != ALLOWED[ext]:
        raise errors.unsupported_file_type("File content type does not match.")
    if len(data) > max_size:
        raise errors.file_too_large(
            f"File exceeds the {max_size // (1024 * 1024)}MB limit."
        )
    ok = data.startswith(b"%PDF-") if ext == ".pdf" else _looks_like_docx(data)
    if not ok:
        raise errors.unsupported_file_type("File content is not a valid PDF or DOCX.")
    return ext, ALLOWED[ext]


def save_upload(
    db: Session,
    storage: StorageService,
    user: User,
    filename: str,
    content_type: Optional[str],
    data: bytes,
) -> CV:
    ext, _ = validate_upload(filename, content_type, data)
    key = storage.save(user.id, data, ext)
    title = sanitize_filename_stem(filename) or "My CV"

    cv = get_cv(db, user)
    old_key = None
    if cv is None:
        cv = CV(user_id=user.id, title=title, raw_upload_path=key)
        db.add(cv)
    else:
        old_key = cv.raw_upload_path
        cv.title = title
        cv.raw_upload_path = key
        cv.json_resume = {}
        cv.parsing_status = "pending"
        cv.parsing_error = None
        cv.parsing_parts = pending_parts()
        # The new file replaces the CV, including the user's edits (the frontend confirms first).
        cv.content = None
        cv.applied_parts = []
        cv.content_updated_at = None
        cv.ats_before = None
        cv.ats_layout_after = None
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(key)
        raise
    if old_key:
        storage.delete(old_key)
    return cv


def _get_or_create(db: Session, user: User) -> CV:
    cv = get_cv(db, user)
    if cv is None:
        cv = CV(user_id=user.id, title="My CV", parsing_status="not_uploaded")
        db.add(cv)
    return cv


def set_privacy(db: Session, user: User, privacy: str) -> CV:
    """Save the visibility setting; creates the CV (like a first save) if there is none yet."""
    cv = _get_or_create(db, user)
    cv.privacy = privacy
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return set_privacy(db, user, privacy)
    return cv


def save_content(db: Session, user: User, content: dict, applied_parts: List[str]) -> CV:
    """Save the user's canvas. Creates the CV for a user who never uploaded a file."""
    cv = _get_or_create(db, user)
    cv.content = content
    cv.applied_parts = applied_parts
    cv.content_updated_at = utcnow()
    try:
        db.commit()
    except IntegrityError:
        # Two first saves raced to create the CV (one per user): save into the one that won.
        db.rollback()
        return save_content(db, user, content, applied_parts)
    return cv
