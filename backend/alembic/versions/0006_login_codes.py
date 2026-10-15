"""login_codes: one-time email login codes

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-15
"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_codes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_login_codes_email_created", "login_codes", ["email", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_login_codes_email_created", table_name="login_codes")
    op.drop_table("login_codes")
