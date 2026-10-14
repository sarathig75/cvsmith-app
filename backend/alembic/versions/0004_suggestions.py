"""users.plan and the suggestions table (Week 7-8 field suggestions)

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-14
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch mode recreates the table on SQLite, which cannot add a CHECK constraint in place.
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("plan", sa.String(20), nullable=False, server_default="free"))
        batch.create_check_constraint("ck_users_plan", "plan IN ('free', 'pro')")

    op.create_table(
        "suggestions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cv_id", sa.Uuid(), sa.ForeignKey("cvs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("field", sa.String(20), nullable=False),
        sa.Column("entry_id", sa.String(64), nullable=True),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("suggested_text", sa.Text(), nullable=False),
        sa.Column("changed", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("field IN ('summary', 'experience', 'projects')", name="ck_suggestions_field"),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'unchanged')", name="ck_suggestions_status"
        ),
    )
    op.create_index("ix_suggestions_user_created", "suggestions", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("suggestions")
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("ck_users_plan", type_="check")
        batch.drop_column("plan")
