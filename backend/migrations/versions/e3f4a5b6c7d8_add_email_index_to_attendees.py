"""add_email_index_to_attendees

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-07-03 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_attendees_email", "attendees", ["email"])


def downgrade() -> None:
    op.drop_index("ix_attendees_email", table_name="attendees")
