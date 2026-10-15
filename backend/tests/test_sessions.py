from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings
from app.models.user import User
from app.services import google_service
from tests.conftest import signup


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def claims(token):
    s = get_settings()
    return jwt.decode(token, s.JWT_SECRET, algorithms=[s.JWT_ALGORITHM])


def test_tokens_last_seven_days(client):
    token = signup(client).json()["access_token"]
    c = claims(token)
    assert c["exp"] - c["iat"] == 7 * 24 * 3600 and c["ver"] == 0


def test_refresh_gives_a_new_token_for_an_active_session(client, auth):
    r = client.post("/api/auth/refresh", headers=auth[0])
    assert r.status_code == 200 and r.json()["user"]["email"] == "user@example.com"
    new = r.json()["access_token"]
    assert client.get("/api/user", headers=bearer(new)).status_code == 200
    assert client.post("/api/auth/refresh").status_code == 401


def test_an_expired_token_cannot_be_refreshed(client, auth):
    s = get_settings()
    old = claims(auth[1]["access_token"])
    past = datetime.now(timezone.utc) - timedelta(days=8)
    expired = jwt.encode({**old, "iat": past, "exp": past + timedelta(days=7)}, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)
    assert client.post("/api/auth/refresh", headers=bearer(expired)).status_code == 401


def test_bumping_the_version_ends_every_session(client, auth):
    with client.session_factory() as db:
        db.query(User).one().token_version += 1
        db.commit()
    r = client.get("/api/user", headers=auth[0])
    assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHORIZED"
    fresh = signup(client).json()["access_token"]  # logging in again works
    assert client.get("/api/user", headers=bearer(fresh)).status_code == 200


def test_tokens_from_before_versions_still_work(client, auth):
    s = get_settings()
    c = claims(auth[1]["access_token"])
    c.pop("ver")
    legacy = jwt.encode(c, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)
    assert client.get("/api/user", headers=bearer(legacy)).status_code == 200


def test_google_link_removing_a_password_ends_old_sessions(client, monkeypatch):
    with client.session_factory() as db:
        db.add(User(email="victim@example.com", password_hash="x", email_verified=False))
        db.commit()
        user = db.query(User).one()
    from app.utils.jwt_handler import create_access_token

    old = create_access_token(user.id, 0)
    monkeypatch.setattr(
        google_service, "verify_google_id_token",
        lambda t: {"sub": "g-v", "email": "victim@example.com", "email_verified": True},
    )
    new = client.post("/api/auth/google", json={"id_token": "t"}).json()["access_token"]
    assert client.get("/api/user", headers=bearer(old)).status_code == 401
    assert client.get("/api/user", headers=bearer(new)).status_code == 200
