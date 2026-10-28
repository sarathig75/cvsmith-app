import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow

UNMATCHED_KINDS = ("title", "sector", "skill", "verb", "requirement")
UNMATCHED_STATUSES = ("open", "ignored", "resolved")


class UnmatchedTerm(Base):
    """A term the ATS checks did not recognise, counted for review (docs/ATS_RULES.md section 7).

    No user id and no CV content: only the normalised term, its kind and how often it was seen.
    """

    __tablename__ = "unmatched_terms"
    __table_args__ = (UniqueConstraint("kind", "term", name="uq_unmatched_kind_term"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    term: Mapped[str] = mapped_column(String(60), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
