from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.dashboard import AtsOut, DashboardOut
from app.services import cv_service, event_service
from app.services.ats import service as ats_service
from app.services.ats.facts import content_from_resume
from app.services.dashboard_service import cv_strength, state_of
from app.services.pdf_service import PdfRenderer, get_pdf_renderer

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    renderer: PdfRenderer = Depends(get_pdf_renderer),
):
    """Home for logged-in users. Scores are computed on each read from the saved CV."""
    cv = cv_service.get_cv(db, user)
    state = state_of(cv)
    if state in ("no_cv", "parsing", "needs_details"):
        return {"state": state, "cv_strength": None, "ats": None, "plan": user.plan}
    content = cv.content or content_from_resume(cv.json_resume)
    return {"state": state, "cv_strength": cv_strength(content),
            "ats": ats_service.current_score(db, cv, renderer), "plan": user.plan}


@router.get("/ats", response_model=AtsOut)
def ats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    renderer: PdfRenderer = Depends(get_pdf_renderer),
):
    """The ATS format score before (uploaded file) and after (saved CV as PDF) for the Canvas."""
    cv = cv_service.get_cv(db, user)
    if cv is None:
        return {"before": None, "after": None}
    return {"before": ats_service.before_score(cv), "after": ats_service.current_score(db, cv, renderer)}


@router.post("/next/viewed", status_code=204)
def next_viewed(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Funnel step: the user reached the "what next" page after a download (step only, no content)."""
    event_service.record(db, user.id, "next_viewed")
