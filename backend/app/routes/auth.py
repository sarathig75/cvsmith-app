import logging
import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.auth import (
    GoogleLoginIn,
    LoginIn,
    MessageOut,
    SignupIn,
    TokenOut,
    UserOut,
    VerifyIn,
)
from app.services import auth_service
from app.services.email_service import get_email_sender
from app.utils import errors
from app.utils.jwt_handler import (
    EMAIL_VERIFY,
    create_access_token,
    create_verification_token,
    decode_token,
)

logger = logging.getLogger("cvsmith.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_response(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    user = auth_service.signup(db, body.email, body.password)
    # Verification is optional and never blocks signup.
    try:
        token = create_verification_token(user.id, user.email)
        get_email_sender().send_verification(user.email, token)
    except Exception:
        logger.exception("Failed to send verification email on signup")
    return _token_response(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    return _token_response(auth_service.login(db, body.email, body.password))


@router.post("/google", response_model=TokenOut)
def google(body: GoogleLoginIn, db: Session = Depends(get_db)):
    return _token_response(auth_service.google_login(db, body.id_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: User = Depends(get_current_user)):
    # Stateless JWT: the client discards the token (no refresh tokens in R1).
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/send-verification",
    response_model=MessageOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def send_verification(user: User = Depends(get_current_user)):
    if user.email_verified:
        return MessageOut(message="Email is already verified.")
    token = create_verification_token(user.id, user.email)
    try:
        get_email_sender().send_verification(user.email, token)
    except Exception:
        logger.exception("Failed to send verification email")
        raise errors.AppError("SERVER_ERROR", "Could not send verification email.", 500)
    return MessageOut(message="Verification email sent.")


@router.post("/verify", response_model=UserOut)
def verify(body: VerifyIn, db: Session = Depends(get_db)):
    claims = decode_token(body.token, EMAIL_VERIFY)
    if claims is None:
        raise errors.invalid_token()
    try:
        user_id = uuid.UUID(claims["sub"])
    except ValueError:
        raise errors.invalid_token()
    user = db.get(User, user_id)
    # Token is bound to the email it was issued for.
    if user is None or user.email != claims.get("email"):
        raise errors.invalid_token()
    return auth_service.mark_email_verified(db, user)
