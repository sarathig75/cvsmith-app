"""CV parsing pipeline: stored file -> text -> Claude -> JSON Resume on the CV row.

Runs inside the Celery worker (app/workers/tasks.py) but has no Celery dependency,
so tests call it directly.
"""
import logging
import time
import uuid
from pathlib import PurePosixPath
from typing import Iterator

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.cv import AI_PARTS, CV, pending_parts
from app.services import event_service
from app.services.contact_patterns import find_contact
from app.services.cv_parser import CvParser, ParseError, PartResult, merge_fragment
from app.services.storage_service import StorageService
from app.services.text_extraction import ExtractionError, extract_text

logger = logging.getLogger("cvsmith.parsing")

GENERIC_FAILURE = "Something went wrong while processing your CV. Please try uploading it again."


def run_parsing(
    db: Session, storage: StorageService, parser: CvParser, cv_id: uuid.UUID, upload_key: str
) -> None:
    """Parse the upload identified by upload_key and store the result on the CV.

    Parsing runs in parts (see cv_parser.PARTS); each part is saved as soon as it is ready so
    the canvas can fill in early. upload_key guards against a race: if the user uploaded a
    newer file while this job was queued or running, the CV row points at a different key and
    this job's results are discarded.
    """
    cv = db.get(CV, cv_id)
    if cv is None or cv.raw_upload_path != upload_key:
        logger.info("Skipping stale parse job for CV %s", cv_id)
        return
    cv.parsing_status = "in_progress"
    cv.parsing_error = None
    cv.parsing_parts = pending_parts()
    db.commit()
    started = time.monotonic()
    logger.info("CV %s: parsing started", cv_id)

    first_error = None
    try:
        for part, result in _parse_file(storage, parser, upload_key):
            logger.info("CV %s: part %s %s after %.1f s", cv_id, part,
                        "failed" if isinstance(result, ParseError) else "saved", time.monotonic() - started)
            if isinstance(result, ParseError):
                first_error = first_error or str(result)
                if not _save_part(db, cv_id, upload_key, part, "failed"):
                    return
            elif not _save_part(db, cv_id, upload_key, part, "complete", result):
                return
    except (ExtractionError, ParseError) as exc:
        first_error = str(exc)
    except Exception:
        logger.exception("Unexpected error parsing CV %s", cv_id)
        first_error = GENERIC_FAILURE
    _finish(db, cv_id, upload_key, first_error)


def _current_cv(db: Session, cv_id: uuid.UUID, upload_key: str):
    db.rollback()  # discard anything left over from a failed step
    # Sessions use expire_on_commit=False, so force a fresh read: the user may have
    # uploaded a new file while Claude was working.
    db.expire_all()
    cv = db.get(CV, cv_id)
    if cv is None or cv.raw_upload_path != upload_key:
        logger.info("CV %s was replaced while parsing; discarding result", cv_id)
        return None
    return cv


def _save_part(db: Session, cv_id: uuid.UUID, upload_key: str, part: str, status: str, fragment=None) -> bool:
    """Store one finished part. Returns False if the CV was replaced, so the job should stop."""
    cv = _current_cv(db, cv_id, upload_key)
    if cv is None:
        return False
    if fragment is not None:
        cv.json_resume = merge_fragment(cv.json_resume or {}, fragment)
    cv.parsing_parts = {**cv.parsing_parts, part: status}
    db.commit()
    return True


def _finish(db: Session, cv_id: uuid.UUID, upload_key: str, error) -> None:
    """Close the job: parts still pending have failed; complete if any part succeeded."""
    cv = _current_cv(db, cv_id, upload_key)
    if cv is None:
        return
    parts = {part: ("failed" if s == "pending" else s) for part, s in cv.parsing_parts.items()}
    # The contact part always "succeeds"; whether the CV was read depends on the AI parts.
    succeeded = any(parts.get(part) == "complete" for part in AI_PARTS)
    cv.parsing_parts = parts
    cv.parsing_status = "complete" if succeeded else "failed"
    cv.parsing_error = None if succeeded else (error or GENERIC_FAILURE)
    db.commit()
    failed = sorted(part for part, s in parts.items() if s == "failed")
    event_service.record(db, cv.user_id, "parsing_finished", {"status": cv.parsing_status, "failed_parts": failed})


def _parse_file(storage: StorageService, parser: CvParser, key: str) -> Iterator[PartResult]:
    settings = get_settings()
    extension = PurePosixPath(key).suffix.lower()
    data = storage.read(key)
    text = extract_text(data, extension)
    if len(text) > settings.MAX_CV_TEXT_CHARS:
        raise ExtractionError("This file contains too much text to be a CV. Please upload your CV only.")
    # Email, phone and LinkedIn by pattern first: on screen within about a second, while the
    # AI parts take a few seconds (found nothing, e.g. a scan: still "complete").
    yield "contact", find_contact(text)
    if len(text) >= settings.MIN_EXTRACTED_TEXT_CHARS:
        yield from parser.parse_text(text)
    elif extension == ".pdf":
        # Little or no text layer: most likely a scanned PDF.
        yield from parser.parse_pdf(data)
    else:
        raise ExtractionError("No text was found in this file. Please check it is your CV.")
