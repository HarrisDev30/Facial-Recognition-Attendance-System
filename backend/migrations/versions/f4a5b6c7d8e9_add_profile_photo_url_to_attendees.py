"""add_profile_photo_url_to_attendees

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-07-03 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f4a5b6c7d8e9"
down_revision: Union[str, None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attendees",
        sa.Column("profile_photo_url", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("attendees", "profile_photo_url")
