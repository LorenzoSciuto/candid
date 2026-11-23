"""initial_schema

Revision ID: 0001
Revises:
Create Date: 2026-11-15 00:00:00.000000

Full schema for the first public release, generated from candid/commons/models.py.
"""
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel  # noqa: F401  (autogenerate emits sqlmodel column types)

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('email_log',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('direction', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('to_email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('from_email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('subject', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('body', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('email_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('candidate_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('sent_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_log_candidate_id'), 'email_log', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_email_log_org_id'), 'email_log', ['org_id'], unique=False)
    op.create_table('invitation',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('token', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('role', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('invited_by', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('expires_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('accepted_at', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invitation_email'), 'invitation', ['email'], unique=False)
    op.create_index(op.f('ix_invitation_org_id'), 'invitation', ['org_id'], unique=False)
    op.create_index(op.f('ix_invitation_token'), 'invitation', ['token'], unique=True)
    op.create_table('membership',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('role', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('joined_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_membership_org_id'), 'membership', ['org_id'], unique=False)
    op.create_index(op.f('ix_membership_user_id'), 'membership', ['user_id'], unique=False)
    op.create_table('notification',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('body', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('entity_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('entity_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notification_org_id'), 'notification', ['org_id'], unique=False)
    op.create_index(op.f('ix_notification_user_id'), 'notification', ['user_id'], unique=False)
    op.create_table('org_api_key',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('provider', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('encrypted_key', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_org_api_key_org_id'), 'org_api_key', ['org_id'], unique=False)
    op.create_index(op.f('ix_org_api_key_provider'), 'org_api_key', ['provider'], unique=False)
    op.create_table('org_config',
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('provider', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('model_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('stages_json', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('smtp_host', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('smtp_port', sa.Integer(), nullable=False),
    sa.Column('smtp_user', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('smtp_password_encrypted', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('smtp_from', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('date_format', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('locations_json', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.PrimaryKeyConstraint('org_id')
    )
    op.create_table('organization',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('slug', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('owner_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('branding_config', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organization_slug'), 'organization', ['slug'], unique=True)
    op.create_table('role',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('department', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('headcount', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_role_org_id'), 'role', ['org_id'], unique=False)
    op.create_table('user',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('picture', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('department', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)
    op.create_table('video_interview',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('candidate_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('invite_token', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('questions', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('expires_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('started_at', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('completed_at', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_video_interview_candidate_id'), 'video_interview', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_video_interview_invite_token'), 'video_interview', ['invite_token'], unique=True)
    op.create_index(op.f('ix_video_interview_org_id'), 'video_interview', ['org_id'], unique=False)
    op.create_table('video_response',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('video_interview_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('question_index', sa.Integer(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('total_chunks', sa.Integer(), nullable=True),
    sa.Column('received_chunks', sa.Integer(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('completed_at', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_video_response_video_interview_id'), 'video_response', ['video_interview_id'], unique=False)
    op.create_table('employee',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('first_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('last_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('role_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('role_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('department', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('salary', sa.Float(), nullable=True),
    sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('hire_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('location', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('manager', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('candidate_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('reminder_note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('reminder_active', sa.Boolean(), nullable=False),
    sa.Column('reminder_created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['role_id'], ['role.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_employee_org_id'), 'employee', ['org_id'], unique=False)
    op.create_index(op.f('ix_employee_role_id'), 'employee', ['role_id'], unique=False)
    op.create_table('job_description',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('role_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('requirements', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('location', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('openings', sa.Integer(), nullable=False),
    sa.Column('owner', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('salary_min', sa.Integer(), nullable=True),
    sa.Column('salary_max', sa.Integer(), nullable=True),
    sa.Column('salary_currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['role.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_description_org_id'), 'job_description', ['org_id'], unique=False)
    op.create_index(op.f('ix_job_description_role_id'), 'job_description', ['role_id'], unique=False)
    op.create_table('candidate',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('first_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('last_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('phone', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('current_role', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('years_of_experience', sa.Integer(), nullable=True),
    sa.Column('location', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('source', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('applied_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('score', sa.Float(), nullable=True),
    sa.Column('cv_text', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('cv_filename', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('job_title', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('ai_pre_analysis', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('career_history', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('status_history', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('analysis_at', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('activity_log', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('cv_file', sa.LargeBinary(), nullable=True),
    sa.Column('job_description_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['job_description_id'], ['job_description.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_candidate_job_description_id'), 'candidate', ['job_description_id'], unique=False)
    op.create_index(op.f('ix_candidate_org_id'), 'candidate', ['org_id'], unique=False)
    op.create_table('performance_review',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('employee_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('period', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('self_evaluation', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('manager_feedback', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('rating', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('action_goals', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('next_review_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.ForeignKeyConstraint(['employee_id'], ['employee.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_performance_review_employee_id'), 'performance_review', ['employee_id'], unique=False)
    op.create_index(op.f('ix_performance_review_org_id'), 'performance_review', ['org_id'], unique=False)
    op.create_table('evaluation',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('candidate_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('human_skills', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('technical_skills', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('final_recommendation', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('updated_at', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['candidate_id'], ['candidate.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_evaluation_candidate_id'), 'evaluation', ['candidate_id'], unique=True)
    op.create_index(op.f('ix_evaluation_org_id'), 'evaluation', ['org_id'], unique=False)
    op.create_table('interview',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('org_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('candidate_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('interviewer', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('time', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('duration', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('raw_content', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('cleaned_transcript', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('ai_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('extra_info', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('audio_file_path', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('transcript_raw', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('transcript_status', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('transcript_language', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('ai_evaluation', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['candidate_id'], ['candidate.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_interview_candidate_id'), 'interview', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_interview_org_id'), 'interview', ['org_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_interview_org_id'), table_name='interview')
    op.drop_index(op.f('ix_interview_candidate_id'), table_name='interview')
    op.drop_table('interview')
    op.drop_index(op.f('ix_evaluation_org_id'), table_name='evaluation')
    op.drop_index(op.f('ix_evaluation_candidate_id'), table_name='evaluation')
    op.drop_table('evaluation')
    op.drop_index(op.f('ix_performance_review_org_id'), table_name='performance_review')
    op.drop_index(op.f('ix_performance_review_employee_id'), table_name='performance_review')
    op.drop_table('performance_review')
    op.drop_index(op.f('ix_candidate_org_id'), table_name='candidate')
    op.drop_index(op.f('ix_candidate_job_description_id'), table_name='candidate')
    op.drop_table('candidate')
    op.drop_index(op.f('ix_job_description_role_id'), table_name='job_description')
    op.drop_index(op.f('ix_job_description_org_id'), table_name='job_description')
    op.drop_table('job_description')
    op.drop_index(op.f('ix_employee_role_id'), table_name='employee')
    op.drop_index(op.f('ix_employee_org_id'), table_name='employee')
    op.drop_table('employee')
    op.drop_index(op.f('ix_video_response_video_interview_id'), table_name='video_response')
    op.drop_table('video_response')
    op.drop_index(op.f('ix_video_interview_org_id'), table_name='video_interview')
    op.drop_index(op.f('ix_video_interview_invite_token'), table_name='video_interview')
    op.drop_index(op.f('ix_video_interview_candidate_id'), table_name='video_interview')
    op.drop_table('video_interview')
    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_table('user')
    op.drop_index(op.f('ix_role_org_id'), table_name='role')
    op.drop_table('role')
    op.drop_index(op.f('ix_organization_slug'), table_name='organization')
    op.drop_table('organization')
    op.drop_table('org_config')
    op.drop_index(op.f('ix_org_api_key_provider'), table_name='org_api_key')
    op.drop_index(op.f('ix_org_api_key_org_id'), table_name='org_api_key')
    op.drop_table('org_api_key')
    op.drop_index(op.f('ix_notification_user_id'), table_name='notification')
    op.drop_index(op.f('ix_notification_org_id'), table_name='notification')
    op.drop_table('notification')
    op.drop_index(op.f('ix_membership_user_id'), table_name='membership')
    op.drop_index(op.f('ix_membership_org_id'), table_name='membership')
    op.drop_table('membership')
    op.drop_index(op.f('ix_invitation_token'), table_name='invitation')
    op.drop_index(op.f('ix_invitation_org_id'), table_name='invitation')
    op.drop_index(op.f('ix_invitation_email'), table_name='invitation')
    op.drop_table('invitation')
    op.drop_index(op.f('ix_email_log_org_id'), table_name='email_log')
    op.drop_index(op.f('ix_email_log_candidate_id'), table_name='email_log')
    op.drop_table('email_log')
