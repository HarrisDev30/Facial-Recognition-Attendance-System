import React, { useEffect, useState, useMemo } from 'react';
import {
  Text,
  Badge,
  Button,
  Modal,
  TextInput,
  Select,
  Textarea,
  ActionIcon,
  Alert,
  Stack,
  Skeleton,
  Tooltip,
  CloseButton,
  Group,
} from '@mantine/core';
import {
  IconPlus,
  IconBuildingCommunity,
  IconUsers,
  IconTrash,
  IconAlertCircle,
  IconSchool,
  IconBook,
  IconSearch,
  IconArrowRight,
  IconSortAscending,
  IconBriefcase,
  IconAlertTriangle,
  IconRefresh,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import {
  getOrganizations,
  createOrganization,
  deleteOrganization,
} from '../../api/organizations';
import { Organization, OrgType } from '../../types/organization';
import { useAuthStore } from '../../store/authStore';
import './OrganizationsPage.css';

export const OrganizationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOrgAdmin = user?.role === 'org_admin';
  const canCreate = isSuperAdmin || isOrgAdmin;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, Filter & Sort State
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | OrgType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('name_asc');

  // Create Modal State
  const [createOpened, setCreateOpened] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('club');
  const [parentId, setParentId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const data = await getOrganizations();
      setOrganizations(data || []);
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

  const collegesList = useMemo(
    () => organizations.filter((o) => o.org_type === 'college'),
    [organizations]
  );

  // Computed summary metrics
  const summary = useMemo(() => {
    const totalUnits = organizations.length;
    const collegesCount = organizations.filter((o) => o.org_type === 'college').length;
    const clubsCount = organizations.filter((o) => o.org_type === 'club').length;
    const officesCount = organizations.filter((o) => o.org_type === 'office').length;
    const totalMembers = organizations.reduce((acc, o) => acc + (o.member_count || 0), 0);

    return { totalUnits, collegesCount, clubsCount, officesCount, totalMembers };
  }, [organizations]);

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
    if (!name.trim() || !code.trim()) return;

    try {
      setSubmitting(true);
      await createOrganization({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        org_type: orgType,
        parent_id: parentId || undefined,
        description: description.trim() || undefined,
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await deleteOrganization(deleteTarget.id);
      setDeleteTarget(null);
      fetchOrgs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete organization.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered and sorted organizations
  const filteredOrgs = useMemo(() => {
    let list = organizations.filter((org) => {
      if (activeTypeFilter !== 'all' && org.org_type !== activeTypeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = org.name.toLowerCase().includes(query);
        const matchesCode = org.code.toLowerCase().includes(query);
        const matchesParent = org.parent_name?.toLowerCase().includes(query);
        return matchesName || matchesCode || matchesParent;
      }
      return true;
    });

    if (sortBy === 'members_desc') {
      list = [...list].sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
    } else if (sortBy === 'code_asc') {
      list = [...list].sort((a, b) => a.code.localeCompare(b.code));
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [organizations, activeTypeFilter, searchQuery, sortBy]);

  const getUnitIcon = (type: OrgType) => {
    switch (type) {
      case 'college':
        return <IconSchool size={20} />;
      case 'office':
        return <IconBriefcase size={20} />;
      case 'club':
      default:
        return <IconBook size={20} />;
    }
  };

  return (
    <div className="orgs-page-container">
      {/* ─── 1. Header Row ─── */}
      <div className="orgs-header-row">
        <div className="orgs-header-title-group">
          <div className="orgs-title-badge-row">
            <h1 className="orgs-page-title">
              {isSuperAdmin
                ? 'Organizations & Academic Units'
                : 'Department & Sub-Unit Hub'}
            </h1>
            <Badge variant="light" color={isSuperAdmin ? 'blue' : 'teal'} size="sm">
              {isSuperAdmin ? 'University Master' : 'Scoped Department'}
            </Badge>
          </div>
          <p className="orgs-page-subtitle">
            {isSuperAdmin
              ? 'Manage academic colleges, student organizations, and department attendance rosters.'
              : 'Administer your department college, affiliated student clubs, and marshal personnel.'}
          </p>
        </div>

        <div className="orgs-header-actions">
          {canCreate && (
            <Button
              leftSection={<IconPlus size={16} />}
              size="xs"
              radius="md"
              className="orgs-btn-primary"
              onClick={openCreateModal}
            >
              {isSuperAdmin ? 'Add Organization' : 'Add Club or Office'}
            </Button>
          )}
          <Tooltip label="Refresh organizations">
            <ActionIcon
              variant="default"
              size="input-xs"
              loading={loading}
              onClick={fetchOrgs}
              className="orgs-btn-secondary"
              aria-label="Refresh list"
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* ─── 2. Calm 4-Stat Metric Ribbon ─── */}
      <div className="orgs-stats-ribbon">
        <div className="orgs-stat-box">
          <div className="orgs-stat-info">
            <span className="orgs-stat-label">Total Units</span>
            <span className="orgs-stat-value">
              {loading ? <Skeleton height={24} width={36} /> : summary.totalUnits}
            </span>
          </div>
          <div className="orgs-stat-icon blue">
            <IconBuildingCommunity size={20} />
          </div>
        </div>

        <div className="orgs-stat-box">
          <div className="orgs-stat-info">
            <span className="orgs-stat-label">Academic Colleges</span>
            <span className="orgs-stat-value">
              {loading ? <Skeleton height={24} width={36} /> : summary.collegesCount}
            </span>
          </div>
          <div className="orgs-stat-icon teal">
            <IconSchool size={20} />
          </div>
        </div>

        <div className="orgs-stat-box">
          <div className="orgs-stat-info">
            <span className="orgs-stat-label">Student Clubs</span>
            <span className="orgs-stat-value">
              {loading ? <Skeleton height={24} width={36} /> : summary.clubsCount}
            </span>
          </div>
          <div className="orgs-stat-icon amber">
            <IconBook size={20} />
          </div>
        </div>

        <div className="orgs-stat-box">
          <div className="orgs-stat-info">
            <span className="orgs-stat-label">Enrolled Members</span>
            <span className="orgs-stat-value">
              {loading ? <Skeleton height={24} width={36} /> : summary.totalMembers}
            </span>
          </div>
          <div className="orgs-stat-icon purple">
            <IconUsers size={20} />
          </div>
        </div>
      </div>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Operation Alert"
          color="red"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* ─── 3. Unified Filter & Search Controls Bar ─── */}
      <div className="orgs-controls-bar">
        <div className="orgs-pill-group">
          <button
            type="button"
            className={`orgs-pill ${activeTypeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTypeFilter('all')}
          >
            <span>All Units</span>
            <span className="orgs-pill-count">{summary.totalUnits}</span>
          </button>

          <button
            type="button"
            className={`orgs-pill ${activeTypeFilter === 'college' ? 'active' : ''}`}
            onClick={() => setActiveTypeFilter('college')}
          >
            <span>Colleges</span>
            <span className="orgs-pill-count">{summary.collegesCount}</span>
          </button>

          <button
            type="button"
            className={`orgs-pill ${activeTypeFilter === 'club' ? 'active' : ''}`}
            onClick={() => setActiveTypeFilter('club')}
          >
            <span>Student Clubs</span>
            <span className="orgs-pill-count">{summary.clubsCount}</span>
          </button>

          {summary.officesCount > 0 && (
            <button
              type="button"
              className={`orgs-pill ${activeTypeFilter === 'office' ? 'active' : ''}`}
              onClick={() => setActiveTypeFilter('office')}
            >
              <span>Offices</span>
              <span className="orgs-pill-count">{summary.officesCount}</span>
            </button>
          )}
        </div>

        <div className="orgs-controls-right">
          <TextInput
            placeholder="Search by unit name or code..."
            leftSection={<IconSearch size={15} style={{ opacity: 0.6 }} />}
            rightSection={
              searchQuery ? (
                <CloseButton
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                />
              ) : null
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="xs"
            radius="md"
            className="orgs-search-input"
          />

          <Select
            size="xs"
            radius="md"
            leftSection={<IconSortAscending size={15} style={{ opacity: 0.6 }} />}
            value={sortBy}
            onChange={(val) => val && setSortBy(val)}
            data={[
              { value: 'name_asc', label: 'Name (A–Z)' },
              { value: 'members_desc', label: 'Most Members' },
              { value: 'code_asc', label: 'Unit Code' },
            ]}
            style={{ width: 148 }}
          />
        </div>
      </div>

      {/* ─── 4. Bento Grid & Unit Cards ─── */}
      {loading ? (
        <div className="orgs-bento-grid">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="orgs-card">
              <div className="orgs-card-header">
                <Skeleton height={42} width={42} radius={10} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={18} width="70%" mb={6} />
                  <Skeleton height={14} width="40%" />
                </div>
              </div>
              <Skeleton height={14} width="90%" />
              <Skeleton height={14} width="60%" />
              <div className="orgs-card-footer">
                <Skeleton height={16} width={90} />
                <Skeleton height={28} width={110} radius="md" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="orgs-empty-state">
          <div className="orgs-empty-icon-wrap">
            <IconBuildingCommunity size={28} />
          </div>
          <Text fw={600} size="md" c="var(--text-primary)">
            {searchQuery
              ? `No organizations match "${searchQuery}"`
              : 'No organizations found in this category'}
          </Text>
          <Text size="sm" c="dimmed" maw={400} mx="auto">
            {isSuperAdmin
              ? 'Try adjusting your search terms or create a new academic college or student club.'
              : 'You have not been assigned to any organization units. Please contact the Campus Administrator.'}
          </Text>
          {searchQuery && (
            <Button
              variant="default"
              size="xs"
              onClick={() => setSearchQuery('')}
              className="orgs-btn-secondary"
            >
              Clear Search Filter
            </Button>
          )}
          {canCreate && !searchQuery && (
            <Button
              variant="default"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={openCreateModal}
              className="orgs-btn-secondary"
            >
              Create First Organization
            </Button>
          )}
        </div>
      ) : (
        <div className="orgs-bento-grid">
          {filteredOrgs.map((org) => (
            <div key={org.id} className="orgs-card">
              {/* Top Identity Row */}
              <div className="orgs-card-header">
                <div className="orgs-card-identity">
                  <div className={`orgs-card-avatar ${org.org_type}`}>
                    {getUnitIcon(org.org_type)}
                  </div>
                  <div className="orgs-card-titles">
                    <h3 className="orgs-card-name" title={org.name}>
                      {org.name}
                    </h3>
                    <div className="orgs-card-code-row">
                      <span className="orgs-card-code-tag">{org.code}</span>
                      <span className={`orgs-card-type-tag ${org.org_type}`}>
                        {org.org_type}
                      </span>
                    </div>
                  </div>
                </div>

                {isSuperAdmin && (
                  <Tooltip label="Delete organization unit">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      size="sm"
                      onClick={() => setDeleteTarget(org)}
                      aria-label="Delete organization"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </div>

              {/* Sub-Unit Context / Parent College */}
              {org.parent_name && (
                <div className="orgs-card-parent-tag">
                  <span>Part of:</span>
                  <strong>{org.parent_code || org.parent_name}</strong>
                </div>
              )}

              {/* Description */}
              <p className="orgs-card-desc">
                {org.description || 'No description provided for this academic unit.'}
              </p>

              {/* Card Footer Action */}
              <div className="orgs-card-footer">
                <div className="orgs-card-member-pill">
                  <IconUsers size={16} style={{ opacity: 0.6 }} />
                  <span>
                    <span className="orgs-card-member-count">{org.member_count ?? 0}</span> Members
                  </span>
                </div>

                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  radius="md"
                  rightSection={<IconArrowRight size={14} />}
                  className="orgs-roster-btn"
                  onClick={() => navigate(`/admin/organizations/${org.id}/members`)}
                >
                  Manage Roster
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create Organization Modal ─── */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={
          <Group gap="xs">
            <IconPlus size={18} />
            <Text fw={700}>
              {isSuperAdmin
                ? 'Create New Organization, Club or Office'
                : 'Create New Department Club or Office'}
            </Text>
          </Group>
        }
        centered
        radius="md"
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
              placeholder="e.g. Robotics Guild, College of Computer Studies"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextInput
              label="Organization Code"
              description="A concise uppercase identifier for badges and attendee records"
              placeholder="e.g. CCS, ROBO-CLUB, FACULTY-DEAN"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Select
              label="Organization Type"
              data={[
                { value: 'club', label: 'Student Club (e.g. Math Club, Developer Student Club)' },
                ...(isSuperAdmin
                  ? [{ value: 'college', label: 'College / Academic Department' }]
                  : []),
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
                  ...(isSuperAdmin
                    ? [{ value: '', label: '(None - Independent University Organization)' }]
                    : []),
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
              label="Description (Optional)"
              placeholder="Brief overview of unit mission or membership..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => setCreateOpened(false)}
                className="orgs-btn-secondary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                className="orgs-btn-primary"
              >
                Create Unit
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ─── Delete Confirmation Modal ─── */}
      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={18} color="red" />
            <Text fw={700}>Delete Organization Unit</Text>
          </Group>
        }
        centered
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete{' '}
            <strong>{deleteTarget?.name}</strong> (<code>{deleteTarget?.code}</code>)?
          </Text>
          <Text size="xs" c="dimmed">
            This action will detach associated child clubs and remove organization membership bindings.
            Individual student attendee biometric profiles will not be deleted.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="orgs-btn-secondary"
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleting}
              onClick={confirmDelete}
              className="orgs-btn-secondary"
            >
              Confirm Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
};
