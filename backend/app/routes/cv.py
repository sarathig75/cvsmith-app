from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.cv import CVOut
from app.services import cv_service
from app.services.storage_service import StorageService, get_storage
from app.utils import errors

router = APIRouter(prefix="/api/cv", tags=["cv"])


@router.post("/upload", response_model=CVOut, status_code=status.HTTP_201_CREATED)
async def upload_cv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
):
    max_size = get_settings().MAX_UPLOAD_SIZE
    # Read at most max+1 bytes so oversized bodies are not fully buffered.
    data = await file.read(max_size + 1)
    return cv_service.save_upload(
        db, storage, user, file.filename or "", file.content_type, data
    )


@router.get("", response_model=CVOut)
def get_cv(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cv = cv_service.get_cv(db, user)
    if cv is None:
        raise errors.not_found("No CV uploaded yet.")
    return cv
