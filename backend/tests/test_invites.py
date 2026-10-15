import pytest

from app.cli import main as cli
from app.config import get_settings
from app.services import google_service
from tests.conftest import signup


@pytest.fixture()
def invite_only(monkeypatch):
    monkeypatch.setenv("INVITE_ONLY", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture()
def cli_db(client, monkeypatch):
    """Point the admin command-line tool at the test database."""
    import app.cli

    monkeypatch.setattr(app.cli, "SessionLocal", client.session_factory)


def ask(client, email):
    return client.post("/api/auth/code", json={"email": email})


def test_off_by_default_anyone_can_sign_up(client):
    assert signup(client, "anyone@example.com").status_code == 201


def test_only_invited_addresses_get_a_code(client, invite_only, cli_db, capsys):
    r = ask(client, "stranger@example.com")
    assert r.status_code == 403 and r.json()["error"]["code"] == "NOT_INVITED"
    assert "private beta" in r.json()["error"]["message"]
    assert client.mailbox.codes == {}

    assert cli(["invites", "add", " Pilot@Example.com ", "second@example.com", "--note", "pilot"]) == 0
    assert "Invited 2" in capsys.readouterr().out
    assert signup(client, "pilot@example.com").status_code == 201


def test_existing_accounts_keep_access(client, monkeypatch):
    signup(client, "early@example.com")  # signed up before invite-only was switched on
    monkeypatch.setenv("INVITE_ONLY", "true")
    get_settings.cache_clear()
    try:
        assert signup(client, "early@example.com").status_code == 200
    finally:
        get_settings.cache_clear()


def test_removing_an_invite_blocks_an_unused_code(client, invite_only, cli_db):
    cli(["invites", "add", "maybe@example.com"])
    assert ask(client, "maybe@example.com").status_code == 200
    cli(["invites", "remove", "maybe@example.com"])
    code = client.mailbox.codes["maybe@example.com"]
    r = client.post("/api/auth/code/verify", json={"email": "maybe@example.com", "code": code})
    assert r.status_code == 403


def test_google_login_needs_an_invite(client, invite_only, cli_db, monkeypatch):
    monkeypatch.setattr(google_service, "verify_google_id_token",
                        lambda t: {"sub": "g1", "email": "g@example.com", "email_verified": True})
    r = client.post("/api/auth/google", json={"id_token": "t"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "NOT_INVITED"
    cli(["invites", "add", "g@example.com"])
    assert client.post("/api/auth/google", json={"id_token": "t"}).status_code == 200


def test_cli_lists_and_ignores_duplicates(client, cli_db, capsys):
    cli(["invites", "add", "a@example.com"])
    cli(["invites", "add", "A@example.com"])
    assert "already invited" in capsys.readouterr().out
    cli(["invites", "list"])
    out = capsys.readouterr().out
    assert "a@example.com" in out and "1 invited" in out
    cli(["invites", "remove", "nobody@example.com"])
    assert "none were invited" in capsys.readouterr().out
