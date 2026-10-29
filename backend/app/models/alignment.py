import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow


class AlignmentRun(Base):
    """One job alignment (docs/API_CONTRACT.md, "Job alignment"). Counts as one suggestion of the monthly
    quota. The job spec text is NOT kept: only the requirements read from it and the result."""

    __tablename__ = "alignment_runs"
    __table_args__ = (Index("ix_alignment_runs_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("cvs.id", ondelete="SET NULL"), nullable=True)
    requirements: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    result: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
