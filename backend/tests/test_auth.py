import pytest

from app.models.user import User
from app.services import google_service
from tests.conftest import PASSWORD, signup


def err(resp):
    return resp.json()["error"]


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_signup_success_normalizes_email_and_hashes_password(client):
    r = signup(client, email="  New.User@Example.COM ")
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer" and body["access_token"]
    assert body["user"]["email"] == "new.user@example.com"
    assert body["user"]["email_verified"] is False
    assert set(body["user"]) == {"id", "email", "email_verified", "plan", "created_at"}
    assert body["user"]["plan"] == "free"
    with client.session_factory() as db:
        u = db.query(User).one()
        assert u.password_hash and u.password_hash != PASSWORD


def test_signup_duplicate_email_case_insensitive(client):
    assert signup(client, "a@example.com").status_code == 201
    r = signup(client, "A@Example.com")
    assert r.status_code == 409 and err(r)["code"] == "EMAIL_EXISTS"


@pytest.mark.parametrize("pw", ["short1", "allletters", "12345678", ""])
def test_signup_weak_password(client, pw):
    r = signup(client, password=pw)
    assert r.status_code == 422
    assert err(r)["code"] == "VALIDATION_ERROR"
    assert pw not in err(r)["message"] or pw == ""


def test_signup_invalid_email(client):
    r = signup(client, email="not-an-email")
    assert r.status_code == 422 and err(r)["code"] == "VALIDATION_ERROR"


def test_login_success(client):
    signup(client)
    r = client.post("/api/auth/login", json={"email": "USER@example.com", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "user@example.com"


def test_login_wrong_password_and_unknown_email_are_indistinguishable(client):
    signup(client)
    wrong = client.post("/api/auth/login", json={"email": "user@example.com", "password": "Nope1234"})
    unknown = client.post("/api/auth/login", json={"email": "who@example.com", "password": "Nope1234"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert err(wrong)["code"] == "INVALID_CREDENTIALS"


def test_login_password_for_google_only_user_fails(client, monkeypatch):
    monkeypatch.setattr(
        google_service,
        "verify_google_id_token",
        lambda t: {"sub": "g1", "email": "g@example.com", "email_verified": True},
    )
    assert client.post("/api/auth/google", json={"id_token": "x"}).status_code == 200
    r = client.post("/api/auth/login", json={"email": "g@example.com", "password": PASSWORD})
    assert r.status_code == 401 and err(r)["code"] == "INVALID_CREDENTIALS"


def test_google_login_creates_new_user(client, monkeypatch):
    monkeypatch.setattr(
        google_service,
        "verify_google_id_token",
        lambda t: {"sub": "g-123", "email": "Gnew@Example.com", "email_verified": True},
    )
    r = client.post("/api/auth/google", json={"id_token": "tok"})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "gnew@example.com"
    assert r.json()["user"]["email_verified"] is True
    with client.session_factory() as db:
        u = db.query(User).one()
        assert u.google_id == "g-123" and u.password_hash is None


def test_google_login_existing_user_links_and_reuses_account(client, monkeypatch):
    first = signup(client, "both@example.com").json()
    monkeypatch.setattr(
        google_service,
        "verify_google_id_token",
        lambda t: {"sub": "g-9", "email": "both@example.com", "email_verified": True},
    )
    r1 = client.post("/api/auth/google", json={"id_token": "t"})
    r2 = client.post("/api/auth/google", json={"id_token": "t"})
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["user"]["id"] == r2.json()["user"]["id"] == first["user"]["id"]
    with client.session_factory() as db:
        assert db.query(User).count() == 1


def test_google_link_removes_password_of_unverified_account(client, monkeypatch):
    # Someone pre-registers the address with a password, never verifying it.
    signup(client, "victim@example.com")
    monkeypatch.setattr(
        google_service,
        "verify_google_id_token",
        lambda t: {"sub": "g-v", "email": "victim@example.com", "email_verified": True},
    )
    assert client.post("/api/auth/google", json={"id_token": "t"}).status_code == 200
    r = client.post("/api/auth/login", json={"email": "victim@example.com", "password": PASSWORD})
    assert r.status_code == 401 and err(r)["code"] == "INVALID_CREDENTIALS"
    with client.session_factory() as db:
        assert db.query(User).one().password_hash is None


def test_google_link_keeps_password_of_verified_account(client, monkeypatch, caplog):
    import logging
    import re

    headers = {"Authorization": f"Bearer {signup(client, 'owner@example.com').json()['access_token']}"}
    with caplog.at_level(logging.INFO, logger="cvsmith.email"):
        client.post("/api/auth/send-verification", headers=headers)
    token = next(
        m.group(1) for rec in caplog.records if (m := re.search(r"token=([\w\-.]+)", rec.getMessage()))
    )
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 200

    monkeypatch.setattr(
        google_service,
        "verify_google_id_token",
        lambda t: {"sub": "g-o", "email": "owner@example.com", "email_verified": True},
    )
    assert client.post("/api/auth/google", json={"id_token": "t"}).status_code == 200
    r = client.post("/api/auth/login", json={"email": "owner@example.com", "password": PASSWORD})
    assert r.status_code == 200


def test_google_login_rejects_invalid_token_and_unverified_email(client, monkeypatch):
    def bad(token):
        raise google_service.GoogleVerificationError("bad")

    monkeypatch.setattr(google_service, "verify_google_id_token", bad)
    r = client.post("/api/auth/google", json={"id_token": "x"})
    assert r.status_code == 401 and err(r)["code"] == "GOOGLE_AUTH_FAILED"

    monkeypatch.setattr(
        google_service,
        "verify_google_id_token",
        lambda t: {"sub": "g", "email": "u@example.com", "email_verified": False},
    )
    r = client.post("/api/auth/google", json={"id_token": "x"})
    assert r.status_code == 401 and err(r)["code"] == "GOOGLE_AUTH_FAILED"


def test_google_unconfigured_real_verifier_fails_closed(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "")
    get_settings.cache_clear()
    r = client.post("/api/auth/google", json={"id_token": "x"})
    assert r.status_code == 401 and err(r)["code"] == "GOOGLE_AUTH_FAILED"


def test_user_requires_token(client):
    r = client.get("/api/user")
    assert r.status_code == 401 and err(r)["code"] == "UNAUTHORIZED"
    r = client.get("/api/user", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401 and err(r)["code"] == "UNAUTHORIZED"


def test_user_with_token(client, auth):
    headers, body = auth
    r = client.get("/api/user", headers=headers)
    assert r.status_code == 200 and r.json()["id"] == body["user"]["id"]


def test_verification_token_cannot_be_used_as_access_token(client, auth):
    from app.utils.jwt_handler import create_verification_token

    _, body = auth
    import uuid

    tok = create_verification_token(uuid.UUID(body["user"]["id"]), "user@example.com")
    r = client.get("/api/user", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 401


def test_logout_requires_auth_and_returns_204(client, auth):
    assert client.post("/api/auth/logout").status_code == 401
    r = client.post("/api/auth/logout", headers=auth[0])
    assert r.status_code == 204 and r.content == b""


def test_validation_and_404_use_contract_error_format(client):
    r = client.post("/api/auth/login", json={})
    assert r.status_code == 422 and err(r)["code"] == "VALIDATION_ERROR"
    r = client.get("/api/nope")
    assert r.status_code == 404 and err(r)["code"] == "NOT_FOUND"
