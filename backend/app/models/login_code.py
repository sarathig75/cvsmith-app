import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow


class LoginCode(Base):
    """A one-time login code sent by email. Only a keyed hash of the code is stored."""

    __tablename__ = "login_codes"
    __table_args__ = (Index("ix_login_codes_email_created", "email", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Set when the code is used, or replaced by a newer code.
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
