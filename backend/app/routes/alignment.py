import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.alignment import AlignmentOut, JobSpecIn, SelectionIn
from app.schemas.cv import CVOut
from app.schemas.dashboard import AtsScoreOut
from app.services import alignment_service, cv_service, event_service
from app.services.alignment_ai import AlignmentAI, get_alignment_ai
from app.services.pdf_service import PdfError, PdfRenderer, get_pdf_renderer
from app.utils import errors

router = APIRouter(prefix="/api/alignment", tags=["alignment"])


@router.post("", response_model=AlignmentOut, status_code=status.HTTP_201_CREATED)
def create_alignment(
    body: JobSpecIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    ai: AlignmentAI = Depends(get_alignment_ai),
    renderer: PdfRenderer = Depends(get_pdf_renderer),
):
    cv = cv_service.get_cv(db, user)
    # A sync route runs in a worker thread, so the AI calls never block the loop.
    return alignment_service.present(alignment_service.run(db, user, cv, ai, renderer, body.job_spec))


@router.get("/{run_id}", response_model=AlignmentOut)
def get_alignment(run_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return alignment_service.present(alignment_service.get(db, user, run_id))


@router.post("/{run_id}/preview", response_model=AtsScoreOut)
def preview_alignment(
    run_id: uuid.UUID,
    body: SelectionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    renderer: PdfRenderer = Depends(get_pdf_renderer),
):
    row = alignment_service.get(db, user, run_id)
    return alignment_service.preview(db, user, renderer, row, body.use_headline, body.skills, body.use_summary)


@router.post("/{run_id}/apply", response_model=CVOut)
def apply_alignment(
    run_id: uuid.UUID, body: SelectionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    row = alignment_service.get(db, user, run_id)
    return alignment_service.apply(db, user, row, body.use_headline, body.skills, body.use_summary)


@router.post("/{run_id}/download")
def download_job_version(
    run_id: uuid.UUID,
    body: SelectionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    renderer: PdfRenderer = Depends(get_pdf_renderer),
):
    """A PDF of the saved CV with the ticked changes, for this job only. Nothing is stored."""
    row = alignment_service.get(db, user, run_id)
    content = alignment_service.job_version(db, user, row, body.use_headline, body.skills, body.use_summary)
    try:
        pdf = renderer.render(content)
    except PdfError:
        raise errors.pdf_failed()
    event_service.record(db, user.id, "pdf_downloaded", {"job_version": True})
    name = alignment_service.job_file_name(content, row.requirements.get("job_title", ""))
    ascii_name = name.encode("ascii", "ignore").decode() or "CV.pdf"
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(name)}',
        "Cache-Control": "no-store",
    })
