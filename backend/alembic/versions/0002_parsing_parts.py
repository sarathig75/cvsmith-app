"""add cvs.parsing_parts (per-part parsing status)

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-13
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _parts(status: str) -> str:
    return '{"basics": "%s", "experience": "%s", "extras": "%s"}' % (status, status, status)


def upgrade() -> None:
    op.add_column(
        "cvs",
        sa.Column("parsing_parts", sa.JSON(), nullable=False, server_default=sa.text(f"'{_parts('pending')}'")),
    )
    # Existing CVs were parsed in one go: their parts share the overall result.
    for status in ("complete", "failed"):
        op.execute(
            sa.text("UPDATE cvs SET parsing_parts = :parts WHERE parsing_status = :status").bindparams(
                parts=_parts(status), status=status
            )
        )


def downgrade() -> None:
    op.drop_column("cvs", "parsing_parts")
