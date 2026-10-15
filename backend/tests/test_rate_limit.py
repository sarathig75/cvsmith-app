from app.services import rate_limit
from app.services.rate_limit import RedisRateLimiter
from tests.test_login_codes import age_codes, ask, enter


def test_codes_for_one_address_are_limited_per_hour(client):
    for _ in range(5):
        assert ask(client).status_code == 200
        age_codes(client, 61)  # past the 60-second resend wait
    r = ask(client)
    assert r.status_code == 429 and r.json()["error"]["code"] == "RATE_LIMITED"
    assert ask(client, "someone.else@example.com").status_code == 200  # other addresses are fine


def test_code_requests_from_one_ip_are_limited(client):
    for i in range(20):
        assert ask(client, f"user{i}@example.com").status_code == 200
    assert ask(client, "user99@example.com").status_code == 429


def test_code_guessing_from_one_ip_is_limited(client):
    for i in range(20):
        ask(client, f"g{i}@example.com")
    statuses = [enter(client, "000000", f"g{i % 20}@example.com").status_code for i in range(31)]
    assert statuses[:30] == [400] * 30 and statuses[30] == 429


def test_redis_down_does_not_block_logins(monkeypatch):
    class Broken:
        def pipeline(self):
            raise ConnectionError("redis is down")

    monkeypatch.setattr(RedisRateLimiter, "_client", Broken())
    assert RedisRateLimiter().hit("x", 1, 60) is True
    assert RedisRateLimiter().hit("x", 1, 60) is True


def test_limits_are_documented():
    assert set(rate_limit.LIMITS) == {"code_email", "code_ip", "verify_ip", "google_ip"}
