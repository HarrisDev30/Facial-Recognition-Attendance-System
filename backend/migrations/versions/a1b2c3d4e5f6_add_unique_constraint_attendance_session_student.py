"""add_unique_constraint_attendance_session_student

Revision ID: a1b2c3d4e5f6
Revises: 9a4d549a8bd9
Create Date: 2026-07-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9a4d549a8bd9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_attendance_session_student",
        "attendance_logs",
        ["session_id", "student_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_attendance_session_student", "attendance_logs", type_="unique")
