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


def upgrade() -> None:
    # New columns on employee
    op.add_column('employee', sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('employee', sa.Column('reminder_note', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('employee', sa.Column('reminder_active', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('employee', sa.Column('reminder_created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=True))

    # notification table
    op.create_table(
        'notification',
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
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notification_org_id'), 'notification', ['org_id'], unique=False)
    op.create_index(op.f('ix_notification_user_id'), 'notification', ['user_id'], unique=False)

    # performance_review table
    op.create_table(
        'performance_review',
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
        sa.ForeignKeyConstraint(['employee_id'], ['employee.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_performance_review_employee_id'), 'performance_review', ['employee_id'], unique=False)
    op.create_index(op.f('ix_performance_review_org_id'), 'performance_review', ['org_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_performance_review_org_id'), table_name='performance_review')
    op.drop_index(op.f('ix_performance_review_employee_id'), table_name='performance_review')
    op.drop_table('performance_review')
    op.drop_index(op.f('ix_notification_user_id'), table_name='notification')
    op.drop_index(op.f('ix_notification_org_id'), table_name='notification')
    op.drop_table('notification')
    op.drop_column('employee', 'reminder_created_at')
    op.drop_column('employee', 'reminder_active')
    op.drop_column('employee', 'reminder_note')
    op.drop_column('employee', 'notes')
