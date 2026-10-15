import uuid
from pathlib import Path

from app.models.cv import CV
from app.models.event import Event
from app.models.login_code import LoginCode
from app.models.suggestion import Suggestion
from app.models.user import User
from app.services.suggestion_service import get_writer
from tests.conftest import PDF_MIME, make_pdf, signup
from tests.test_suggestions import FakeWriter


def upload(client, headers):
    r = client.post("/api/cv/upload", headers=headers, files={"file": ("cv.pdf", make_pdf(), PDF_MIME)})
    assert r.status_code == 201
    return r


def stored_files(client):
    return [p for p in Path(client.upload_dir).rglob("*") if p.is_file()] if Path(client.upload_dir).exists() else []


def delete_account(client, headers, confirm="DELETE"):
    return client.request("DELETE", "/api/user", headers=headers, json={"confirm": confirm})


def test_delete_cv_removes_the_cv_and_its_file_but_keeps_the_account(client, auth):
    w = FakeWriter()
    client.app.dependency_overrides[get_writer] = lambda: w
    upload(client, auth[0])
    client.post("/api/suggestions", headers=auth[0], json={"field": "summary", "text": "Some summary text"})
    assert len(stored_files(client)) == 1
    r = client.delete("/api/cv", headers=auth[0])
    assert r.status_code == 204
    assert client.get("/api/cv", headers=auth[0]).status_code == 404
    assert stored_files(client) == []
    assert client.get("/api/user", headers=auth[0]).status_code == 200
    with client.session_factory() as db:
        s = db.query(Suggestion).one()  # still counts toward this month's quota
        assert s.cv_id is None
    assert client.delete("/api/cv", headers=auth[0]).status_code == 404


def test_delete_account_removes_everything_and_ends_the_session(client, auth):
    w = FakeWriter()
    client.app.dependency_overrides[get_writer] = lambda: w
    upload(client, auth[0])
    client.post("/api/suggestions", headers=auth[0], json={"field": "summary", "text": "Some summary text"})
    other = signup(client, "other@example.com").json()

    assert delete_account(client, auth[0], confirm="delete").status_code == 422  # must type DELETE
    r = delete_account(client, auth[0])
    assert r.status_code == 204
    assert client.get("/api/user", headers=auth[0]).status_code == 401
    assert stored_files(client) == []
    with client.session_factory() as db:
        assert [u.email for u in db.query(User)] == ["other@example.com"]
        assert db.query(CV).count() == 0 and db.query(Suggestion).count() == 0
        assert db.query(LoginCode).filter(LoginCode.email == "user@example.com").count() == 0
        # funnel events stay, without the link to the person
        mine = db.query(Event).filter(Event.user_id.is_(None)).all()
        assert {e.event_type for e in mine} >= {"signup", "cv_uploaded", "account_deleted"}
        assert db.query(Event).filter(Event.user_id == uuid.UUID(other["user"]["id"])).count() >= 1

    # The same email can sign up again as a new, empty account.
    again = signup(client, "user@example.com")
    assert again.status_code == 201
    assert client.get("/api/cv", headers={"Authorization": f"Bearer {again.json()['access_token']}"}).status_code == 404


def test_deleting_needs_login(client):
    assert client.delete("/api/cv").status_code == 401
    assert delete_account(client, {}).status_code == 401
