import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Group,
  Button,
  Card,
  SimpleGrid,
  Badge,
  Modal,
  TextInput,
  Select,
  Textarea,
  Tabs,
  ActionIcon,
  Loader,
  Alert,
  Stack,
} from '@mantine/core';
import {
  IconPlus,
  IconBuildingCommunity,
  IconUsers,
  IconTrash,
  IconAlertCircle,
  IconSchool,
  IconBook,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import {
  getOrganizations,
  createOrganization,
  deleteOrganization,
} from '../../api/organizations';
import { Organization, OrgType } from '../../types/organization';
import { useAuthStore } from '../../store/authStore';

export const OrganizationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOrgAdmin = user?.role === 'org_admin';
  const canCreate = isSuperAdmin || isOrgAdmin;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Modal State
  const [createOpened, setCreateOpened] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('club');
  const [parentId, setParentId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const data = await getOrganizations();
      setOrganizations(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load organizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const collegesList = organizations.filter((o) => o.org_type === 'college');

  const openCreateModal = () => {
    setName('');
    setCode('');
    setOrgType('club');
    setDescription('');
    if (isOrgAdmin && collegesList.length > 0) {
      setParentId(collegesList[0].id);
    } else {
      setParentId(null);
    }
    setCreateOpened(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    try {
      setSubmitting(true);
      await createOrganization({
        name,
        code: code.toUpperCase(),
        org_type: orgType,
        parent_id: parentId || undefined,
        description,
      });
      setCreateOpened(false);
      setName('');
      setCode('');
      setDescription('');
      setParentId(null);
      fetchOrgs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create organization.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this organization?')) return;

    try {
      await deleteOrganization(id);
      fetchOrgs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete organization.');
    }
  };

  const filteredOrgs = organizations.filter((org) => {
    if (activeTab === 'all') return true;
    return org.org_type === activeTab;
  });

  const getBadgeColor = (type: OrgType) => {
    switch (type) {
      case 'college':
        return 'blue';
      case 'club':
        return 'teal';
      case 'office':
        return 'violet';
      default:
        return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>
            {isSuperAdmin ? 'Organizations & Department Units' : 'Department & Club Management'}
          </Title>
          <Text c="dimmed" size="sm">
            {isSuperAdmin
              ? 'Manage university colleges, departmental clubs, and faculty attendance offices.'
              : 'Manage your department, spawn child student clubs, and configure faculty check-in offices.'}
          </Text>
        </div>
        {canCreate && (
          <Button
            leftSection={<IconPlus size={18} />}
            color="blue"
            onClick={openCreateModal}
          >
            {isSuperAdmin ? 'Add Organization / Club' : 'Add Club or Office'}
          </Button>
        )}
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'all')}>
        <Tabs.List>
          <Tabs.Tab value="all" leftSection={<IconBuildingCommunity size={16} />}>
            All Units ({organizations.length})
          </Tabs.Tab>
          <Tabs.Tab value="college" leftSection={<IconSchool size={16} />}>
            Colleges ({organizations.filter((o) => o.org_type === 'college').length})
          </Tabs.Tab>
          <Tabs.Tab value="club" leftSection={<IconBook size={16} />}>
            Student Clubs ({organizations.filter((o) => o.org_type === 'club').length})
          </Tabs.Tab>
          <Tabs.Tab value="office">
            Faculty & Offices ({organizations.filter((o) => o.org_type === 'office').length})
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      ) : filteredOrgs.length === 0 ? (
        <Card p="xl" radius="md" withBorder style={{ textAlign: 'center' }}>
          <Text c="dimmed">
            {isSuperAdmin
              ? 'No organizations found in this category.'
              : 'You have not been assigned to any organization yet. Please contact the Campus Administrator.'}
          </Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {filteredOrgs.map((org) => (
            <Card
              key={org.id}
              shadow="sm"
              p="lg"
              radius="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/admin/organizations/${org.id}/members`)}
            >
              <Group justify="space-between" mb="xs">
                <Group gap={6}>
                  <Badge color={getBadgeColor(org.org_type)} variant="filled">
                    {org.org_type.toUpperCase()}
                  </Badge>
                  {org.parent_name && (
                    <Badge color="gray" variant="outline" size="xs">
                      {org.parent_code || org.parent_name}
                    </Badge>
                  )}
                  {org.children_count !== undefined && org.children_count > 0 && (
                    <Badge color="indigo" variant="light" size="xs">
                      {org.children_count} Sub-units
                    </Badge>
                  )}
                </Group>
                {isSuperAdmin && (
                  <Group gap={4}>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={(e) => handleDelete(org.id, e)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                )}
              </Group>

              <Title order={4} mb={4}>
                {org.name}
              </Title>
              <Text size="xs" c="dimmed" mb="md">
                CODE: {org.code}
              </Text>

              <Text size="sm" c="dimmed" lineClamp={2} mb="md">
                {org.description || 'No description provided.'}
              </Text>

              <Group justify="space-between" mt="auto" pt="sm" style={{ borderTop: '1px solid #2C2E33' }}>
                <Group gap={6}>
                  <IconUsers size={16} color="#909296" />
                  <Text size="xs" c="dimmed">
                    {org.member_count} Members
                  </Text>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/organizations/${org.id}/members`);
                  }}
                >
                  Manage Roster &rarr;
                </Button>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Create Modal */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={isSuperAdmin ? 'Create New Organization, Club or Office' : 'Create New Department Club or Office'}
        centered
      >
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {error}
              </Alert>
            )}
            <TextInput
              label="Organization / Club Name"
              placeholder="e.g. Math Club, Robotics Guild, Dean's Office"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextInput
              label="Organization Code"
              placeholder="e.g. COE-MATH, CCS-ROBO, CCS-FACULTY"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Select
              label="Organization Type"
              data={[
                { value: 'club', label: 'Student Club (e.g. Math Club, Robotics Society)' },
                ...(isSuperAdmin ? [{ value: 'college', label: 'College / Academic Department' }] : []),
                { value: 'office', label: 'Faculty / Administrative Office (Staff Attendance)' },
              ]}
              value={orgType}
              onChange={(val) => setOrgType((val as OrgType) || 'club')}
              required
            />

            {(orgType === 'club' || orgType === 'office') && collegesList.length > 0 && (
              <Select
                label="Parent College / Department"
                description={
                  isOrgAdmin
                    ? 'Child clubs and offices inherit administrative staffing from your college.'
                    : 'Select the academic department that hosts this club or office.'
                }
                data={[
                  ...(isSuperAdmin ? [{ value: '', label: '(None - Independent University Organization)' }] : []),
                  ...collegesList.map((col) => ({
                    value: col.id,
                    label: `${col.name} (${col.code})`,
                  })),
                ]}
                value={parentId || ''}
                onChange={(val) => setParentId(val ? val : null)}
                disabled={isOrgAdmin && collegesList.length === 1}
                required={isOrgAdmin}
              />
            )}

            <Textarea
              label="Description"
              placeholder="Brief description of this club or department..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setCreateOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Create Organization
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};
