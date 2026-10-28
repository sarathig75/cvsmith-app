import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.suggestion import DecisionIn, QuotaOut, SuggestionIn, SuggestionOut
from app.services import cv_service, event_service, learning_service, suggestion_service
from app.services.suggestion_service import SuggestionWriter, get_writer
from app.utils.errors import AppError

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])


@router.get("/quota", response_model=QuotaOut)
def get_quota(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return suggestion_service.quota(db, user)


@router.post("", response_model=SuggestionOut, status_code=status.HTTP_201_CREATED)
def create_suggestion(
    body: SuggestionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    writer: SuggestionWriter = Depends(get_writer),
):
    cv = cv_service.get_cv(db, user)
    try:
        # A sync route: FastAPI runs it in a worker thread, so the AI call never blocks the loop.
        row = suggestion_service.suggest(
            db, user, writer, body.field, body.entry_id, body.text,
            body.context.model_dump(), cv.id if cv else None, cv.content if cv else None,
        )
    except AppError as exc:
        if exc.code == "QUOTA_EXCEEDED":
            event_service.record(db, user.id, "upgrade_prompt_shown", {"field": body.field})
        raise
    event_service.record(db, user.id, "suggestion_requested", {"field": body.field, "changed": row.changed})
    return row


@router.patch("/{suggestion_id}", response_model=SuggestionOut)
def decide_suggestion(
    suggestion_id: uuid.UUID,
    body: DecisionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return suggestion_service.decide(db, user, suggestion_id, body.status)


@router.post("/{suggestion_id}/edited", status_code=status.HTTP_204_NO_CONTENT)
def mark_suggestion_edited(
    suggestion_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    learning_service.mark_edited(db, user, suggestion_id)
