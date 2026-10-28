"""suggestion effectiveness and unmatched ATS terms (no user ids in the term store)

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-28
"""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("suggestions", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "unmatched_terms",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("term", sa.String(60), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("note", sa.String(255), nullable=True),
        sa.UniqueConstraint("kind", "term", name="uq_unmatched_kind_term"),
    )


def downgrade() -> None:
    op.drop_table("unmatched_terms")
    op.drop_column("suggestions", "edited_at")
