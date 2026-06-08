"""create_video_interview_tables

Revision ID: a1b2c3d4e5f6
Revises: 45080e5a4ebd
Create Date: 2026-06-05 00:00:00.000000

Creates video_interview and video_response tables required by the RLS migration.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "45080e5a4ebd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "video_interview",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("candidate_id", sa.String(), nullable=False),
        sa.Column("invite_token", sa.String(), nullable=False),
        sa.Column("questions", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("expires_at", sa.String(), nullable=False),
        sa.Column("started_at", sa.String(), nullable=True),
        sa.Column("completed_at", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_video_interview_org_id", "video_interview", ["org_id"])
    op.create_index("ix_video_interview_candidate_id", "video_interview", ["candidate_id"])
    op.create_index("ix_video_interview_invite_token", "video_interview", ["invite_token"], unique=True)

    op.create_table(
        "video_response",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("video_interview_id", sa.String(), nullable=False),
        sa.Column("question_index", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="recording"),
        sa.Column("total_chunks", sa.Integer(), nullable=True),
        sa.Column("received_chunks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("completed_at", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_video_response_video_interview_id", "video_response", ["video_interview_id"])


def downgrade() -> None:
    op.drop_index("ix_video_response_video_interview_id", table_name="video_response")
    op.drop_table("video_response")
    op.drop_index("ix_video_interview_invite_token", table_name="video_interview")
    op.drop_index("ix_video_interview_candidate_id", table_name="video_interview")
    op.drop_index("ix_video_interview_org_id", table_name="video_interview")
    op.drop_table("video_interview")
