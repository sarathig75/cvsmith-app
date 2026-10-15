"""Application settings, loaded from environment / .env."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "dev-insecure-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "CVSmith"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = "sqlite:///./cvsmith.db"

    JWT_SECRET: str = DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    # Sessions end after this long without activity: the app refreshes the token while in use.
    JWT_EXPIRATION_HOURS: int = 168

    GOOGLE_OAUTH_CLIENT_ID: str = ""

    # Email (login codes). See app/services/email_service.py.
    EMAIL_PROVIDER: str = ""  # "log" | "sendgrid" | "smtp"; empty = sendgrid if a key is set, else log
    EMAIL_FROM: str = "noreply@cvsmith.com"
    SENDGRID_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_STARTTLS: bool = True
    LOGIN_CODE_MINUTES: int = 10
    LOGIN_CODE_MAX_ATTEMPTS: int = 5
    LOGIN_CODE_RESEND_SECONDS: int = 60
    # Password sign-up and login are off in Release 1 (login is by email code); kept for later.
    PASSWORD_LOGIN_ENABLED: bool = False
    # Pilot: only invited addresses (python -m app.cli invites add ...) and existing accounts log in.
    INVITE_ONLY: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # CV parsing (Celery worker + Claude API).
    REDIS_URL: str = "redis://localhost:6379/0"
    CLAUDE_MODEL: str = "claude-sonnet-5-5"
    # Model that writes field suggestions (house style). Changeable without code changes.
    SUGGESTION_MODEL: str = "claude-sonnet-5-5"
    # PDF download: where the backend's Chromium finds the frontend's print.html (defaults to
    # FRONTEND_URL; in Docker the frontend container, e.g. http://frontend:5173).
    PDF_TEMPLATE_URL: str = ""
    # Chromium to use instead of Playwright's own download (optional).
    PDF_CHROMIUM_PATH: str = ""
    # Claude API key. Use this name where ANTHROPIC_* variables are reserved by the host
    # (e.g. Claude Code cloud environments); if empty, the SDK falls back to ANTHROPIC_API_KEY.
    CVSMITH_CLAUDE_KEY: str = ""
    # Pinned so a host-level ANTHROPIC_BASE_URL (set by some tools for their own use) is not picked up.
    CLAUDE_API_BASE_URL: str = "https://api.anthropic.com"
    # Below this many characters of extracted text, a PDF is treated as scanned and sent to Claude as a file.
    MIN_EXTRACTED_TEXT_CHARS: int = 200
    # Refuse (rather than silently truncate) CVs whose text is longer than this.
    MAX_CV_TEXT_CHARS: int = 200_000

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() in ("development", "dev", "test")

    def validate_for_startup(self) -> None:
        """Refuse to run outside development with an insecure JWT secret."""
        if not self.is_development and (
            self.JWT_SECRET == DEFAULT_JWT_SECRET or len(self.JWT_SECRET) < 32
        ):
            raise RuntimeError(
                "JWT_SECRET must be set to a strong value (>= 32 chars) "
                "when ENVIRONMENT is not 'development'."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
