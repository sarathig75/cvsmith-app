import logging

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.auth import (
    CodeRequestIn,
    CodeVerifyIn,
    GoogleLoginIn,
    LoginIn,
    MessageOut,
    SignupIn,
    TokenOut,
    UserOut,
)
from app.services import auth_service, event_service, login_code_service
from app.services.email_service import EmailSender, get_email_sender
from app.utils import errors
from app.utils.jwt_handler import create_access_token

logger = logging.getLogger("cvsmith.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_response(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


def _password_login_enabled() -> None:
    # Release 1 logs in with an email code; password login is kept for a later release.
    if not get_settings().PASSWORD_LOGIN_ENABLED:
        raise errors.password_login_disabled()


@router.post("/code", response_model=MessageOut)
def request_code(body: CodeRequestIn, db: Session = Depends(get_db), sender: EmailSender = Depends(get_email_sender)):
    """Email a 6-digit login code. The same answer for every address (no account lookup)."""
    login_code_service.request_code(db, sender, body.email)
    minutes = get_settings().LOGIN_CODE_MINUTES
    return MessageOut(message=f"We've sent a 6-digit code to {body.email}. It expires in {minutes} minutes.")


@router.post("/code/verify", response_model=TokenOut)
def verify_code(body: CodeVerifyIn, response: Response, db: Session = Depends(get_db)):
    """Log in with the emailed code; the first login creates the account (201)."""
    user, created = login_code_service.verify_code(db, body.email, body.code)
    if created:
        response.status_code = status.HTTP_201_CREATED
        event_service.record(db, user.id, "signup", {"method": "email_code"})
    event_service.record(db, user.id, "email_verified", {"method": "email_code"})  # once per user
    return _token_response(user)


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(_password_login_enabled)])
def signup(body: SignupIn, db: Session = Depends(get_db)):
    user = auth_service.signup(db, body.email, body.password)
    event_service.record(db, user.id, "signup", {"method": "email"})
    return _token_response(user)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(_password_login_enabled)])
def login(body: LoginIn, db: Session = Depends(get_db)):
    return _token_response(auth_service.login(db, body.email, body.password))


@router.post("/google", response_model=TokenOut)
def google(body: GoogleLoginIn, db: Session = Depends(get_db)):
    user, created = auth_service.google_login(db, body.id_token)
    if created:
        event_service.record(db, user.id, "signup", {"method": "google"})
    # Google asserts the address is verified (recorded once per user).
    event_service.record(db, user.id, "email_verified", {"method": "google"})
    return _token_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: User = Depends(get_current_user)):
    # The client discards the token.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
