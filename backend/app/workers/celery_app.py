"""Celery application. Start a worker with: celery -A app.workers.celery_app worker --loglevel=info"""
from celery import Celery

from app.config import get_settings

_redis_url = get_settings().REDIS_URL

celery = Celery("cvsmith", broker=_redis_url, backend=_redis_url, include=["app.workers.tasks"])
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    task_ignore_result=True,  # results live on the CV row, not in Redis
    # Re-deliver a job if the worker dies mid-task; run_parsing is safe to repeat.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    broker_connection_timeout=2,
    task_soft_time_limit=180,
    task_time_limit=240,
)
