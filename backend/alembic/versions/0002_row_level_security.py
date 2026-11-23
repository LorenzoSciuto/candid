"""row_level_security

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-15 00:00:00.000000

Row-Level Security for every tenant table (see candid/commons/tenancy.py):

* Creates the unprivileged ``candid_app`` role. The application switches to it
  with ``SET LOCAL ROLE`` at the start of every transaction, so policies apply
  even when the connection user owns the tables or is a superuser.
* Adds one ``tenant_isolation`` policy per tenant table. The policy also
  honours an explicit ``app.rls_bypass`` flag used by public/system endpoints.
* ``user``, ``organization`` and ``membership`` are identity tables queried
  across organisations at login, so they are not tenant-scoped.

No-op on SQLite (tests).
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

APP_ROLE = "candid_app"

_TENANT_TABLES = [
    "invitation", "org_config", "org_api_key", "candidate", "interview", "evaluation",
    "role", "job_description", "employee", "notification", "email_log",
    "performance_review", "video_interview",
]
_BYPASS = "current_setting('app.rls_bypass', true) = 'on'"
_SAME_ORG = f"(org_id = current_setting('app.current_org_id', true) OR {_BYPASS})"
# video_response has no org_id: visible only through a video_interview the caller can see.
# Constant SQL built from module constants only (no user input).
_VIDEO_RESPONSE = (
    f"({_BYPASS} OR EXISTS (SELECT 1 FROM video_interview vi"  # noqa: S608
    " WHERE vi.id = video_response.video_interview_id))"
)


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return
    op.execute(
        f"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{APP_ROLE}')"
        f" THEN CREATE ROLE {APP_ROLE} NOLOGIN; END IF; END $$"
    )
    # The migrating user must be able to SET ROLE to it (implicit for superusers).
    op.execute(f"GRANT {APP_ROLE} TO CURRENT_USER")
    op.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}")
    op.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}")
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public"
        f" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {APP_ROLE}"
    )
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {APP_ROLE}")

    for table, condition in [(t, _SAME_ORG) for t in _TENANT_TABLES] + [("video_response", _VIDEO_RESPONSE)]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY tenant_isolation ON {table} USING {condition} WITH CHECK {condition}")


def downgrade() -> None:
    if not _is_postgres():
        return
    for table in _TENANT_TABLES + ["video_response"]:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {APP_ROLE}")
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {APP_ROLE}")
    op.execute(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {APP_ROLE}")
    op.execute(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {APP_ROLE}")
    op.execute(f"REVOKE USAGE ON SCHEMA public FROM {APP_ROLE}")
