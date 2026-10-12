import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import utcnow

PRIVACY_VALUES = ("private", "public")
PARSING_STATUSES = ("pending", "in_progress", "complete", "failed")


class CV(Base):
    __tablename__ = "cvs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="My CV")
    json_resume: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    privacy: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    parsing_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    parsing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_upload_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    user = relationship("User", back_populates="cv")
