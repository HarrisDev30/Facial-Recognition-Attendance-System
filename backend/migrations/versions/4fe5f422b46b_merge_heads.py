"""merge_heads

Revision ID: 4fe5f422b46b
Revises: ea46d9c20d92, i7c8d9e0f1g2
Create Date: 2026-09-12 17:29:13.089813

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fe5f422b46b'
down_revision: Union[str, Sequence[str], None] = ('ea46d9c20d92', 'i7c8d9e0f1g2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
