from fastapi import APIRouter, Depends

from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api", tags=["user"])


@router.get("/user", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
