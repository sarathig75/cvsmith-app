from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow


class Invite(Base):
    """An email address allowed to sign up while the site is invite-only (pilot)."""

    __tablename__ = "invites"

    email: Mapped[str] = mapped_column(String(255), primary_key=True)
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
