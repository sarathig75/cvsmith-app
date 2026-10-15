import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow

SUGGESTION_FIELDS = ("summary", "experience", "projects", "headline")
SUGGESTION_STATUSES = ("pending", "accepted", "declined", "unchanged")


class Suggestion(Base):
    """One AI rewrite of one CV field. Text is kept for the accept/decline decision and is
    deleted with the user."""

    __tablename__ = "suggestions"
    __table_args__ = (Index("ix_suggestions_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("cvs.id", ondelete="SET NULL"), nullable=True)
    field: Mapped[str] = mapped_column(String(20), nullable=False)
    entry_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_text: Mapped[str] = mapped_column(Text, nullable=False)
    # False: the text already followed the house style. Only changed suggestions count.
    changed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
