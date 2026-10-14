import json
import logging
from pathlib import PurePosixPath

from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.cv import PARSING_PARTS
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.cv import CVOut, CVSave, PrivacyIn
from app.services import cv_service, event_service, export_service
from app.services.parse_queue import ParseQueue, get_parse_queue
from app.services.pdf_service import PdfError, PdfRenderer, get_pdf_renderer
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


@router.patch("/privacy", response_model=CVOut)
def set_privacy(body: PrivacyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return cv_service.set_privacy(db, user, body.privacy)


def _saved_cv(db: Session, user: User):
    cv = cv_service.get_cv(db, user)
    if cv is None or not cv.content:
        raise errors.not_found("There is nothing to download yet. Add your details first.")
    return cv


def _attachment(filename: str) -> str:
    ascii_name = filename.encode("ascii", "ignore").decode() or "CV"
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(filename)}'


@router.get("/download")
def download_pdf(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    renderer: PdfRenderer = Depends(get_pdf_renderer),
):
    """The saved canvas as a PDF in the Classic template. Free for every plan."""
    cv = _saved_cv(db, user)
    try:
        # A sync route runs in a worker thread, so rendering (1-2 s) never blocks the loop.
        pdf = renderer.render(cv.content)
    except PdfError:
        raise errors.pdf_failed()
    event_service.record(db, user.id, "pdf_downloaded")
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": _attachment(export_service.download_name(cv.content, "pdf")),
        "Cache-Control": "no-store",
    })


@router.get("/export")
def export_json(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The saved canvas as JSON Resume. Pro only."""
    if user.plan != "pro":
        event_service.record(db, user.id, "upgrade_prompt_shown", {"feature": "json_export"})
        raise errors.pro_required()
    cv = _saved_cv(db, user)
    resume = export_service.to_json_resume(cv.content, cv)
    event_service.record(db, user.id, "json_exported")
    return Response(json.dumps(resume, indent=2, ensure_ascii=False), media_type="application/json", headers={
        "Content-Disposition": _attachment(export_service.download_name(cv.content, "json")),
        "Cache-Control": "no-store",
    })
