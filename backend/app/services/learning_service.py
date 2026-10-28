"""Counts for learning what suggestions do, and the store of ATS terms we did not recognise.

Contract: docs/API_CONTRACT.md, "Suggestion effectiveness and ATS monitoring". Nothing here
stores user ids or CV text, except the normalised unmatched term itself (by design, for review).
"""
import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.suggestion import Suggestion
from app.models.unmatched import UNMATCHED_KINDS, UNMATCHED_STATUSES, UnmatchedTerm
from app.models.user import User, utcnow
from app.utils import errors

logger = logging.getLogger("cvsmith.learning")

MAX_TERM_CHARS = 60
MAX_TERM_WORDS = 4


def normalise_term(raw: str) -> Optional[str]:
    """Lower case, single spaces. None when the term should not be stored at all: empty, too long,
    too many words, or it has a digit or "@" (numbers, emails and phone numbers are never stored)."""
    if not isinstance(raw, str):
        return None
    term = " ".join(raw.lower().split())
    if not term or len(term) > MAX_TERM_CHARS or len(term.split()) > MAX_TERM_WORDS:
        return None
    if re.search(r"[0-9@]", term):
        return None
    return term


def record_unmatched(db: Session, kind: str, raw: str) -> None:
    """Count one sighting of an unmatched term. Never raises: a failure is logged and ignored so the
    user's action is never slowed or broken."""
    try:
        if kind not in UNMATCHED_KINDS:
            return
        term = normalise_term(raw)
        if term is None:
            return
        now = utcnow()
        row = db.scalar(select(UnmatchedTerm).where(UnmatchedTerm.kind == kind, UnmatchedTerm.term == term))
        if row is None:
            db.add(UnmatchedTerm(kind=kind, term=term, count=1, first_seen_at=now, last_seen_at=now))
        else:
            row.count += 1
            row.last_seen_at = now
        db.commit()
    except Exception:  # noqa: BLE001 - recording must never break the caller
        db.rollback()
        logger.exception("Could not record an unmatched %s term", kind)


def unmatched_report(db: Session, min_count: int = 5) -> List[UnmatchedTerm]:
    """Open terms seen at least min_count times, grouped by kind, most seen first."""
    rows = db.scalars(
        select(UnmatchedTerm).where(UnmatchedTerm.status == "open", UnmatchedTerm.count >= min_count)
    ).all()
    order = {kind: i for i, kind in enumerate(UNMATCHED_KINDS)}
    return sorted(rows, key=lambda r: (order.get(r.kind, 99), -r.count, r.term))


def set_unmatched_status(db: Session, kind: str, raw: str, status: str) -> bool:
    """Mark a term ignored or resolved. False if the term was never seen."""
    if status not in UNMATCHED_STATUSES or status == "open":
        raise ValueError(f"unknown status: {status}")
    term = normalise_term(raw)
    if term is None:
        return False
    row = db.scalar(select(UnmatchedTerm).where(UnmatchedTerm.kind == kind, UnmatchedTerm.term == term))
    if row is None:
        return False
    row.status = status
    db.commit()
    return True


def mark_edited(db: Session, user: User, suggestion_id: uuid.UUID) -> None:
    """Record the first edit of an accepted suggestion's text. Idempotent. No text is stored."""
    row = db.get(Suggestion, suggestion_id)
    if row is None or row.user_id != user.id or row.status != "accepted":
        raise errors.not_found("Suggestion not found.")
    if row.edited_at is None:
        row.edited_at = utcnow()
        db.commit()


def suggestion_report(
    db: Session, weeks: int = 4, now: Optional[datetime] = None
) -> Dict[Tuple[str, str], Dict[str, int]]:
    """Counts per (field, week starting Monday). Only counts: no text and no user ids."""
    now = now or utcnow()
    since = now - timedelta(weeks=weeks)
    columns = (Suggestion.field, Suggestion.created_at, Suggestion.status, Suggestion.edited_at)
    rows = db.execute(select(*columns).where(Suggestion.created_at >= since, Suggestion.changed.is_(True))).all()
    out: Dict[Tuple[str, str], Dict[str, int]] = {}
    for field, created_at, status, edited_at in rows:
        monday = (created_at.date() - timedelta(days=created_at.weekday())).isoformat()
        bucket = out.setdefault((field, monday), {
            "accepted": 0, "declined": 0, "unchanged": 0, "pending": 0, "edited_after_accept": 0,
        })
        bucket[status] = bucket.get(status, 0) + 1
        if edited_at is not None:
            bucket["edited_after_accept"] += 1
    return out
