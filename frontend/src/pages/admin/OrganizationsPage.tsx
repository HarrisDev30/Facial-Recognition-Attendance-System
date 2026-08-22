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

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Modal State
  const [createOpened, setCreateOpened] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('club');
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    try {
      setSubmitting(true);
      await createOrganization({
        name,
        code: code.toUpperCase(),
        org_type: orgType,
        description,
      });
      setCreateOpened(false);
      setName('');
      setCode('');
      setDescription('');
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
          <Title order={2}>{isSuperAdmin ? 'Organizations & Clubs' : 'My Assigned Organization'}</Title>
          <Text c="dimmed" size="sm">
            {isSuperAdmin
              ? 'Manage university departments, faculty rosters, and student clubs (Math Club, Chess Club, etc.)'
              : 'Manage your assigned organization, club roster, and event details.'}
          </Text>
        </div>
        {isSuperAdmin && (
          <Button
            leftSection={<IconPlus size={18} />}
            color="blue"
            onClick={() => setCreateOpened(true)}
          >
            Add Organization / Club
          </Button>
        )}
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      )}

      {isSuperAdmin && (
        <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'all')}>
          <Tabs.List>
            <Tabs.Tab value="all" leftSection={<IconBuildingCommunity size={16} />}>
              All ({organizations.length})
            </Tabs.Tab>
            <Tabs.Tab value="college" leftSection={<IconSchool size={16} />}>
              Colleges / Departments ({organizations.filter((o) => o.org_type === 'college').length})
            </Tabs.Tab>
            <Tabs.Tab value="club" leftSection={<IconBook size={16} />}>
              Student Clubs ({organizations.filter((o) => o.org_type === 'club').length})
            </Tabs.Tab>
            <Tabs.Tab value="office">
              Offices ({organizations.filter((o) => o.org_type === 'office').length})
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      )}

      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      ) : filteredOrgs.length === 0 ? (
        <Card p="xl" radius="md" withBorder style={{ textAlign: 'center' }}>
          <Text c="dimmed">
            {isSuperAdmin
              ? 'No organizations found in this category.'
              : 'You have not been assigned to an organization yet. Please contact the Super Admin.'}
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
                <Badge color={getBadgeColor(org.org_type)} variant="filled">
                  {org.org_type.toUpperCase()}
                </Badge>
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
        title="Create New Organization or Club"
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
              label="Organization Name"
              placeholder="e.g. Math Club, Chess Club, College of Science"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextInput
              label="Organization Code"
              placeholder="e.g. MATHCLUB, CHESSCLUB, CCIS"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Select
              label="Organization Type"
              data={[
                { value: 'club', label: 'Student Club (e.g. Math Club)' },
                { value: 'college', label: 'College / Department' },
                { value: 'office', label: 'University Office' },
              ]}
              value={orgType}
              onChange={(val) => setOrgType((val as OrgType) || 'club')}
              required
            />
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
