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
    JWT_EXPIRATION_HOURS: int = 24
    VERIFICATION_TOKEN_EXPIRATION_HOURS: int = 24

    GOOGLE_OAUTH_CLIENT_ID: str = ""

    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "noreply@cvsmith.com"
    FRONTEND_URL: str = "http://localhost:5173"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

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
