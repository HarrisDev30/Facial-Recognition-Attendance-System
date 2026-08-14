"""add_unique_constraint_attendance_log

Revision ID: c1e2f3a4b5c6
Revises: 882bd7e02108
Create Date: 2026-07-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "c1e2f3a4b5c6"
down_revision: Union[str, None] = "882bd7e02108"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DELETE FROM attendance_logs
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY session_id, attendee_id
                           ORDER BY verified_at ASC
                       ) AS rn
                FROM attendance_logs
            ) AS ranked
            WHERE rn > 1
        )
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_attendance_session_student'
            ) THEN
                ALTER TABLE attendance_logs
                DROP CONSTRAINT uq_attendance_session_student;
            END IF;
        END $$;
    """)

    op.create_unique_constraint(
        "uq_attendance_log_session_attendee",
        "attendance_logs",
        ["session_id", "attendee_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_attendance_log_session_attendee",
        "attendance_logs",
        type_="unique",
    )
