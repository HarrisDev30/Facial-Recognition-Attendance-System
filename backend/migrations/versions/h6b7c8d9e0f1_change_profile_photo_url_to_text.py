"""change_profile_photo_url_to_text

Revision ID: h6b7c8d9e0f1
Revises: g5a6b7c8d9e0
Create Date: 2026-08-17 18:52:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'h6b7c8d9e0f1'
down_revision = 'g5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'attendees',
        'profile_photo_url',
        existing_type=sa.String(512),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        'attendees',
        'profile_photo_url',
        existing_type=sa.Text(),
        type_=sa.String(512),
        existing_nullable=True,
    )
