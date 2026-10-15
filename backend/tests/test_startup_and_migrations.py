import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.config import DEFAULT_JWT_SECRET, Settings


def test_refuses_default_secret_outside_development():
    # Pass the default explicitly: conftest sets a strong JWT_SECRET in the environment.
    s = Settings(ENVIRONMENT="production", JWT_SECRET=DEFAULT_JWT_SECRET, _env_file=None)
    with pytest.raises(RuntimeError):
        s.validate_for_startup()
    with pytest.raises(RuntimeError):
        Settings(ENVIRONMENT="production", JWT_SECRET="short", _env_file=None).validate_for_startup()


def test_accepts_strong_secret_in_production_and_default_in_development():
    Settings(ENVIRONMENT="production", JWT_SECRET="x" * 40, _env_file=None).validate_for_startup()
    Settings(ENVIRONMENT="development", _env_file=None).validate_for_startup()


def test_alembic_migration_creates_schema(tmp_path):
    url = f"sqlite:///{tmp_path / 'mig.db'}"
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    insp = inspect(create_engine(url))
    assert {"users", "cvs", "events", "suggestions", "login_codes"} <= set(insp.get_table_names())
    cols = {c["name"] for c in insp.get_columns("users")}
    assert {"id", "email", "password_hash", "email_verified", "google_id", "plan"} <= cols
    command.downgrade(cfg, "base")
