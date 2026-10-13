import uuid

from app.models.cv import CV
from app.models.event import Event
from app.services import event_service, google_service, parsing_service
from app.services.storage_service import LocalStorage
from app.utils.jwt_handler import create_verification_token
from tests.conftest import PDF_MIME, make_pdf, signup
from tests.test_parsing import CV_TEXT, FakeParser, make_text_pdf

DRAFT = {"personal": {"name": "Jane Typed"}, "summary": "", "experience": [], "others": []}


def save(client, headers, **body):
    return client.patch("/api/cv", headers=headers, json={"content": DRAFT, **body})


def events(client, event_type=None):
    with client.session_factory() as db:
        q = db.query(Event)
        if event_type:
            q = q.filter(Event.event_type == event_type)
        return [(e.event_type, e.event_metadata) for e in q.order_by(Event.created_at)]


# --- saving the canvas -----------------------------------------------------------

def test_save_requires_auth(client):
    assert client.patch("/api/cv", json={"content": DRAFT}).status_code == 401


def test_first_save_without_upload_creates_the_cv(client, auth):
    r = save(client, auth[0], applied_parts=["extras", "basics", "basics"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["parsing_status"] == "not_uploaded" and body["json_resume"] == {}
    assert body["content"] == DRAFT and body["applied_parts"] == ["basics", "extras"]
    assert body["content_updated_at"] is not None
    assert client.get("/api/cv", headers=auth[0]).json()["content"] == DRAFT


def test_save_and_parsing_never_overwrite_each_other(client, auth):
    storage = LocalStorage(str(client.upload_dir))
    client.post("/api/cv/upload", headers=auth[0], files={"file": ("a.pdf", make_text_pdf(CV_TEXT), PDF_MIME)})
    cv_id, key = client.queued_parse_jobs[0]

    class SavesWhileParsing(FakeParser):
        def _parts(self):
            for i, item in enumerate(super()._parts()):
                if i == 0:  # the user's auto-save lands between two parsed parts
                    assert save(client, auth[0], applied_parts=["basics"]).status_code == 200
                yield item

    with client.session_factory() as db:
        parsing_service.run_parsing(db, storage, SavesWhileParsing(), cv_id, key)
    body = client.get("/api/cv", headers=auth[0]).json()
    assert body["content"] == DRAFT and body["applied_parts"] == ["basics"]
    assert body["json_resume"]["work"][0]["name"] == "Acme Ltd"
    assert body["parsing_status"] == "complete"


def test_new_upload_replaces_saved_edits(client, auth):
    save(client, auth[0])
    r = client.post("/api/cv/upload", headers=auth[0], files={"file": ("cv.pdf", make_pdf(), PDF_MIME)})
    assert r.json()["content"] is None and r.json()["applied_parts"] == []
    assert r.json()["parsing_status"] == "pending"


def test_save_rejects_bad_bodies(client, auth):
    h = auth[0]
    assert client.patch("/api/cv", headers=h, json={"content": ["not", "an", "object"]}).status_code == 422
    assert client.patch("/api/cv", headers=h, json={"content": {}, "applied_parts": ["other"]}).status_code == 422
    assert client.patch("/api/cv", headers=h, json={"content": {}, "json_resume": {}}).status_code == 422
    huge = {"summary": "x" * (256 * 1024)}
    r = client.patch("/api/cv", headers=h, json={"content": huge})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert client.get("/api/cv", headers=h).status_code == 404  # nothing was saved


def test_users_only_see_their_own_saved_cv(client, auth):
    save(client, auth[0])
    other = signup(client, "other@example.com").json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get("/api/cv", headers=other_headers).status_code == 404


# --- funnel events -----------------------------------------------------------------

def test_signup_upload_parse_and_first_edit_are_recorded(client, auth):
    storage = LocalStorage(str(client.upload_dir))
    client.post("/api/cv/upload", headers=auth[0], files={"file": ("my-cv.pdf", make_text_pdf(CV_TEXT), PDF_MIME)})
    cv_id, key = client.queued_parse_jobs[0]
    with client.session_factory() as db:
        parsing_service.run_parsing(db, storage, FakeParser(fail_parts={"extras"}), cv_id, key)
    save(client, auth[0], applied_parts=["basics"])  # parsed data only: not a user edit
    save(client, auth[0], edited=True)
    save(client, auth[0], edited=True)  # first_edit is recorded once

    assert events(client) == [
        ("signup", {"method": "email"}),
        ("cv_uploaded", {"file_type": ".pdf"}),
        ("parsing_finished", {"status": "complete", "failed_parts": ["extras"]}),
        ("first_edit", {}),
    ]


def test_events_never_hold_cv_content_or_personal_data(client, auth):
    client.post("/api/cv/upload", headers=auth[0], files={"file": ("Jane Doe CV.pdf", make_pdf(), PDF_MIME)})
    save(client, auth[0], edited=True)
    stored = repr(events(client))
    for secret in ("user@example.com", "Jane", "Doe", "Typed"):
        assert secret not in stored


def test_email_verification_is_recorded_once(client, auth):
    _, body = auth
    token = create_verification_token(uuid.UUID(body["user"]["id"]), body["user"]["email"])
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 200
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 200
    assert events(client, "email_verified") == [("email_verified", {"method": "email"})]


def test_google_signup_records_signup_and_verified_email(client, monkeypatch):
    monkeypatch.setattr(
        google_service, "verify_google_id_token",
        lambda t: {"sub": "g-1", "email": "g@example.com", "email_verified": True},
    )
    client.post("/api/auth/google", json={"id_token": "t"})
    client.post("/api/auth/google", json={"id_token": "t"})  # signing in again is not a signup
    assert events(client) == [("signup", {"method": "google"}), ("email_verified", {"method": "google"})]


def test_a_failing_event_never_breaks_the_action(client, monkeypatch):
    def broken_add(self, obj):
        raise RuntimeError("events table unavailable")

    monkeypatch.setattr(event_service.Event, "__init__", broken_add)
    r = signup(client, "resilient@example.com")
    assert r.status_code == 201
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert save(client, headers, edited=True).status_code == 200
    with client.session_factory() as db:
        assert db.query(CV).one().content == DRAFT
