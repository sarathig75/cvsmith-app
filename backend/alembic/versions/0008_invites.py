"""invites: email addresses allowed to sign up while the site is invite-only

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-15
"""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invites",
        sa.Column("email", sa.String(255), primary_key=True),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("invites")
