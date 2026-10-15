"""suggestions for the headline field

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-15
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

FIELDS_NEW = "field IN ('summary', 'experience', 'projects', 'headline')"
FIELDS_OLD = "field IN ('summary', 'experience', 'projects')"


def upgrade() -> None:
    # batch mode recreates the table on SQLite, which cannot alter a CHECK constraint in place.
    with op.batch_alter_table("suggestions") as batch:
        batch.drop_constraint("ck_suggestions_field", type_="check")
        batch.create_check_constraint("ck_suggestions_field", FIELDS_NEW)


def downgrade() -> None:
    op.execute("DELETE FROM suggestions WHERE field = 'headline'")
    with op.batch_alter_table("suggestions") as batch:
        batch.drop_constraint("ck_suggestions_field", type_="check")
        batch.create_check_constraint("ck_suggestions_field", FIELDS_OLD)
