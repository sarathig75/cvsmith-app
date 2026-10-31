"""ATS before-score and generated-PDF layout facts on the CV

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-29
"""
import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cvs", sa.Column("ats_before", sa.JSON(), nullable=True))
    op.add_column("cvs", sa.Column("ats_layout_after", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("cvs", "ats_layout_after")
    op.drop_column("cvs", "ats_before")
