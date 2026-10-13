"""saved canvas content on cvs, "not_uploaded" status, funnel events table

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-13
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

ONCE = sa.text("event_type IN ('email_verified', 'first_edit')")


def upgrade() -> None:
    # batch mode recreates the table on SQLite, which cannot alter a CHECK constraint in place.
    with op.batch_alter_table("cvs") as batch:
        batch.add_column(sa.Column("content", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("applied_parts", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
        batch.add_column(sa.Column("content_updated_at", sa.DateTime(timezone=True), nullable=True))
        batch.drop_constraint("ck_cvs_parsing_status", type_="check")
        batch.create_check_constraint(
            "ck_cvs_parsing_status",
            "parsing_status IN ('not_uploaded', 'pending', 'in_progress', 'complete', 'failed')",
        )

    op.create_table(
        "events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_events_user_id", "events", ["user_id"])
    op.create_index("ix_events_created_at", "events", ["created_at"])
    op.create_index(
        "uq_events_once_per_user", "events", ["user_id", "event_type"], unique=True,
        sqlite_where=ONCE, postgresql_where=ONCE,
    )


def downgrade() -> None:
    op.drop_table("events")
    op.execute("UPDATE cvs SET parsing_status = 'complete' WHERE parsing_status = 'not_uploaded'")
    with op.batch_alter_table("cvs") as batch:
        batch.drop_constraint("ck_cvs_parsing_status", type_="check")
        batch.create_check_constraint(
            "ck_cvs_parsing_status", "parsing_status IN ('pending', 'in_progress', 'complete', 'failed')"
        )
        batch.drop_column("content_updated_at")
        batch.drop_column("applied_parts")
        batch.drop_column("content")
