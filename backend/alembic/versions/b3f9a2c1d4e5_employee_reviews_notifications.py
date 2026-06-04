"""employee notes, reminders, performance reviews, notifications

Revision ID: b3f9a2c1d4e5
Revises: 45080e5a4ebd
Create Date: 2026-06-03 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'b3f9a2c1d4e5'
down_revision: Union[str, Sequence[str], None] = '45080e5a4ebd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    result = op.get_bind().execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    )
    return result.fetchone() is not None


def _table_exists(table: str) -> bool:
    result = op.get_bind().execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :t"
        ),
        {"t": table},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # Employee columns — guard against pre-existing columns from raw SQL migrations
    for col_name, col_type in [
        ("notes", sqlmodel.sql.sqltypes.AutoString()),
        ("reminder_note", sqlmodel.sql.sqltypes.AutoString()),
        ("reminder_created_at", sqlmodel.sql.sqltypes.AutoString()),
    ]:
        if not _column_exists("employee", col_name):
            op.add_column("employee", sa.Column(col_name, col_type, nullable=True))

    if not _column_exists("employee", "reminder_active"):
        op.add_column(
            "employee",
            sa.Column("reminder_active", sa.Boolean(), nullable=False, server_default="false"),
        )

    # notification table — drop and recreate if schema is outdated (missing user_id)
    if _table_exists("notification"):
        if not _column_exists("notification", "user_id"):
            op.drop_index("ix_notification_org_id", table_name="notification")
            op.drop_table("notification")

    if not _table_exists("notification"):
        op.create_table(
            "notification",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("user_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("category", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("body", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("entity_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("entity_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False),
            sa.Column("created_at", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_notification_org_id"), "notification", ["org_id"], unique=False)
        op.create_index(op.f("ix_notification_user_id"), "notification", ["user_id"], unique=False)

    # performance_review table
    if not _table_exists("performance_review"):
        op.create_table(
            "performance_review",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("employee_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("period", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("self_evaluation", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("manager_feedback", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("rating", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("action_goals", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("next_review_date", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.ForeignKeyConstraint(["employee_id"], ["employee.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_performance_review_employee_id"), "performance_review", ["employee_id"], unique=False
        )
        op.create_index(
            op.f("ix_performance_review_org_id"), "performance_review", ["org_id"], unique=False
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_performance_review_org_id"), table_name="performance_review")
    op.drop_index(op.f("ix_performance_review_employee_id"), table_name="performance_review")
    op.drop_table("performance_review")
    op.drop_index(op.f("ix_notification_user_id"), table_name="notification")
    op.drop_index(op.f("ix_notification_org_id"), table_name="notification")
    op.drop_table("notification")
    op.drop_column("employee", "reminder_created_at")
    op.drop_column("employee", "reminder_active")
    op.drop_column("employee", "reminder_note")
    op.drop_column("employee", "notes")
