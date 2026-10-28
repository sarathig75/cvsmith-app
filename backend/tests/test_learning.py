import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.suggestion import Suggestion
from app.models.unmatched import UnmatchedTerm
from app.services import learning_service
from app.services.learning_service import normalise_term, record_unmatched, unmatched_report


def terms(client):
    with client.session_factory() as db:
        return {(r.kind, r.term): (r.count, r.status) for r in db.query(UnmatchedTerm).all()}


# --- normalising terms -------------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("  Stakeholder   Management ", "stakeholder management"),
    ("ReactJS", "reactjs"),
    ("", None),
    ("   ", None),
    ("x" * 61, None),
    ("one two three four five", None),
    ("CNC programmer 2", None),          # digits: may hold numbers or dates
    ("jane@example.com", None),          # emails are never stored
    ("+44 20 7946 0958", None),
    (None, None),
])
def test_normalise_term_rules(raw, expected):
    assert normalise_term(raw) == expected


# --- recording -----------------------------------------------------------------------

def test_record_counts_sightings_and_keeps_no_user_link(client):
    with client.session_factory() as db:
        for raw in ["Reactjs", "reactjs ", "ReactJS"]:
            record_unmatched(db, "skill", raw)
        record_unmatched(db, "verb", "Orchestrated")
    assert terms(client) == {("skill", "reactjs"): (3, "open"), ("verb", "orchestrated"): (1, "open")}
    columns = set(UnmatchedTerm.__table__.columns.keys())
    assert not any("user" in c or "cv" in c or "email" in c for c in columns)


def test_unknown_kind_and_bad_terms_are_ignored(client):
    with client.session_factory() as db:
        record_unmatched(db, "colour", "blue")
        record_unmatched(db, "skill", "jane@example.com")
    assert terms(client) == {}


def test_recording_never_raises(client, monkeypatch):
    with client.session_factory() as db:
        def broken(*args, **kwargs):
            raise RuntimeError("database is down")
        monkeypatch.setattr(db, "scalar", broken)
        record_unmatched(db, "skill", "kubernetes operator")  # must not raise


def test_report_shows_only_open_terms_seen_enough(client):
    with client.session_factory() as db:
        for _ in range(5):
            record_unmatched(db, "title", "CNC programmer")
        for _ in range(2):
            record_unmatched(db, "title", "rare title")
        record_unmatched(db, "sector", "Aerospace")
        assert [r.term for r in unmatched_report(db, min_count=5)] == ["cnc programmer"]
        assert learning_service.set_unmatched_status(db, "title", "CNC programmer", "ignored") is True
        assert unmatched_report(db, min_count=5) == []
        assert learning_service.set_unmatched_status(db, "title", "never seen", "resolved") is False


# --- suggestion counts ------------------------------------------------------------------

def make_suggestion(client, user_id, field, status, created_at, edited_at=None):
    with client.session_factory() as db:
        db.add(Suggestion(user_id=uuid.UUID(str(user_id)), field=field, original_text="a", suggested_text="b",
                          changed=status != "unchanged", status=status, created_at=created_at, edited_at=edited_at))
        db.commit()


def test_suggestion_report_counts_per_field_and_week(client, auth):
    user_id = client.get("/api/user", headers=auth[0]).json()["id"]
    monday = datetime(2026, 10, 26, 9, 0, tzinfo=timezone.utc)  # a Monday
    make_suggestion(client, user_id, "summary", "accepted", monday, edited_at=monday)
    make_suggestion(client, user_id, "summary", "accepted", monday)
    make_suggestion(client, user_id, "summary", "declined", monday + timedelta(days=2))
    make_suggestion(client, user_id, "summary", "pending", monday + timedelta(days=3))
    make_suggestion(client, user_id, "headline", "unchanged", monday)
    with client.session_factory() as db:
        report = learning_service.suggestion_report(db, weeks=4, now=monday + timedelta(days=1))
    assert report[("summary", "2026-10-26")] == {
        "accepted": 2, "declined": 1, "unchanged": 0, "pending": 1, "edited_after_accept": 1,
    }
    assert ("headline", "2026-10-26") not in report  # "unchanged" was not a change, so not counted


def test_suggestion_report_ignores_old_rows(client, auth):
    user_id = client.get("/api/user", headers=auth[0]).json()["id"]
    now = datetime(2026, 10, 28, tzinfo=timezone.utc)
    make_suggestion(client, user_id, "summary", "accepted", now - timedelta(weeks=6))
    with client.session_factory() as db:
        assert learning_service.suggestion_report(db, weeks=4, now=now) == {}


# --- the edit endpoint --------------------------------------------------------------------

def suggestion_for(client, auth, status):
    user_id = uuid.UUID(client.get("/api/user", headers=auth[0]).json()["id"])
    make_suggestion(client, user_id, "summary", status, datetime.now(timezone.utc))
    with client.session_factory() as db:
        row = db.query(Suggestion).filter(Suggestion.user_id == user_id).order_by(Suggestion.created_at.desc()).first()
        return str(row.id)


def test_first_edit_of_accepted_suggestion_is_recorded_once(client, auth):
    sid = suggestion_for(client, auth, "accepted")
    assert client.post(f"/api/suggestions/{sid}/edited", headers=auth[0]).status_code == 204
    with client.session_factory() as db:
        first = db.get(Suggestion, uuid.UUID(sid)).edited_at
    assert first is not None
    assert client.post(f"/api/suggestions/{sid}/edited", headers=auth[0]).status_code == 204
    with client.session_factory() as db:
        assert db.get(Suggestion, uuid.UUID(sid)).edited_at == first  # idempotent: the first time is kept


def test_edit_endpoint_refuses_pending_or_foreign_suggestions(client, auth):
    pending = suggestion_for(client, auth, "pending")
    assert client.post(f"/api/suggestions/{pending}/edited", headers=auth[0]).status_code == 404
    accepted = suggestion_for(client, auth, "accepted")
    other, _ = signup_other(client)
    assert client.post(f"/api/suggestions/{accepted}/edited", headers=other).status_code == 404


def signup_other(client):
    from tests.conftest import signup
    body = signup(client, "other@example.com").json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body


# --- CLI ----------------------------------------------------------------------------------

def test_cli_reports_run(client, capsys, monkeypatch):
    from app import cli
    monkeypatch.setattr(cli, "SessionLocal", client.session_factory)
    with client.session_factory() as db:
        for _ in range(5):
            record_unmatched(db, "skill", "pharmacovigilance tools")
    assert cli.main(["unmatched", "report", "--min-count", "5"]) == 0
    assert "skill\tpharmacovigilance tools\t5" in capsys.readouterr().out
    assert cli.main(["unmatched", "resolve", "skill", "pharmacovigilance tools"]) == 0
    assert "resolved: skill 'pharmacovigilance tools'" in capsys.readouterr().out
    assert cli.main(["suggestions", "report"]) == 0
    assert "no changed suggestions" in capsys.readouterr().out
