import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Group,
  Button,
  Card,
  Table,
  Badge,
  Modal,
  Select,
  TextInput,
  Tabs,
  ActionIcon,
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
  const [activeTab, setActiveTab] = useState<string>('students');

  // Add Member Modal State
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [memberType, setMemberType] = useState<MemberType>('student');
  const [role, setRole] = useState('Active Member');

  // Staff Assignment Modal State
  const [staffModalOpened, setStaffModalOpened] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<OrgRole>('admin');

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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedAttendeeId) return;

    try {
      setSubmitting(true);
      await addOrgMember(id, {
        attendee_id: selectedAttendeeId,
        member_type: memberType,
        role: role || 'Member',
      });
      setModalOpened(false);
      setSelectedAttendeeId(null);
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

  const handleRemoveMember = async (attendeeId: string) => {
    if (!id) return;
    if (!window.confirm('Remove this person from the organization roster?')) return;

    try {
      await removeOrgMember(id, attendeeId);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove member.');
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    if (!id) return;
    if (!window.confirm('Remove this officer/admin assignment?')) return;

    try {
      await removeOrgStaff(id, userId);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove officer.');
    }
  };

  const studentMembers = members.filter((m) => m.attendee_type === 'student');
  const facultyMembers = members.filter((m) => m.attendee_type === 'faculty' || m.attendee_type === 'staff');

  const attendeeOptions = allAttendees.map((att) => ({
    value: att.id,
    label: `${att.first_name} ${att.last_name} (${att.identifier}) - ${att.attendee_type}`,
  }));

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/admin/organizations')}
          >
            Back
          </Button>
          <div>
            <Group gap="xs" align="center">
              <Title order={2}>{org?.name || 'Organization'}</Title>
              {org?.parent_name && (
                <Badge color="gray" variant="outline" size="sm">
                  Parent: {org.parent_name} ({org.parent_code})
                </Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm">
              Code: {org?.code} &bull; Type: {org?.org_type?.toUpperCase()}
            </Text>
          </div>
        </Group>

        <Group>
          {activeTab === 'staff' ? (
            <Button
              leftSection={<IconShieldCheck size={18} />}
              color="indigo"
              onClick={() => setStaffModalOpened(true)}
            >
              Assign Club Admin / Officer
            </Button>
          ) : (
            <Button
              leftSection={<IconUserPlus size={18} />}
              color="blue"
              onClick={() => setModalOpened(true)}
            >
              Add Person to Roster
            </Button>
          )}
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'students')}>
        <Tabs.List>
          <Tabs.Tab value="students" leftSection={<IconUsers size={16} />}>
            Student Roster ({studentMembers.length})
          </Tabs.Tab>
          <Tabs.Tab value="faculty" leftSection={<IconSchool size={16} />}>
            Faculty & Staff Roster ({facultyMembers.length})
          </Tabs.Tab>
          <Tabs.Tab value="staff" leftSection={<IconShieldCheck size={16} />}>
            Club Admins & Officers ({staff.length})
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      ) : activeTab === 'staff' ? (
        <Card p="md" radius="md" withBorder>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Officer Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Assigned Role</Table.Th>
                <Table.Th>Assigned Date</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {staff.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: 'center', color: '#909296' }}>
                    No specific admins or officers assigned to {org?.name} yet. Click "Assign Club Admin / Officer" above!
                  </Table.Td>
                </Table.Tr>
              ) : (
                staff.map((st) => (
                  <Table.Tr key={st.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar radius="xl" color="indigo">
                          {st.first_name?.[0] || 'O'}
                          {st.last_name?.[0] || 'A'}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500}>
                            {st.first_name} {st.last_name}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{st.email}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={st.org_role === 'admin' ? 'violet' : 'teal'}>
                        {st.org_role === 'admin' ? 'Organization Admin' : 'Marshal Officer'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {st.created_at ? new Date(st.created_at).toLocaleDateString() : 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" onClick={() => handleRemoveStaff(st.user_id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Card>
      ) : (
        <Card p="md" radius="md" withBorder>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Member Name</Table.Th>
                <Table.Th>ID / Identifier</Table.Th>
                <Table.Th>Home Department</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Joined Date</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(activeTab === 'students' ? studentMembers : facultyMembers).length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center', color: '#909296' }}>
                    No {activeTab} listed in this roster yet.
                  </Table.Td>
                </Table.Tr>
              ) : (
                (activeTab === 'students' ? studentMembers : facultyMembers).map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar radius="xl" color="blue">
                          {m.first_name[0]}
                          {m.last_name[0]}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500}>
                            {m.first_name} {m.last_name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {m.email || 'No email provided'}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{m.identifier}</Text>
                    </Table.Td>
                    <Table.Td>
                      {m.home_department_code ? (
                        <Badge variant="light" color="indigo" size="xs">
                          {m.home_department_code}
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">Campus</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={m.attendee_type === 'faculty' ? 'violet' : 'blue'}>
                        {m.attendee_type.toUpperCase()}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="dot" color="teal">
                        {m.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" onClick={() => handleRemoveMember(m.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Add Member Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={`Add Person to ${org?.name || 'Organization'} Roster`}
        centered
      >
        <form onSubmit={handleAddMember}>
          <Stack gap="md">
            <Select
              label="Select Person (Student / Faculty)"
              placeholder="Search by name or student ID..."
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
              placeholder="e.g. Active Member, President, Faculty Advisor"
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

      {/* Assign Staff Modal */}
      <Modal
        opened={staffModalOpened}
        onClose={() => setStaffModalOpened(false)}
        title={`Assign Admin or Marshal Officer to ${org?.name || 'Organization'}`}
        centered
      >
        <form onSubmit={handleAddStaff}>
          <Stack gap="md">
            <Select
              label="Select User Account"
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
                { value: 'admin', label: 'Organization Admin (Full Control of Club/Department)' },
                { value: 'marshal', label: 'Event Marshal (Attendance & Scanner Control)' },
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
    </Stack>
  );
};
