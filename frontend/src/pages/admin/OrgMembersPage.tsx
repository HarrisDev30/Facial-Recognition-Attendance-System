import React, { useEffect, useState, useMemo } from 'react';
import {
  Text,
  Group,
  Button,
  Modal,
  Select,
  TextInput,
  Loader,
  Alert,
  Stack,
  Avatar,
} from '@mantine/core';
import {
  IconUserPlus,
  IconTrash,
  IconArrowLeft,
  IconAlertCircle,
  IconUsers,
  IconSchool,
  IconShieldCheck,
  IconShieldX,
  IconSearch,
  IconCheck,
} from '@tabler/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getOrganization,
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  getOrgStaff,
  addOrgStaff,
  removeOrgStaff,
} from '../../api/organizations';
import { getAttendees, AttendeeResponse } from '../../api/attendees';
import { Organization, OrgMember, MemberType, OrgStaff, OrgRole } from '../../types/organization';
import './OrgMembersPage.css';

export const OrgMembersPage: React.FC = () => {
  const { id: paramId, orgId } = useParams<{ id?: string; orgId?: string }>();
  const id = orgId || paramId;
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [staff, setStaff] = useState<OrgStaff[]>([]);
  const [allAttendees, setAllAttendees] = useState<AttendeeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'faculty' | 'staff'>('students');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Member Modal State
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [memberType, setMemberType] = useState<MemberType>('student');
  const [role, setRole] = useState('Active Member');

  // Staff Assignment Modal State
  const [staffModalOpened, setStaffModalOpened] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<OrgRole>('admin');

  // Accessible Removal Confirmation Modal State
  const [removalTarget, setRemovalTarget] = useState<{
    type: 'member' | 'staff';
    id: string;
    name: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [orgData, membersData, staffData, attendeesData] = await Promise.all([
        getOrganization(id),
        getOrgMembers(id),
        getOrgStaff(id).catch(() => []),
        getAttendees().catch(() => []),
      ]);
      setOrg(orgData);
      setMembers(membersData);
      setStaff(staffData);
      setAllAttendees(attendeesData);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load organization details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const attendeeMap = useMemo(() => {
    return new Map<string, AttendeeResponse>(allAttendees.map((a) => [a.id, a]));
  }, [allAttendees]);

  const attendeeByUserOrEmail = useMemo(() => {
    const map = new Map<string, AttendeeResponse>();
    for (const a of allAttendees) {
      if (a.email) map.set(a.email.toLowerCase(), a);
    }
    return map;
  }, [allAttendees]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedAttendeeId) return;

    try {
      setSubmitting(true);
      await addOrgMember(id, {
        attendee_id: selectedAttendeeId,
        member_type: memberType,
        role: role || 'Active Member',
      });
      setModalOpened(false);
      setSelectedAttendeeId(null);
      setRole('Active Member');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add member to roster.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedUserId) return;

    try {
      setSubmitting(true);
      await addOrgStaff(id, {
        user_id: selectedUserId,
        org_role: orgRole,
      });
      setStaffModalOpened(false);
      setSelectedUserId(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to assign officer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRemoval = async () => {
    if (!id || !removalTarget) return;

    try {
      setSubmitting(true);
      if (removalTarget.type === 'member') {
        await removeOrgMember(id, removalTarget.id);
      } else {
        await removeOrgStaff(id, removalTarget.id);
      }
      setRemovalTarget(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Categorize members
  const studentMembers = useMemo(
    () => members.filter((m) => m.attendee_type === 'student'),
    [members]
  );
  const facultyMembers = useMemo(
    () => members.filter((m) => m.attendee_type === 'faculty' || m.attendee_type === 'staff'),
    [members]
  );

  // Filtered rosters based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentMembers;
    const q = searchQuery.toLowerCase();
    return studentMembers.filter(
      (m) =>
        m.first_name.toLowerCase().includes(q) ||
        m.last_name.toLowerCase().includes(q) ||
        m.identifier.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.role && m.role.toLowerCase().includes(q))
    );
  }, [studentMembers, searchQuery]);

  const filteredFaculty = useMemo(() => {
    if (!searchQuery.trim()) return facultyMembers;
    const q = searchQuery.toLowerCase();
    return facultyMembers.filter(
      (m) =>
        m.first_name.toLowerCase().includes(q) ||
        m.last_name.toLowerCase().includes(q) ||
        m.identifier.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.role && m.role.toLowerCase().includes(q))
    );
  }, [facultyMembers, searchQuery]);

  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staff;
    const q = searchQuery.toLowerCase();
    return staff.filter(
      (st) =>
        (st.first_name && st.first_name.toLowerCase().includes(q)) ||
        (st.last_name && st.last_name.toLowerCase().includes(q)) ||
        st.email.toLowerCase().includes(q) ||
        st.org_role.toLowerCase().includes(q)
    );
  }, [staff, searchQuery]);

  const attendeeOptions = useMemo(
    () =>
      allAttendees.map((att) => ({
        value: att.id,
        label: `${att.first_name} ${att.last_name} (${att.identifier}) — ${att.attendee_type.toUpperCase()}`,
      })),
    [allAttendees]
  );

  const studentPercent =
    members.length > 0 ? Math.round((studentMembers.length / members.length) * 100) : 0;

  return (
    <div className="orgmembers-container">
      {/* ─── 1. Executive Split Header Card (Student Dashboard Architecture) ─── */}
      <div className="orgmembers-header-card">
        {/* Left Column: Title, Metadata Tags, Action Buttons */}
        <div className="orgmembers-identity-col">
          <div>
            <button
              type="button"
              className="orgmembers-back-btn"
              onClick={() => navigate('/admin/organizations')}
            >
              <IconArrowLeft size={14} />
              <span>Back to Organizations</span>
            </button>

            <h1 className="orgmembers-title" style={{ marginTop: '10px' }}>
              {org?.name || 'Organization Roster'}
            </h1>
            <span className="orgmembers-institution-name">
              {org?.parent_name
                ? `Department: ${org.parent_name} (${org.parent_code})`
                : 'Central Campus Unit'}
            </span>
          </div>

          <div className="orgmembers-credential-stack">
            {org?.code && (
              <span className="orgmembers-id-tag">
                ORG: {org.code}
              </span>
            )}
            {org?.org_type && (
              <span className="orgmembers-type-tag">
                {org.org_type}
              </span>
            )}
            <span className="orgmembers-status-pill">
              <IconCheck size={12} />
              <span>Roster Active</span>
            </span>
          </div>

          <div className="orgmembers-cta-row">
            <Button
              className="orgmembers-btn-primary"
              leftSection={<IconUserPlus size={16} />}
              onClick={() => setModalOpened(true)}
            >
              Add Person to Roster
            </Button>
            <Button
              className="orgmembers-btn-secondary"
              leftSection={<IconShieldCheck size={16} />}
              onClick={() => setStaffModalOpened(true)}
            >
              Designate Marshal / Admin
            </Button>
          </div>
        </div>

        {/* Right Column: 3 Visual Slide Cards */}
        <div className="orgmembers-visual-frame">
          <div className="orgmembers-visual-slide">
            <span className="orgmembers-slide-category">Total Enrolled Roster</span>
            <div className="orgmembers-slide-big-metric">
              {members.length}
            </div>
            <span className="orgmembers-slide-subtext">Active enrolled individuals</span>
          </div>

          <div className="orgmembers-visual-slide">
            <span className="orgmembers-slide-category">Student Members</span>
            <div className="orgmembers-slide-big-metric">
              {studentMembers.length}
            </div>
            <span className="orgmembers-slide-subtext">
              {studentPercent}% of total organization roster
            </span>
          </div>

          <div className="orgmembers-visual-slide">
            <span className="orgmembers-slide-category">Gate Marshals & Admins</span>
            <div className="orgmembers-slide-big-metric">
              {staff.length}
            </div>
            <span className="orgmembers-slide-subtext">
              {staff.length} authorized system operators
            </span>
          </div>
        </div>
      </div>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Notice"
          color="red"
          variant="light"
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* ─── 2. Filter Tabs & Search Toolbar ─── */}
      <div className="orgmembers-toolbar">
        <div className="orgmembers-tab-group">
          <button
            type="button"
            className={`orgmembers-tab-pill ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <IconUsers size={15} />
            <span>Enrolled Students</span>
            <span className="orgmembers-tab-count">{studentMembers.length}</span>
          </button>

          <button
            type="button"
            className={`orgmembers-tab-pill ${activeTab === 'faculty' ? 'active' : ''}`}
            onClick={() => setActiveTab('faculty')}
          >
            <IconSchool size={15} />
            <span>Faculty & Advisors</span>
            <span className="orgmembers-tab-count">{facultyMembers.length}</span>
          </button>

          <button
            type="button"
            className={`orgmembers-tab-pill ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <IconShieldCheck size={15} />
            <span>Gate Marshals & Admins</span>
            <span className="orgmembers-tab-count">{staff.length}</span>
          </button>
        </div>

        <div className="orgmembers-search-wrap">
          <TextInput
            placeholder="Search by name, ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={14} style={{ color: 'var(--text-muted)' }} />}
            radius="md"
            size="sm"
          />
        </div>
      </div>

      {/* ─── 3. Member Ledger Table Card ─── */}
      <div className="orgmembers-ledger-card">
        <div className="card-header-row">
          <span className="card-heading">
            {activeTab === 'students'
              ? 'Enrolled Student Roster'
              : activeTab === 'faculty'
                ? 'Faculty & Department Advisors'
                : 'Assigned Gate Marshals & Administrators'}
          </span>
          <span className="card-meta-count">
            {activeTab === 'students'
              ? `${filteredStudents.length} Students`
              : activeTab === 'faculty'
                ? `${filteredFaculty.length} Faculty`
                : `${filteredStaff.length} Operators`}
          </span>
        </div>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader size="md" />
          </Group>
        ) : activeTab === 'staff' ? (
          filteredStaff.length === 0 ? (
            <div className="orgmembers-empty-state">
              <div className="empty-state-icon-wrap">
                <IconShieldCheck size={22} />
              </div>
              <Text fz="0.875rem" fw={600} c="var(--text-primary)">
                {searchQuery ? 'No matching operators found' : 'No operators assigned yet'}
              </Text>
              <Text fz="0.75rem" c="var(--text-secondary)">
                {searchQuery
                  ? 'Try adjusting your search criteria.'
                  : `Click "Designate Marshal / Admin" above to assign administrators or event gate marshals for ${org?.name || 'this organization'}.`}
              </Text>
            </div>
          ) : (
            <div className="table-responsive-container">
              <table className="orgmembers-table">
                <thead>
                  <tr>
                    <th>Operator Name</th>
                    <th>Email Address</th>
                    <th>System Role</th>
                    <th>Assigned Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((st) => {
                    const staffAtt = st.email ? attendeeByUserOrEmail.get(st.email.toLowerCase()) : undefined;
                    const staffPhoto = staffAtt?.profile_photo_url || (staffAtt?.consent_given ? `/api/attendees/${staffAtt.id}/profile-photo` : null);
                    return (
                    <tr key={st.id}>
                      <td>
                        <div className="member-identity-group">
                          <Avatar radius="xl" size="sm" color="indigo" src={staffPhoto}>
                            {st.first_name?.[0] || 'O'}
                            {st.last_name?.[0] || 'A'}
                          </Avatar>
                          <div>
                            <div className="member-name">
                              {st.first_name ? `${st.first_name} ${st.last_name}` : 'Authorized User'}
                            </div>
                            <div className="member-email">{st.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Text size="xs" c="var(--text-secondary)" ff="var(--font-mono, monospace)">
                          {st.email}
                        </Text>
                      </td>
                      <td>
                        <span className={`member-role-badge ${st.org_role === 'admin' ? 'admin' : 'marshal'}`}>
                          {st.org_role === 'admin' ? 'Organization Admin' : 'Marshal Officer'}
                        </span>
                      </td>
                      <td>
                        <Text size="xs" c="var(--text-muted)" ff="var(--font-mono, monospace)">
                          {st.created_at ? new Date(st.created_at).toLocaleDateString() : '—'}
                        </Text>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="tactile-action-btn"
                          title="Remove officer assignment"
                          onClick={() =>
                            setRemovalTarget({
                              type: 'staff',
                              id: st.user_id,
                              name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.email,
                            })
                          }
                        >
                          <IconTrash size={14} />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          (() => {
            const currentList = activeTab === 'students' ? filteredStudents : filteredFaculty;
            if (currentList.length === 0) {
              return (
                <div className="orgmembers-empty-state">
                  <div className="empty-state-icon-wrap">
                    <IconUsers size={22} />
                  </div>
                  <Text fz="0.875rem" fw={600} c="var(--text-primary)">
                    {searchQuery ? `No matching ${activeTab} found` : `No ${activeTab} in roster yet`}
                  </Text>
                  <Text fz="0.75rem" c="var(--text-secondary)">
                    {searchQuery
                      ? 'Try adjusting your search criteria.'
                      : `Click "Add Person to Roster" above to enroll members into ${org?.name || 'this organization'}.`}
                  </Text>
                </div>
              );
            }

            return (
              <div className="table-responsive-container">
                <table className="orgmembers-table">
                  <thead>
                    <tr>
                      <th>Member Name</th>
                      <th>Identifier</th>
                      <th>Biometric Status</th>
                      <th>Home Unit</th>
                      <th>Roster Role</th>
                      <th>Joined Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentList.map((m) => {
                      const att = attendeeMap.get(m.id);
                      const isEnrolled = att?.consent_given ?? false;
                      const photoUrl = att?.profile_photo_url || (isEnrolled ? `/api/attendees/${m.id}/profile-photo` : null);

                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="member-identity-group">
                              <Avatar radius="xl" size="sm" color="blue" src={photoUrl}>
                                {m.first_name?.[0] || 'M'}
                                {m.last_name?.[0] || 'E'}
                              </Avatar>
                              <div>
                                <div className="member-name">
                                  {m.first_name} {m.last_name}
                                </div>
                                <div className="member-email">
                                  {m.email || 'No email registered'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="member-id-pill">
                              {m.identifier}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`biometric-status-tag ${isEnrolled ? 'enrolled' : 'pending'}`}
                            >
                              {isEnrolled ? <IconShieldCheck size={12} /> : <IconShieldX size={12} />}
                              <span>{isEnrolled ? 'Face ID Enrolled' : 'Photo Pending'}</span>
                            </span>
                          </td>
                          <td>
                            {m.home_department_code ? (
                              <span className="member-id-pill" style={{ color: 'var(--text-primary)' }}>
                                {m.home_department_code}
                              </span>
                            ) : (
                              <Text size="xs" c="var(--text-muted)">Campus</Text>
                            )}
                          </td>
                          <td>
                            <span className="member-role-badge">
                              {m.role || 'Member'}
                            </span>
                          </td>
                          <td>
                            <Text size="xs" c="var(--text-muted)" ff="var(--font-mono, monospace)">
                              {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                            </Text>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="tactile-action-btn"
                              title="Remove member from roster"
                              onClick={() =>
                                setRemovalTarget({
                                  type: 'member',
                                  id: m.id,
                                  name: `${m.first_name} ${m.last_name}`,
                                })
                              }
                            >
                              <IconTrash size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </div>

      {/* ─── 4. Add Member Modal ─── */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={`Add Person to ${org?.name || 'Organization'} Roster`}
        centered
        radius="lg"
      >
        <form onSubmit={handleAddMember}>
          <Stack gap="md">
            <Select
              label="Select Person"
              description="Search by student name or identifier"
              placeholder="Search by name or ID..."
              data={attendeeOptions}
              value={selectedAttendeeId}
              onChange={setSelectedAttendeeId}
              searchable
              required
            />
            <Select
              label="Member Type"
              data={[
                { value: 'student', label: 'Student' },
                { value: 'faculty', label: 'Faculty / Professor' },
                { value: 'staff', label: 'Staff Member' },
              ]}
              value={memberType}
              onChange={(val) => setMemberType((val as MemberType) || 'student')}
              required
            />
            <TextInput
              label="Role / Title Label"
              placeholder="e.g. Active Member, President, Advisor"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setModalOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Add to Roster
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ─── 5. Assign Officer Modal ─── */}
      <Modal
        opened={staffModalOpened}
        onClose={() => setStaffModalOpened(false)}
        title={`Assign Admin or Marshal Officer to ${org?.name || 'Organization'}`}
        centered
        radius="lg"
      >
        <form onSubmit={handleAddStaff}>
          <Stack gap="md">
            <Select
              label="Select User Account"
              description="Designate a user to manage this organization or scan event attendance"
              placeholder="Select person to make Admin or Marshal..."
              data={attendeeOptions}
              value={selectedUserId}
              onChange={setSelectedUserId}
              searchable
              required
            />
            <Select
              label="Assigned Organization Role"
              data={[
                { value: 'admin', label: 'Organization Admin (Full Control of Unit/Club)' },
                { value: 'marshal', label: 'Event Marshal (Attendance & Scanner Verification)' },
              ]}
              value={orgRole}
              onChange={(val) => setOrgRole((val as OrgRole) || 'admin')}
              required
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setStaffModalOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" color="indigo" loading={submitting}>
                Assign Role
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ─── 6. Accessible Confirmation Modal (Replaces window.confirm) ─── */}
      <Modal
        opened={removalTarget !== null}
        onClose={() => setRemovalTarget(null)}
        title="Confirm Removal"
        centered
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm" c="var(--text-secondary)">
            Are you sure you want to remove <strong style={{ color: 'var(--text-primary)' }}>{removalTarget?.name}</strong> from{' '}
            {org?.name || 'this organization'}?
          </Text>
          <Text size="xs" c="var(--text-muted)">
            {removalTarget?.type === 'member'
              ? 'This person will no longer be listed in the active membership roster for this organization.'
              : 'Their administrative and marshal scanning privileges for this organization will be immediately revoked.'}
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setRemovalTarget(null)}>
              Cancel
            </Button>
            <Button color="red" loading={submitting} onClick={handleConfirmRemoval}>
              Confirm Removal
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
};
export default OrgMembersPage;
