"""enable_rls

Revision ID: 20260603_enable_rls
Revises: 45080e5a4ebd
Create Date: 2026-06-03 00:00:00.000000

Adds PostgreSQL Row-Level Security (RLS) to all tenant-scoped tables.
Each table receives a permissive policy that restricts reads and writes
to rows whose org_id matches the session variable app.current_org_id.
This migration is a no-op on SQLite (used in tests).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260603_enable_rls"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TENANT_TABLES = [
    "membership",
    "invitation",
    "org_config",
    "org_api_key",
    "candidate",
    "interview",
    "evaluation",
    "role",
    "job_description",
    "employee",
    "video_interview",
]


def _enable_rls_on_table(table_name: str) -> None:
    op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY")
    _create_select_policy(table_name)
    _create_insert_policy(table_name)
    _create_update_policy(table_name)
    _create_delete_policy(table_name)


def _create_select_policy(table_name: str) -> None:
    op.execute(
        f"CREATE POLICY org_isolation_select ON {table_name}"
        " FOR SELECT"
        " USING (org_id = current_setting('app.current_org_id', true))"
    )


def _create_insert_policy(table_name: str) -> None:
    op.execute(
        f"CREATE POLICY org_isolation_insert ON {table_name}"
        " FOR INSERT"
        " WITH CHECK (org_id = current_setting('app.current_org_id', true))"
    )


def _create_update_policy(table_name: str) -> None:
    op.execute(
        f"CREATE POLICY org_isolation_update ON {table_name}"
        " FOR UPDATE"
        " USING (org_id = current_setting('app.current_org_id', true))"
        " WITH CHECK (org_id = current_setting('app.current_org_id', true))"
    )


def _create_delete_policy(table_name: str) -> None:
    op.execute(
        f"CREATE POLICY org_isolation_delete ON {table_name}"
        " FOR DELETE"
        " USING (org_id = current_setting('app.current_org_id', true))"
    )


def _disable_rls_on_table(table_name: str) -> None:
    op.execute(f"DROP POLICY IF EXISTS org_isolation_select ON {table_name}")
    op.execute(f"DROP POLICY IF EXISTS org_isolation_insert ON {table_name}")
    op.execute(f"DROP POLICY IF EXISTS org_isolation_update ON {table_name}")
    op.execute(f"DROP POLICY IF EXISTS org_isolation_delete ON {table_name}")
    op.execute(f"ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY")


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return
    for table_name in _TENANT_TABLES:
        _enable_rls_on_table(table_name)


def downgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return
    for table_name in _TENANT_TABLES:
        _disable_rls_on_table(table_name)
