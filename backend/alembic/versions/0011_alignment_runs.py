"""job alignment runs (requirements and result; never the job spec text)

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-29
"""
import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alignment_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cv_id", sa.Uuid(), sa.ForeignKey("cvs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requirements", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_alignment_runs_user_created", "alignment_runs", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_alignment_runs_user_created", table_name="alignment_runs")
    op.drop_table("alignment_runs")
