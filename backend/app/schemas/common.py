from datetime import datetime, timezone


def as_utc(value: datetime) -> datetime:
    """SQLite returns naive datetimes; they are always stored as UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value
