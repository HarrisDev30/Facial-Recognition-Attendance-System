"""add_index_attendance_logs_attendee_verified

Revision ID: d2e3f4a5b6c7
Revises: c1e2f3a4b5c6
Create Date: 2026-07-03 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_attendance_logs_attendee_verified",
        "attendance_logs",
        ["attendee_id", "verified_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_attendance_logs_attendee_verified", table_name="attendance_logs")
