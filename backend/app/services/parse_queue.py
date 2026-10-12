"""Hands parse jobs to the Celery worker. A FastAPI dependency so tests can swap it out."""
import uuid
from typing import Callable

ParseQueue = Callable[[uuid.UUID, str], None]


def celery_enqueue(cv_id: uuid.UUID, upload_key: str) -> None:
    from app.workers.tasks import parse_cv  # imported lazily: Celery is only needed when enqueuing

    # Fail fast if Redis is unreachable so the upload request is never held up.
    parse_cv.apply_async(
        args=(str(cv_id), upload_key),
        retry=True,
        retry_policy={"max_retries": 2, "interval_start": 0, "interval_step": 0.5, "interval_max": 1},
    )


def get_parse_queue() -> ParseQueue:
    return celery_enqueue
