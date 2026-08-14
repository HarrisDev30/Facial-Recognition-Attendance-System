"""add_email_fields_student_consent_removal

Revision ID: b59a89804467
Revises: 3168b66c528a
Create Date: 2026-06-05 05:55:09.736310

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b59a89804467'
down_revision: str | Sequence[str] | None = '3168b66c528a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('data_removal_requests',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('request_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=False),
    sa.Column('completed_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('student_consent',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('consent_given', sa.Boolean(), nullable=False),
    sa.Column('acknowledge_data_privacy', sa.Boolean(), nullable=False),
    sa.Column('consent_version', sa.String(length=20), nullable=False),
    sa.Column('consent_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    op.add_column('users', sa.Column('email', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('first_name', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('student_id', sa.String(length=50), nullable=True))

    op.execute("UPDATE users SET email = username WHERE email IS NULL")

    op.alter_column('users', 'email', nullable=False)
    op.alter_column('users', 'username', existing_type=sa.VARCHAR(length=100), nullable=True)
    op.create_unique_constraint(None, 'users', ['email'])
    op.create_unique_constraint(None, 'users', ['student_id'])


def downgrade() -> None:
    op.drop_constraint(None, 'users', type_='unique')
    op.drop_constraint(None, 'users', type_='unique')
    op.alter_column('users', 'username', existing_type=sa.VARCHAR(length=100), nullable=False)
    op.drop_column('users', 'student_id')
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
    op.drop_column('users', 'email')
    op.drop_table('student_consent')
    op.drop_table('data_removal_requests')
