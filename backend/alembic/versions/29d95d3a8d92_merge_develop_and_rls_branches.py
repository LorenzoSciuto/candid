"""merge_develop_and_rls_branches

Revision ID: 29d95d3a8d92
Revises: 02adfdd6dd28, 20260603_enable_rls
Create Date: 2026-06-05 14:19:20.160040

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29d95d3a8d92'
down_revision: Union[str, Sequence[str], None] = ('02adfdd6dd28', '20260603_enable_rls')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
