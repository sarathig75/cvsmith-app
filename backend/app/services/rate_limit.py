"""Fixed-window rate limits (Redis), against password-free login abuse: code spamming, code
guessing and bot traffic. If Redis is unavailable the limit is skipped ("fail open"), so a
Redis outage never locks people out; the per-code rules (5 tries, 60 s resend) still apply.
"""
import logging
import time
from typing import Dict, Optional, Protocol, Tuple

from fastapi import Request

from app.config import get_settings
from app.utils import errors

logger = logging.getLogger("cvsmith.ratelimit")

# name -> (max requests, window in seconds)
LIMITS: Dict[str, Tuple[int, int]] = {
    "code_email": (5, 3600),     # login codes emailed to one address per hour
    "code_ip": (20, 3600),       # login codes requested from one IP per hour
    "verify_ip": (30, 600),      # code checks from one IP per 10 minutes
    "google_ip": (30, 600),      # Google logins from one IP per 10 minutes
}


class RateLimiter(Protocol):
    def hit(self, key: str, limit: int, window: int) -> bool:
        """Count one request; True if it is within the limit."""


class RedisRateLimiter:
    _client = None

    def _redis(self):
        if RedisRateLimiter._client is None:
            import redis

            RedisRateLimiter._client = redis.Redis.from_url(
                get_settings().REDIS_URL, socket_timeout=0.5, socket_connect_timeout=0.5
            )
        return RedisRateLimiter._client

    def hit(self, key: str, limit: int, window: int) -> bool:
        bucket = f"rl:{key}:{int(time.time()) // window}"
        try:
            pipe = self._redis().pipeline()
            pipe.incr(bucket)
            pipe.expire(bucket, window)
            count = pipe.execute()[0]
        except Exception as exc:  # Redis down: do not block logins
            logger.warning("Rate limit skipped (Redis unavailable): %s", exc)
            return True
        return count <= limit


class MemoryRateLimiter:
    """For tests and single-process development without Redis."""

    def __init__(self):
        self.counts: Dict[str, int] = {}

    def hit(self, key: str, limit: int, window: int) -> bool:
        bucket = f"{key}:{int(time.time()) // window}"
        self.counts[bucket] = self.counts.get(bucket, 0) + 1
        return self.counts[bucket] <= limit


def get_rate_limiter() -> RateLimiter:
    return RedisRateLimiter()


def client_ip(request: Request) -> str:
    # The direct peer. Behind a proxy (production) this must become the forwarded client
    # address, set up with the hosting (Week 12).
    return request.client.host if request.client else "unknown"


def check(limiter: RateLimiter, name: str, who: Optional[str]) -> None:
    limit, window = LIMITS[name]
    if not limiter.hit(f"{name}:{who or 'unknown'}", limit, window):
        logger.info("Rate limit %s reached", name)
        raise errors.rate_limited("Too many attempts. Please wait a few minutes and try again.")
