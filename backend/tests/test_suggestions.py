from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.models.event import Event
from app.models.suggestion import Suggestion
from app.models.user import User
from app.services import suggestion_service
from app.services.suggestion_service import SuggestionError, get_writer
from tests.conftest import signup

SUMMARY = "Did lots of stuff with sales teams and things for many years"


class FakeWriter:
    """Stands in for Claude: records calls and returns a fixed result."""

    def __init__(self, suggested="• Led a sales team of 12", changed=True, fail=False):
        self.suggested, self.changed, self.fail = suggested, changed, fail
        self.calls = []

    def write(self, field, text, context):
        self.calls.append((field, text, context))
        if self.fail:
            raise SuggestionError
        return self.suggested, self.changed


@pytest.fixture()
def writer(client):
    w = FakeWriter()
    client.app.dependency_overrides[get_writer] = lambda: w
    return w


def ask(client, headers, **body):
    return client.post("/api/suggestions", headers=headers, json={"field": "summary", "text": SUMMARY, **body})


def quota(client, headers):
    return client.get("/api/suggestions/quota", headers=headers).json()


def event_list(client):
    with client.session_factory() as db:
        return [(e.event_type, e.event_metadata) for e in db.query(Event).order_by(Event.created_at)]


def set_plan(client, plan):
    with client.session_factory() as db:
        db.query(User).update({"plan": plan})
        db.commit()


def test_requires_auth(client):
    assert client.get("/api/suggestions/quota").status_code == 401
    assert client.post("/api/suggestions", json={"field": "summary", "text": "x"}).status_code == 401


def test_free_user_gets_one_suggestion_then_402_before_any_ai_call(client, auth, writer):
    h = auth[0]
    q = quota(client, h)
    assert (q["plan"], q["limit"], q["used"], q["remaining"]) == ("free", 1, 0, 1)

    r = ask(client, h, field="experience", entry_id="e1", context={"title": "Sales Lead", "company": "Acme"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["original"] == SUMMARY and body["suggested"] == "• Led a sales team of 12"
    assert body["changed"] is True and body["status"] == "pending"
    assert body["field"] == "experience" and body["entry_id"] == "e1"
    assert writer.calls == [("experience", SUMMARY, {"title": "Sales Lead", "company": "Acme"})]
    assert quota(client, h)["remaining"] == 0

    r = ask(client, h)
    assert r.status_code == 402 and r.json()["error"]["code"] == "QUOTA_EXCEEDED"
    assert "Upgrade to Pro for 50 suggestions a month" in r.json()["error"]["message"]
    assert len(writer.calls) == 1  # the AI was not called for the refused request


def test_pro_user_gets_fifty(client, auth, writer):
    set_plan(client, "pro")
    for _ in range(3):
        assert ask(client, auth[0]).status_code == 201
    q = quota(client, auth[0])
    assert (q["plan"], q["limit"], q["used"], q["remaining"]) == ("pro", 50, 3, 47)


def test_no_change_needed_is_not_counted(client, auth, writer):
    writer.suggested, writer.changed = SUMMARY, True  # "changed" but the same text: guarded
    r = ask(client, auth[0])
    assert r.json()["changed"] is False and r.json()["status"] == "unchanged"
    writer.changed = False
    r = ask(client, auth[0])
    assert r.json()["changed"] is False and r.json()["suggested"] == SUMMARY
    assert quota(client, auth[0])["remaining"] == 1


def test_failed_ai_call_is_not_counted(client, auth, writer):
    writer.fail = True
    r = ask(client, auth[0])
    assert r.status_code == 503 and r.json()["error"]["code"] == "SUGGESTION_FAILED"
    assert quota(client, auth[0])["remaining"] == 1
    with client.session_factory() as db:
        assert db.query(Suggestion).count() == 0


@pytest.mark.parametrize("body", [
    {"text": "   "},
    {"text": "x" * 5001},
    {"field": "education"},
    {"text": SUMMARY, "context": {"salary": "1"}},
])
def test_bad_requests_are_rejected_without_ai_call(client, auth, writer, body):
    r = ask(client, auth[0], **body)
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert writer.calls == []
    assert SUMMARY not in r.text


def test_decisions_are_recorded_and_private(client, auth, writer):
    sid = ask(client, auth[0]).json()["id"]
    other = signup(client, "other@example.com").json()
    other_h = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.patch(f"/api/suggestions/{sid}", headers=other_h, json={"status": "accepted"}).status_code == 404
    r = client.patch(f"/api/suggestions/{sid}", headers=auth[0], json={"status": "accepted"})
    assert r.status_code == 200 and r.json()["status"] == "accepted"
    assert client.patch(f"/api/suggestions/{sid}", headers=auth[0], json={"status": "pending"}).status_code == 422
    with client.session_factory() as db:
        assert db.query(Suggestion).one().decided_at is not None


def test_unchanged_suggestions_keep_their_status(client, auth, writer):
    writer.changed = False
    sid = ask(client, auth[0]).json()["id"]
    r = client.patch(f"/api/suggestions/{sid}", headers=auth[0], json={"status": "declined"})
    assert r.json()["status"] == "unchanged"


def test_suggestions_are_linked_to_the_users_cv(client, auth, writer):
    client.patch("/api/cv", headers=auth[0], json={"content": {"summary": SUMMARY}})
    ask(client, auth[0])
    with client.session_factory() as db:
        assert db.query(Suggestion).one().cv_id is not None


def test_events_hold_no_cv_text(client, auth, writer):
    ask(client, auth[0])
    ask(client, auth[0], field="projects")
    events = event_list(client)
    assert events[1:] == [
        ("suggestion_requested", {"field": "summary", "changed": True}),
        ("upgrade_prompt_shown", {"field": "projects"}),
    ]
    for text in (SUMMARY, "sales", "Led"):
        assert text not in repr(events)


def test_quota_resets_on_the_first_of_the_month_utc(client, auth):
    with client.session_factory() as db:
        user = db.query(User).one()
        edges = (datetime(2026, 9, 30, 23, 59, tzinfo=timezone.utc), datetime(2026, 10, 1, tzinfo=timezone.utc))
        for ts in edges:
            db.add(Suggestion(user_id=user.id, field="summary", original_text="a", suggested_text="b",
                              changed=True, created_at=ts))
        db.commit()
        september = suggestion_service.quota(db, user, now=datetime(2026, 9, 15, tzinfo=timezone.utc))
        october = suggestion_service.quota(db, user, now=datetime(2026, 10, 31, 23, 0, tzinfo=timezone.utc))
        december = suggestion_service.quota(db, user, now=datetime(2026, 12, 31, tzinfo=timezone.utc))
    assert september["used"] == 1 and september["resets_at"] == datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert october["used"] == 1 and october["resets_at"] == datetime(2026, 11, 1, tzinfo=timezone.utc)
    assert december["used"] == 0 and december["resets_at"] == datetime(2027, 1, 1, tzinfo=timezone.utc)


def test_house_style_prompt_matches_the_skill():
    root = Path(__file__).resolve().parents[2]
    skill = (root / ".claude" / "skills" / "cv-house-style" / "SKILL.md").read_text()
    body = skill.split("---", 2)[2].lstrip("\n") if skill.startswith("---") else skill
    assert suggestion_service.HOUSE_STYLE.strip() == body.strip(), (
        "backend/app/prompts/cv_house_style.md is out of date: copy the body of "
        ".claude/skills/cv-house-style/SKILL.md (without the front matter) into it."
    )


def test_claude_writer_maps_failures(monkeypatch):
    class Resp:
        def __init__(self, stop, parsed):
            self.stop_reason, self.parsed_output = stop, parsed

    class Client:
        def __init__(self, resp):
            self.beta = type("B", (), {"messages": type("M", (), {"parse": lambda _s, **kw: resp})()})()

    ok = suggestion_service.ClaudeSuggestionWriter(
        client=Client(Resp("end_turn", suggestion_service.Rewrite(suggested=" • Better ", changed=True))), model="m")
    assert ok.write("summary", "text", {}) == ("• Better", True)
    for resp in (Resp("refusal", None), Resp("max_tokens", None)):
        with pytest.raises(SuggestionError):
            suggestion_service.ClaudeSuggestionWriter(client=Client(resp), model="m").write("summary", "t", {})
