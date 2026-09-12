"""add_event_target_scope_and_co_hosts

Revision ID: i7c8d9e0f1g2
Revises: h6b7c8d9e0f1
Create Date: 2026-08-17 20:28:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'i7c8d9e0f1g2'
down_revision = 'h6b7c8d9e0f1'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c['name'] for c in inspector.get_columns('events')]
    if 'target_scope' not in columns:
        op.add_column(
            'events',
            sa.Column('target_scope', sa.String(50), nullable=False, server_default='department_only')
        )
    if 'co_host_dept_ids' not in columns:
        op.add_column(
            'events',
            sa.Column('co_host_dept_ids', sa.JSON(), nullable=True)
        )


def downgrade():
    op.drop_column('events', 'co_host_dept_ids')
    op.drop_column('events', 'target_scope')
