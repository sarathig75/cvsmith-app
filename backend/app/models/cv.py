import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import utcnow

PRIVACY_VALUES = ("private", "public")
# "not_uploaded": the CV was created by saving the canvas, without a file.
PARSING_STATUSES = ("not_uploaded", "pending", "in_progress", "complete", "failed")
PART_STATUSES = ("pending", "complete", "failed")
# "contact" is found by pattern without AI (instant); the other three are AI parts (cv_parser.PARTS).
PARSING_PARTS = ("contact", "basics", "experience", "extras")
AI_PARTS = ("basics", "experience", "extras")


def pending_parts() -> Dict[str, str]:
    return {part: "pending" for part in PARSING_PARTS}


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
    # Per-part status ("pending" | "complete" | "failed"); see docs/API_CONTRACT.md.
    parsing_parts: Mapped[Dict[str, str]] = mapped_column(JSON, nullable=False, default=pending_parts)
    raw_upload_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    # The user's canvas as saved by PATCH /api/cv (json_resume is parser output only).
    content: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    applied_parts: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    content_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    user = relationship("User", back_populates="cv")
