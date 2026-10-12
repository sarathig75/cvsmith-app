"""CV parsing pipeline: stored file -> text -> Claude -> JSON Resume on the CV row.

Runs inside the Celery worker (app/workers/tasks.py) but has no Celery dependency,
so tests call it directly.
"""
import logging
import uuid
from pathlib import PurePosixPath

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.cv import CV
from app.services.cv_parser import CvParser, ParseError
from app.services.storage_service import StorageService
from app.services.text_extraction import ExtractionError, extract_text

logger = logging.getLogger("cvsmith.parsing")

GENERIC_FAILURE = "Something went wrong while processing your CV. Please try uploading it again."


def run_parsing(
    db: Session, storage: StorageService, parser: CvParser, cv_id: uuid.UUID, upload_key: str
) -> None:
    """Parse the upload identified by upload_key and store the result on the CV.

    upload_key guards against a race: if the user uploaded a newer file while this job
    was queued or running, the CV row points at a different key and this job's result
    is discarded.
    """
    cv = db.get(CV, cv_id)
    if cv is None or cv.raw_upload_path != upload_key:
        logger.info("Skipping stale parse job for CV %s", cv_id)
        return
    cv.parsing_status = "in_progress"
    cv.parsing_error = None
    db.commit()

    try:
        json_resume = _parse_file(storage, parser, upload_key)
    except (ExtractionError, ParseError) as exc:
        _finish(db, cv_id, upload_key, status="failed", error=str(exc))
        return
    except Exception:
        logger.exception("Unexpected error parsing CV %s", cv_id)
        _finish(db, cv_id, upload_key, status="failed", error=GENERIC_FAILURE)
        return
    _finish(db, cv_id, upload_key, status="complete", json_resume=json_resume)


def _parse_file(storage: StorageService, parser: CvParser, key: str) -> dict:
    settings = get_settings()
    extension = PurePosixPath(key).suffix.lower()
    data = storage.read(key)
    text = extract_text(data, extension)
    if len(text) > settings.MAX_CV_TEXT_CHARS:
        raise ExtractionError("This file contains too much text to be a CV. Please upload your CV only.")
    if len(text) >= settings.MIN_EXTRACTED_TEXT_CHARS:
        return parser.parse_text(text)
    if extension == ".pdf":
        # Little or no text layer: most likely a scanned PDF.
        return parser.parse_pdf(data)
    raise ExtractionError("No text was found in this file. Please check it is your CV.")


def _finish(db: Session, cv_id: uuid.UUID, upload_key: str, *, status: str, error=None, json_resume=None):
    db.rollback()  # discard anything left over from a failed step
    # Sessions use expire_on_commit=False, so force a fresh read: the user may have
    # uploaded a new file while Claude was working.
    db.expire_all()
    cv = db.get(CV, cv_id)
    if cv is None or cv.raw_upload_path != upload_key:
        logger.info("CV %s was replaced while parsing; discarding result", cv_id)
        return
    cv.parsing_status = status
    cv.parsing_error = error
    if json_resume is not None:
        cv.json_resume = json_resume
    db.commit()
