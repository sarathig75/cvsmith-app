import logging
from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.cv import PARSING_PARTS
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.cv import CVOut, CVSave
from app.services import cv_service, event_service
from app.services.parse_queue import ParseQueue, get_parse_queue
from app.services.storage_service import StorageService, get_storage
from app.utils import errors

logger = logging.getLogger("cvsmith.parsing")

router = APIRouter(prefix="/api/cv", tags=["cv"])


@router.post("/upload", response_model=CVOut, status_code=status.HTTP_201_CREATED)
async def upload_cv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
    enqueue: ParseQueue = Depends(get_parse_queue),
):
    max_size = get_settings().MAX_UPLOAD_SIZE
    # Read at most max+1 bytes so oversized bodies are not fully buffered.
    data = await file.read(max_size + 1)
    cv = cv_service.save_upload(
        db, storage, user, file.filename or "", file.content_type, data
    )
    # Parsing runs in the background worker; the upload response does not wait for it.
    try:
        await run_in_threadpool(enqueue, cv.id, cv.raw_upload_path)
    except Exception:
        logger.exception("Could not queue parsing for CV %s", cv.id)
        cv.parsing_status = "failed"
        cv.parsing_error = "We could not start processing your CV. Please try uploading it again."
        cv.parsing_parts = {part: "failed" for part in PARSING_PARTS}
        db.commit()
    event_service.record(db, user.id, "cv_uploaded", {"file_type": PurePosixPath(cv.raw_upload_path).suffix})
    return cv


@router.get("", response_model=CVOut)
def get_cv(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cv = cv_service.get_cv(db, user)
    if cv is None:
        raise errors.not_found("No CV uploaded yet.")
    return cv


@router.patch("", response_model=CVOut)
def save_cv(body: CVSave, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cv = cv_service.save_content(db, user, body.content, body.applied_parts)
    if body.edited:
        event_service.record(db, user.id, "first_edit")
    return cv
