"""Funnel tracking: record the steps users reach, to see where they drop off.

Recording must never break or slow the user's action, so every failure is logged and
swallowed, and events are written in their own transaction after the action has committed.
"""
import logging
import uuid
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import EVENT_TYPES, ONCE_PER_USER, Event

logger = logging.getLogger("cvsmith.events")


def record(db: Session, user_id: uuid.UUID, event_type: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    """Record one step for a user. Call only after the action itself has been committed."""
    if event_type not in EVENT_TYPES:
        logger.error("Unknown event type %r not recorded", event_type)
        return
    try:
        if event_type in ONCE_PER_USER and db.scalar(
            select(Event.id).where(Event.user_id == user_id, Event.event_type == event_type)
        ):
            return
        db.add(Event(user_id=user_id, event_type=event_type, event_metadata=metadata or {}))
        db.commit()
    except Exception:
        # Includes the unique index catching a concurrent duplicate of a once-per-user step.
        db.rollback()
        logger.warning("Could not record %s event for user %s", event_type, user_id, exc_info=True)
