from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.auth import UserOut
from app.services import account_service
from app.services.storage_service import StorageService, get_storage

router = APIRouter(prefix="/api", tags=["user"])


class DeleteAccountIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The user types DELETE to confirm (no passwords in Release 1).
    confirm: Literal["DELETE"]


@router.get("/user", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.delete("/user", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    body: DeleteAccountIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
):
    """Delete the account and all its data, and end every session (the user no longer exists)."""
    account_service.delete_account(db, storage, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
