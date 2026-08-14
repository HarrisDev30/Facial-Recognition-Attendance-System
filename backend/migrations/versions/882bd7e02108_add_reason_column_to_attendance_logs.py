"""add reason column to attendance_logs

Revision ID: 882bd7e02108
Revises: f7a8b9c0d1e2
Create Date: 2026-07-02 23:21:16.954439

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '882bd7e02108'
down_revision: str | Sequence[str] | None = 'f7a8b9c0d1e2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('attendance_logs', sa.Column('reason', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('attendance_logs', 'reason')
