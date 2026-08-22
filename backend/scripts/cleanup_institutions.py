import asyncio
from app.database import get_session_ctx
from app.models.institution import Institution
from app.models.organization import Organization, OrgType
from app.models.user import User, UserRole
from app.models.scanner_device import ScannerDevice, ScannerPairingCode
from app.models.event import Event
from app.models.attendance_session import AttendanceSession
from app.models.attendance_log import AttendanceLog
from app.models.attendee import Attendee
from app.models.embedding import Embedding
from app.models.membership import Membership
from app.models.organization_staff import OrganizationStaff
from app.models.consent import Consent
from app.models.data_removal_request import DataRemovalRequest
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.utils.security import hash_password
from sqlalchemy import select, delete

async def main():
    async with get_session_ctx() as s:
        # 1. Ensure CJC exists with clean code 'cjc'
        cjc_res = await s.execute(select(Institution).where(Institution.code == 'cjc'))
        cjc_inst = cjc_res.scalar_one_or_none()
        if not cjc_inst:
            cjc_inst = Institution(
                name='Cor Jesu College',
                code='cjc',
                logo_url='https://images.unsplash.com/photo-1562774053-701939374585?w=200',
                is_active=True
            )
            s.add(cjc_inst)
            await s.flush()
        else:
            cjc_inst.name = 'Cor Jesu College'
            cjc_inst.is_active = True

        # 2. Ensure AdDU exists with clean code 'addu'
        addu_res = await s.execute(select(Institution).where(Institution.code == 'addu'))
        addu_inst = addu_res.scalar_one_or_none()
        if not addu_inst:
            addu_inst = Institution(
                name='Ateneo de Davao University',
                code='addu',
                logo_url='https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=200',
                is_active=True
            )
            s.add(addu_inst)
            await s.flush()
        else:
            addu_inst.name = 'Ateneo de Davao University'
            addu_inst.is_active = True

        keep_inst_ids = {cjc_inst.id, addu_inst.id}

        # 3. Find all institutions to delete
        all_insts = (await s.execute(select(Institution))).scalars().all()
        to_delete = [i for i in all_insts if i.id not in keep_inst_ids]
        to_delete_ids = [i.id for i in to_delete]

        if to_delete_ids:
            print(f'Deleting {len(to_delete_ids)} excess institutions...')
            # Get events to delete
            events_to_del = (await s.execute(select(Event.id).where(Event.institution_id.in_(to_delete_ids)))).scalars().all()
            if events_to_del:
                sessions_to_del = (await s.execute(select(AttendanceSession.id).where(AttendanceSession.event_id.in_(events_to_del)))).scalars().all()
                if sessions_to_del:
                    await s.execute(delete(AttendanceLog).where(AttendanceLog.session_id.in_(sessions_to_del)))
                await s.execute(delete(AttendanceSession).where(AttendanceSession.event_id.in_(events_to_del)))
                await s.execute(delete(Event).where(Event.id.in_(events_to_del)))

            # Get attendees to delete
            att_to_del = (await s.execute(select(Attendee.id).where(Attendee.institution_id.in_(to_delete_ids)))).scalars().all()
            if att_to_del:
                await s.execute(delete(Embedding).where(Embedding.attendee_id.in_(att_to_del)))
                await s.execute(delete(Membership).where(Membership.attendee_id.in_(att_to_del)))
                await s.execute(delete(Consent).where(Consent.attendee_id.in_(att_to_del)))
                await s.execute(delete(DataRemovalRequest).where(DataRemovalRequest.attendee_id.in_(att_to_del)))
                await s.execute(delete(AttendanceLog).where(AttendanceLog.attendee_id.in_(att_to_del)))
                await s.execute(delete(Attendee).where(Attendee.id.in_(att_to_del)))

            orgs_to_del = (await s.execute(select(Organization.id).where(Organization.institution_id.in_(to_delete_ids)))).scalars().all()
            if orgs_to_del:
                await s.execute(delete(OrganizationStaff).where(OrganizationStaff.organization_id.in_(orgs_to_del)))
                await s.execute(delete(Organization).where(Organization.id.in_(orgs_to_del)))

            users_to_del = (await s.execute(select(User.id).where(User.institution_id.in_(to_delete_ids)))).scalars().all()
            if users_to_del:
                await s.execute(delete(Notification).where(Notification.user_id.in_(users_to_del)))
                await s.execute(delete(User).where(User.id.in_(users_to_del)))

            await s.execute(delete(ScannerPairingCode).where(ScannerPairingCode.institution_id.in_(to_delete_ids)))
            await s.execute(delete(ScannerDevice).where(ScannerDevice.institution_id.in_(to_delete_ids)))
            await s.execute(delete(Institution).where(Institution.id.in_(to_delete_ids)))

        # 4. Clean up test Super Admins
        super_admins = (await s.execute(select(User).where(User.role == UserRole.super_admin))).scalars().all()
        for sa in super_admins:
            if sa.email != 'superadmin@attendify.edu':
                await s.delete(sa)

        # 5. Set up Clean AdDU Admin User
        addu_admin_res = await s.execute(select(User).where(User.email == 'addu_admin@addu.edu.ph'))
        addu_admin = addu_admin_res.scalar_one_or_none()
        if not addu_admin:
            addu_admin = User(
                email='addu_admin@addu.edu.ph',
                password_hash=hash_password('Password123!'),
                first_name='Ateneo',
                last_name='Admin',
                role=UserRole.admin,
                institution_id=addu_inst.id,
            )
            s.add(addu_admin)
        else:
            addu_admin.password_hash = hash_password('Password123!')
            addu_admin.institution_id = addu_inst.id
            addu_admin.role = UserRole.admin

        # 6. Set up Clean CJC Admin User
        cjc_admin_res = await s.execute(select(User).where(User.email == 'admin@gmail.com'))
        cjc_admin = cjc_admin_res.scalar_one_or_none()
        if not cjc_admin:
            cjc_admin = User(
                email='admin@gmail.com',
                password_hash=hash_password('Password123!'),
                first_name='CJC',
                last_name='Admin',
                role=UserRole.admin,
                institution_id=cjc_inst.id,
            )
            s.add(cjc_admin)
        else:
            cjc_admin.password_hash = hash_password('Password123!')
            cjc_admin.institution_id = cjc_inst.id
            cjc_admin.role = UserRole.admin

        # 7. Set up Clean Super Admin User
        sa_res = await s.execute(select(User).where(User.email == 'superadmin@attendify.edu'))
        sa = sa_res.scalar_one_or_none()
        if not sa:
            sa = User(
                email='superadmin@attendify.edu',
                password_hash=hash_password('Password123!'),
                first_name='Super',
                last_name='Admin',
                role=UserRole.super_admin,
                institution_id=None,
            )
            s.add(sa)
        else:
            sa.password_hash = hash_password('Password123!')

        # 8. Seed academic college programs for AdDU
        addu_orgs = (await s.execute(select(Organization).where(Organization.institution_id == addu_inst.id))).scalars().all()
        existing_addu_codes = {o.code for o in addu_orgs}
        addu_colleges = [
            ('Department of Computer Science', 'CS_DEPT', OrgType.COLLEGE),
            ('School of Engineering and Architecture', 'SEA', OrgType.COLLEGE),
            ('School of Arts and Sciences', 'SAS', OrgType.COLLEGE),
            ('School of Business and Governance', 'SBG', OrgType.COLLEGE),
            ('School of Nursing', 'SON', OrgType.COLLEGE),
            ('School of Education', 'SOE', OrgType.COLLEGE),
        ]
        for name, code, otype in addu_colleges:
            if code not in existing_addu_codes:
                s.add(Organization(
                    institution_id=addu_inst.id,
                    name=name,
                    code=code,
                    org_type=otype,
                    description=f'Academic college division for {name}',
                ))

        await s.commit()
        print('=== DATABASE CLEANUP COMPLETED SUCCESSFULLY! ===')
        print(f'Active Institutions: [CJC (code=cjc), AdDU (code=addu)]')

if __name__ == '__main__':
    asyncio.run(main())
