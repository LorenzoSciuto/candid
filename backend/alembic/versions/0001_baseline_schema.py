"""Baseline schema — full initial schema for Candid.

Squashed from previous incremental migrations. Safe to run on a fresh DB
or an already-migrated DB (all ops use checkfirst / IF NOT EXISTS semantics).

Revision ID: 0001
Revises:
Create Date: 2026-06-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    result = op.get_bind().execute(
        sa.text("SELECT 1 FROM information_schema.tables WHERE table_name = :t"),
        {"t": table},
    )
    return result.fetchone() is not None


def _column_exists(table: str, column: str) -> bool:
    result = op.get_bind().execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    if not _table_exists("user"):
        op.create_table(
            "user",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("picture", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("department", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)

    if not _table_exists("organization"):
        op.create_table(
            "organization",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("slug", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("owner_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("created_at", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("branding_config", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_organization_slug"), "organization", ["slug"], unique=True)

    if not _table_exists("membership"):
        op.create_table(
            "membership",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("user_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("role", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("joined_at", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_membership_org_id"), "membership", ["org_id"], unique=False)
        op.create_index(op.f("ix_membership_user_id"), "membership", ["user_id"], unique=False)

    if not _table_exists("invitation"):
        op.create_table(
            "invitation",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("token", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("role", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("invited_by", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("created_at", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("expires_at", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("accepted_at", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_invitation_email"), "invitation", ["email"], unique=False)
        op.create_index(op.f("ix_invitation_org_id"), "invitation", ["org_id"], unique=False)
        op.create_index(op.f("ix_invitation_token"), "invitation", ["token"], unique=True)

    if not _table_exists("org_config"):
        op.create_table(
            "org_config",
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("provider", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("model_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("stages_json", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.PrimaryKeyConstraint("org_id"),
        )

    if not _table_exists("org_api_key"):
        op.create_table(
            "org_api_key",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("provider", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("encrypted_key", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_org_api_key_org_id"), "org_api_key", ["org_id"], unique=False)
        op.create_index(op.f("ix_org_api_key_provider"), "org_api_key", ["provider"], unique=False)

    if not _table_exists("role"):
        op.create_table(
            "role",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("department", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("headcount", sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_role_org_id"), "role", ["org_id"], unique=False)

    if not _table_exists("job_description"):
        op.create_table(
            "job_description",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("role_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("requirements", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("location", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("remote_ok", sa.Boolean(), nullable=False),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("openings", sa.Integer(), nullable=False),
            sa.Column("owner", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.ForeignKeyConstraint(["role_id"], ["role.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_job_description_org_id"), "job_description", ["org_id"], unique=False)
        op.create_index(op.f("ix_job_description_role_id"), "job_description", ["role_id"], unique=False)

    if not _table_exists("candidate"):
        op.create_table(
            "candidate",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("first_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("last_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("phone", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("current_role", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("years_of_experience", sa.Integer(), nullable=True),
            sa.Column("location", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("source", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("applied_at", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("score", sa.Float(), nullable=True),
            sa.Column("cv_text", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("cv_filename", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("job_title", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("job_description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("ai_pre_analysis", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("career_history", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("status_history", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("extra_information", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("analysis_at", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("activity_log", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("cv_file", sa.LargeBinary(), nullable=True),
            sa.Column("otp_hash", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("otp_expires_at", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_candidate_org_id"), "candidate", ["org_id"], unique=False)

    if not _table_exists("interview"):
        op.create_table(
            "interview",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("candidate_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("interviewer", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("date", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("duration", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("raw_content", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("cleaned_transcript", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("ai_summary", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("extra_info", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("audio_file_path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("transcript_raw", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("transcript_status", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("transcript_language", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("ai_evaluation", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.ForeignKeyConstraint(["candidate_id"], ["candidate.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_interview_candidate_id"), "interview", ["candidate_id"], unique=False)
        op.create_index(op.f("ix_interview_org_id"), "interview", ["org_id"], unique=False)

    if not _table_exists("evaluation"):
        op.create_table(
            "evaluation",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("candidate_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("human_skills", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("technical_skills", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("final_recommendation", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("updated_at", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.ForeignKeyConstraint(["candidate_id"], ["candidate.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_evaluation_candidate_id"), "evaluation", ["candidate_id"], unique=True)
        op.create_index(op.f("ix_evaluation_org_id"), "evaluation", ["org_id"], unique=False)

    if not _table_exists("employee"):
        op.create_table(
            "employee",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("org_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("first_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("last_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("role_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("role_name", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("department", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("salary", sa.Float(), nullable=True),
            sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("hire_date", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("location", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("manager", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("candidate_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("reminder_note", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("reminder_active", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("reminder_created_at", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.ForeignKeyConstraint(["role_id"], ["role.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_employee_org_id"), "employee", ["org_id"], unique=False)
        op.create_index(op.f("ix_employee_role_id"), "employee", ["role_id"], unique=False)

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
    op.drop_index(op.f("ix_employee_role_id"), table_name="employee")
    op.drop_index(op.f("ix_employee_org_id"), table_name="employee")
    op.drop_table("employee")
    op.drop_index(op.f("ix_evaluation_org_id"), table_name="evaluation")
    op.drop_index(op.f("ix_evaluation_candidate_id"), table_name="evaluation")
    op.drop_table("evaluation")
    op.drop_index(op.f("ix_interview_org_id"), table_name="interview")
    op.drop_index(op.f("ix_interview_candidate_id"), table_name="interview")
    op.drop_table("interview")
    op.drop_index(op.f("ix_candidate_org_id"), table_name="candidate")
    op.drop_table("candidate")
    op.drop_index(op.f("ix_job_description_role_id"), table_name="job_description")
    op.drop_index(op.f("ix_job_description_org_id"), table_name="job_description")
    op.drop_table("job_description")
    op.drop_index(op.f("ix_role_org_id"), table_name="role")
    op.drop_table("role")
    op.drop_index(op.f("ix_org_api_key_provider"), table_name="org_api_key")
    op.drop_index(op.f("ix_org_api_key_org_id"), table_name="org_api_key")
    op.drop_table("org_api_key")
    op.drop_table("org_config")
    op.drop_index(op.f("ix_invitation_token"), table_name="invitation")
    op.drop_index(op.f("ix_invitation_org_id"), table_name="invitation")
    op.drop_index(op.f("ix_invitation_email"), table_name="invitation")
    op.drop_table("invitation")
    op.drop_index(op.f("ix_membership_user_id"), table_name="membership")
    op.drop_index(op.f("ix_membership_org_id"), table_name="membership")
    op.drop_table("membership")
    op.drop_index(op.f("ix_organization_slug"), table_name="organization")
    op.drop_table("organization")
    op.drop_index(op.f("ix_user_email"), table_name="user")
    op.drop_table("user")
