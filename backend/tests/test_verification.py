import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings
from app.models.user import User
from app.utils.jwt_handler import create_access_token, create_verification_token
from tests.conftest import signup


def _logged_token(caplog):
    for rec in caplog.records:
        m = re.search(r"token=([\w\-.]+)", rec.getMessage())
        if m:
            return m.group(1)
    return None


def test_send_verification_requires_auth(client):
    assert client.post("/api/auth/send-verification").status_code == 401


def test_full_verification_flow(client, auth, caplog):
    headers, body = auth
    caplog.clear()
    with caplog.at_level(logging.INFO, logger="cvsmith.email"):
        r = client.post("/api/auth/send-verification", headers=headers)
    assert r.status_code == 202 and "message" in r.json()
    token = _logged_token(caplog)
    assert token, "dev email sender should log the verification link"

    r = client.post("/api/auth/verify", json={"token": token})
    assert r.status_code == 200
    assert r.json()["email_verified"] is True
    assert client.get("/api/user", headers=headers).json()["email_verified"] is True
    with client.session_factory() as db:
        assert db.query(User).one().email_verified_at is not None

    # idempotent
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 200


def test_verify_rejects_garbage_expired_and_wrong_type(client, auth):
    _, body = auth
    uid = uuid.UUID(body["user"]["id"])
    s = get_settings()
    expired = jwt.encode(
        {
            "sub": str(uid),
            "email": "user@example.com",
            "typ": "email_verify",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        s.JWT_SECRET,
        algorithm=s.JWT_ALGORITHM,
    )
    for bad in ("garbage", expired, create_access_token(uid)):
        r = client.post("/api/auth/verify", json={"token": bad})
        assert r.status_code == 400, bad
        assert r.json()["error"]["code"] == "INVALID_TOKEN"


def test_verify_token_bound_to_email_at_issue_time(client):
    body = signup(client, "old@example.com").json()
    tok = create_verification_token(uuid.UUID(body["user"]["id"]), "other@example.com")
    r = client.post("/api/auth/verify", json={"token": tok})
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_TOKEN"
