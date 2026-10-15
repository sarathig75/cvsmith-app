import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow

# Funnel steps (docs/CVSmith_Release_1_FINAL_PLAN.md, "Funnel tracking"). Later steps
# (upgraded, pdf_downloaded) are added with their features.
EVENT_TYPES = (
    "signup", "email_verified", "cv_uploaded", "parsing_finished", "first_edit",
    "suggestion_requested", "upgrade_prompt_shown", "pdf_downloaded", "json_exported",
    "cv_deleted", "account_deleted",
)
# Steps recorded at most once per user.
ONCE_PER_USER = ("email_verified", "first_edit")


class Event(Base):
    """One funnel step a user reached. Never holds CV content, names, emails or file names."""

    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_user_id", "user_id"),
        Index("ix_events_created_at", "created_at"),
        Index(
            "uq_events_once_per_user",
            "user_id",
            "event_type",
            unique=True,
            sqlite_where=text("event_type IN ('email_verified', 'first_edit')"),
            postgresql_where=text("event_type IN ('email_verified', 'first_edit')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_metadata: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
