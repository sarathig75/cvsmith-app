from datetime import timedelta

import pytest

from app.config import get_settings
from app.models.login_code import LoginCode
from app.models.user import User
from app.services import email_service
from app.services.email_service import EmailError, get_email_sender

EMAIL = "jane@example.com"


def ask(client, email=EMAIL):
    return client.post("/api/auth/code", json={"email": email})


def enter(client, code, email=EMAIL):
    return client.post("/api/auth/code/verify", json={"email": email, "code": code})


def wrong(code):
    return f"{(int(code) + 1) % 1_000_000:06d}"


def age_codes(client, seconds):
    with client.session_factory() as db:
        for row in db.query(LoginCode):
            row.created_at -= timedelta(seconds=seconds)
            row.expires_at -= timedelta(seconds=seconds)
        db.commit()


def test_first_code_login_creates_a_verified_account(client):
    r = ask(client, "  Jane@Example.COM ")
    assert r.status_code == 200 and "jane@example.com" in r.json()["message"]
    code = client.mailbox.codes[EMAIL]
    assert len(code) == 6 and code.isdigit()
    r = enter(client, f" {code} ", "JANE@example.com")
    assert r.status_code == 201
    assert r.json()["user"]["email"] == EMAIL and r.json()["user"]["email_verified"] is True
    assert client.get("/api/user", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).status_code == 200
    with client.session_factory() as db:
        assert db.query(LoginCode).one().code_hash != code  # only a hash is stored


def test_returning_user_logs_in_to_the_same_account(client):
    ask(client)
    first = enter(client, client.mailbox.codes[EMAIL]).json()
    age_codes(client, 61)
    ask(client)
    r = enter(client, client.mailbox.codes[EMAIL])
    assert r.status_code == 200 and r.json()["user"]["id"] == first["user"]["id"]


def test_a_code_works_once(client):
    ask(client)
    code = client.mailbox.codes[EMAIL]
    assert enter(client, code).status_code == 201
    r = enter(client, code)
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_CODE"


def test_wrong_codes_count_down_then_the_code_dies(client):
    ask(client)
    code = client.mailbox.codes[EMAIL]
    messages = [enter(client, wrong(code)).json()["error"]["message"] for _ in range(5)]
    assert messages[0] == "That code is not right. 4 tries left."
    assert messages[3] == "That code is not right. 1 try left."
    assert messages[4] == "Too many wrong tries. Please ask for a new code."
    assert enter(client, code).status_code == 400  # even the right code is dead now


def test_expired_code_is_refused(client):
    ask(client)
    age_codes(client, 11 * 60)
    r = enter(client, client.mailbox.codes[EMAIL])
    assert r.status_code == 400 and "expired" in r.json()["error"]["message"]


def test_new_code_waits_a_minute_and_replaces_the_old_one(client):
    ask(client)
    old = client.mailbox.codes[EMAIL]
    r = ask(client)
    assert r.status_code == 429 and r.json()["error"]["code"] == "RATE_LIMITED"
    assert "seconds before asking for a new code" in r.json()["error"]["message"]
    age_codes(client, 61)
    assert ask(client).status_code == 200
    new = client.mailbox.codes[EMAIL]
    if new != old:
        assert enter(client, old).status_code == 400
    assert enter(client, new).status_code == 201


def test_answers_do_not_reveal_whether_an_account_exists(client):
    ask(client)
    enter(client, client.mailbox.codes[EMAIL])
    age_codes(client, 61)
    known = ask(client).json()["message"].replace(EMAIL, "X")
    unknown = ask(client, "nobody@example.com").json()["message"].replace("nobody@example.com", "X")
    assert known == unknown


def test_code_for_one_email_does_not_work_for_another(client):
    ask(client)
    ask(client, "other@example.com")
    code, other = client.mailbox.codes[EMAIL], client.mailbox.codes["other@example.com"]
    if code != other:
        assert enter(client, code, "other@example.com").status_code == 400


@pytest.mark.parametrize("body", [
    {}, {"email": "x"}, {"email": EMAIL, "code": "12345"}, {"email": EMAIL, "code": "abcdef"},
])
def test_bad_input_is_a_validation_error(client, body):
    path = "/api/auth/code/verify" if "code" in body else "/api/auth/code"
    r = client.post(path, json=body)
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_failed_email_can_be_retried_at_once(client):
    class Broken:
        def send_login_code(self, to_email, code):
            raise EmailError

    client.app.dependency_overrides[get_email_sender] = lambda: Broken()
    r = ask(client)
    assert r.status_code == 503 and r.json()["error"]["code"] == "EMAIL_FAILED"
    client.app.dependency_overrides[get_email_sender] = lambda: client.mailbox
    assert ask(client).status_code == 200  # no wait: nothing was sent
    with client.session_factory() as db:
        assert db.query(User).count() == 0


# --- email providers ---------------------------------------------------------------

@pytest.fixture()
def settings_env(monkeypatch):
    def set_env(**values):
        for k, v in values.items():
            monkeypatch.setenv(k, v)
        get_settings.cache_clear()
    yield set_env
    get_settings.cache_clear()


def test_provider_is_a_setting(settings_env):
    settings_env(EMAIL_PROVIDER="", SENDGRID_API_KEY="")
    assert isinstance(email_service.get_email_sender(), email_service.LoggingEmailSender)
    settings_env(SENDGRID_API_KEY="k")
    assert isinstance(email_service.get_email_sender(), email_service.SendGridEmailSender)
    settings_env(EMAIL_PROVIDER="smtp")
    assert isinstance(email_service.get_email_sender(), email_service.SmtpEmailSender)


def test_log_provider_never_logs_codes_outside_development(settings_env, caplog):
    settings_env(ENVIRONMENT="production", JWT_SECRET="x" * 40)
    with pytest.raises(EmailError):
        email_service.LoggingEmailSender().send_login_code(EMAIL, "123456")
    assert "123456" not in caplog.text


def test_smtp_sender(settings_env, monkeypatch):
    settings_env(SMTP_HOST="smtp.example.com", SMTP_PORT="2525", SMTP_USERNAME="u", SMTP_PASSWORD="p",
                 EMAIL_FROM="CVSmith <noreply@cvsmith.test>")
    sent = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            sent["server"] = (host, port)

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self):
            sent["tls"] = True

        def login(self, user, password):
            sent["login"] = (user, password)

        def send_message(self, msg):
            sent["msg"] = msg

    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    email_service.SmtpEmailSender().send_login_code(EMAIL, "654321")
    assert sent["server"] == ("smtp.example.com", 2525) and sent["tls"] and sent["login"] == ("u", "p")
    assert sent["msg"]["To"] == EMAIL and "654321" in sent["msg"]["Subject"]
    assert "654321" in sent["msg"].get_content()

    def refuse(*a, **k):
        raise OSError("connection refused")

    monkeypatch.setattr(email_service.smtplib, "SMTP", refuse)
    with pytest.raises(EmailError):
        email_service.SmtpEmailSender().send_login_code(EMAIL, "654321")


def test_login_codes_expire_after_ten_minutes(client):
    ask(client)
    with client.session_factory() as db:
        row = db.query(LoginCode).one()
        span = row.expires_at - row.created_at
    assert span == timedelta(minutes=10)
