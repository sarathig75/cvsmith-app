import uuid

from app.database import SessionLocal
from app.services import parsing_service
from app.services.cv_parser import get_parser
from app.services.storage_service import get_storage
from app.workers.celery_app import celery


@celery.task(name="cv.parse")
def parse_cv(cv_id: str, upload_key: str) -> None:
    with SessionLocal() as db:
        parsing_service.run_parsing(db, get_storage(), get_parser(), uuid.UUID(cv_id), upload_key)
