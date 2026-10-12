import io
import os
import zipfile

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import Base, get_db, make_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.parse_queue import get_parse_queue  # noqa: E402

PASSWORD = "Passw0rdOK"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    get_settings.cache_clear()
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    # Record parse jobs instead of sending them to Redis/Celery.
    queued = []
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_parse_queue] = lambda: (lambda cv_id, key: queued.append((cv_id, key)))
    with TestClient(app) as c:
        c.session_factory = Session
        c.upload_dir = tmp_path / "uploads"
        c.queued_parse_jobs = queued
        yield c
    app.dependency_overrides.clear()
    engine.dispose()
    get_settings.cache_clear()


def signup(client, email="user@example.com", password=PASSWORD):
    return client.post("/api/auth/signup", json={"email": email, "password": password})


@pytest.fixture()
def auth(client):
    """Signed-up user: returns (headers, token_response_json)."""
    body = signup(client).json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body


def make_pdf(extra: int = 0) -> bytes:
    return b"%PDF-1.4\n1 0 obj<<>>endobj\n" + b"0" * extra + b"\n%%EOF"


def make_docx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", "<w:document/>")
    return buf.getvalue()


PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
