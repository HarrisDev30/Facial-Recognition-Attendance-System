"""attendee_refactor_departments

Revision ID: f7a8b9c0d1e2
Revises: a1b2c3d4e5f6
Create Date: 2026-07-01 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    attendee_type_enum = sa.Enum('student', 'staff', name='attendee_type', create_constraint=True)
    attendee_type_enum.create(conn, checkfirst=True)

    op.create_table('departments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )

    departments_data = [
        ('College of Computing and Information Sciences', 'CCIS'),
        ('College of Education, Arts and Sciences', 'CEDAS'),
        ('College of Health Sciences', 'CHS'),
        ('College of Engineering', 'COE'),
        ('College of Accountancy, Business and Entrepreneurship', 'CABE'),
    ]
    for name, code in departments_data:
        op.execute(
            sa.text(
                "INSERT INTO departments (id, name, code) "
                "VALUES (gen_random_uuid(), :name, :code)"
            ).bindparams(name=name, code=code)
        )

    default_dept_id = conn.execute(
        sa.text("SELECT id FROM departments WHERE code = 'CCIS' LIMIT 1")
    ).scalar()

    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff'")

    op.drop_constraint('students_user_id_fkey', 'students', type_='foreignkey')

    op.alter_column('students', 'student_id', new_column_name='identifier')

    op.drop_constraint('students_student_id_key', 'students', type_='unique')
    op.create_unique_constraint('attendees_identifier_key', 'students', ['identifier'])

    op.add_column('students',
        sa.Column('attendee_type',
                  sa.Enum('student', 'staff', name='attendee_type', create_constraint=True),
                  nullable=False, server_default='student'),
    )

    op.add_column('students',
        sa.Column('department_id', sa.UUID(), nullable=True),
    )

    op.execute(
        sa.text("UPDATE students SET department_id = :dept_id").bindparams(dept_id=default_dept_id)
    )

    op.alter_column('students', 'department_id', nullable=False)

    op.rename_table('students', 'attendees')

    op.create_foreign_key(
        'attendees_user_id_fkey',
        'attendees', 'users',
        ['user_id'], ['id'],
    )

    op.create_foreign_key(
        'attendees_department_id_fkey',
        'attendees', 'departments',
        ['department_id'], ['id'],
    )

    op.drop_constraint('uq_attendance_session_student', 'attendance_logs', type_='unique')
    op.drop_constraint('attendance_logs_student_id_fkey', 'attendance_logs', type_='foreignkey')
    op.alter_column('attendance_logs', 'student_id', new_column_name='attendee_id')
    op.create_foreign_key(
        'attendance_logs_attendee_id_fkey',
        'attendance_logs', 'attendees',
        ['attendee_id'], ['id'],
    )
    op.create_unique_constraint(
        'uq_attendance_session_attendee',
        'attendance_logs',
        ['session_id', 'attendee_id'],
    )

    op.drop_constraint('student_embeddings_student_id_fkey', 'student_embeddings', type_='foreignkey')
    op.alter_column('student_embeddings', 'student_id', new_column_name='attendee_id')
    op.rename_table('student_embeddings', 'embeddings')
    op.create_foreign_key(
        'embeddings_attendee_id_fkey',
        'embeddings', 'attendees',
        ['attendee_id'], ['id'],
    )

    op.drop_constraint('student_consent_student_id_fkey', 'student_consent', type_='foreignkey')
    op.alter_column('student_consent', 'student_id', new_column_name='attendee_id')
    op.rename_table('student_consent', 'consent')
    op.create_foreign_key(
        'consent_attendee_id_fkey',
        'consent', 'attendees',
        ['attendee_id'], ['id'],
    )

    op.drop_constraint('data_removal_requests_student_id_fkey', 'data_removal_requests', type_='foreignkey')
    op.alter_column('data_removal_requests', 'student_id', new_column_name='attendee_id')
    op.create_foreign_key(
        'data_removal_requests_attendee_id_fkey',
        'data_removal_requests', 'attendees',
        ['attendee_id'], ['id'],
    )

    op.add_column('events',
        sa.Column('department_id', sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        'events_department_id_fkey',
        'events', 'departments',
        ['department_id'], ['id'],
    )

    op.drop_constraint('users_username_key', 'users', type_='unique')
    op.drop_column('users', 'username')

    op.drop_constraint('users_student_id_key', 'users', type_='unique')
    op.drop_column('users', 'student_id')


def downgrade() -> None:
    op.add_column('users', sa.Column('student_id', sa.String(length=50), nullable=True))
    op.create_unique_constraint('users_student_id_key', 'users', ['student_id'])

    op.add_column('users', sa.Column('username', sa.String(length=100), nullable=True))
    op.create_unique_constraint('users_username_key', 'users', ['username'])

    op.drop_constraint('events_department_id_fkey', 'events', type_='foreignkey')
    op.drop_column('events', 'department_id')

    op.drop_constraint('data_removal_requests_attendee_id_fkey', 'data_removal_requests', type_='foreignkey')
    op.alter_column('data_removal_requests', 'attendee_id', new_column_name='student_id')
    op.create_foreign_key('data_removal_requests_student_id_fkey', 'data_removal_requests', 'attendees', ['student_id'], ['id'])

    op.drop_constraint('consent_attendee_id_fkey', 'consent', type_='foreignkey')
    op.rename_table('consent', 'student_consent')
    op.alter_column('student_consent', 'attendee_id', new_column_name='student_id')
    op.create_foreign_key('student_consent_student_id_fkey', 'student_consent', 'attendees', ['student_id'], ['id'])

    op.drop_constraint('embeddings_attendee_id_fkey', 'embeddings', type_='foreignkey')
    op.rename_table('embeddings', 'student_embeddings')
    op.alter_column('student_embeddings', 'attendee_id', new_column_name='student_id')
    op.create_foreign_key('student_embeddings_student_id_fkey', 'student_embeddings', 'attendees', ['student_id'], ['id'])

    op.drop_constraint('uq_attendance_session_attendee', 'attendance_logs', type_='unique')
    op.drop_constraint('attendance_logs_attendee_id_fkey', 'attendance_logs', type_='foreignkey')
    op.alter_column('attendance_logs', 'attendee_id', new_column_name='student_id')
    op.create_foreign_key('attendance_logs_student_id_fkey', 'attendance_logs', 'attendees', ['student_id'], ['id'])
    op.create_unique_constraint('uq_attendance_session_student', 'attendance_logs', ['session_id', 'student_id'])

    op.drop_constraint('attendees_department_id_fkey', 'attendees', type_='foreignkey')
    op.drop_constraint('attendees_user_id_fkey', 'attendees', type_='foreignkey')

    op.rename_table('attendees', 'students')

    op.drop_column('students', 'department_id')
    op.drop_column('students', 'attendee_type')

    op.drop_constraint('attendees_identifier_key', 'students', type_='unique')
    op.alter_column('students', 'identifier', new_column_name='student_id')
    op.create_unique_constraint('students_student_id_key', 'students', ['student_id'])

    op.create_foreign_key('students_user_id_fkey', 'students', 'users', ['user_id'], ['id'])

    op.drop_table('departments')
    op.execute("DROP TYPE IF EXISTS attendee_type")
