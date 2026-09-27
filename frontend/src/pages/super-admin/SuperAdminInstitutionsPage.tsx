import { useState, useMemo } from "react";
import {
  Container,
  SimpleGrid,
  Text,
  Badge,
  Button,
  Group,
  Modal,
  TextInput,
  PasswordInput,
  Stack,
  ActionIcon,
  Alert,
  Switch,
  Tooltip,
  Table,
  Checkbox,
  Box,
  Skeleton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconAlertCircle,
  IconPower,
  IconEdit,
  IconKey,
  IconCheck,
  IconCopy,
  IconSearch,
  IconBuildingArch,
  IconUsers,
  IconDeviceCctv,
  IconExternalLink,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import {
  getSuperAdminInstitutions,
  onboardInstitution,
  updateInstitution,
  resetInstitutionAdmin,
  toggleInstitutionActive,
  batchToggleInstitutionsActive,
  type InstitutionItem,
  type InstitutionOnboardRequest,
} from "../../api/superAdmin";
import { useAsync } from "../../hooks";
import PageHeader from "../../components/layout/PageHeader";
import BrandCustomizerWithPreview from "../../components/super-admin/BrandCustomizerWithPreview";
import { getApiError } from "../../utils/error";
import "./SuperAdminDashboardPage.css";

export default function SuperAdminInstitutionsPage() {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  // Selection state for Bulk / Batch operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Onboard modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#0070f3");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("University");
  const [adminLastName, setAdminLastName] = useState("Administrator");

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingInst, setEditingInst] = useState<InstitutionItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editBrandColor, setEditBrandColor] = useState("#0070f3");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset Admin Password state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetInst, setResetInst] = useState<InstitutionItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const { data: institutions, loading, execute: refetchInstitutions, setData: setInstitutionsData } = useAsync(
    () => getSuperAdminInstitutions(),
    true
  );

  const instList = institutions ?? [];

  // Filtered institutions
  const filteredInstitutions = useMemo(() => {
    return instList.filter((inst) => {
      if (statusFilter === "active" && !inst.is_active) return false;
      if (statusFilter === "suspended" && inst.is_active) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = inst.name.toLowerCase().includes(q);
        const matchesCode = inst.code.toLowerCase().includes(q);
        const matchesEmail = (inst.admin_email || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesEmail) return false;
      }
      return true;
    });
  }, [instList, statusFilter, searchQuery]);

  // Bulk Selection Handlers
  const allFilteredIds = useMemo(() => filteredInstitutions.map((i) => i.id), [filteredInstitutions]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.includes(id));
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allFilteredIds);
    }
  };

  const handleToggleRowSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code === name.toLowerCase().replace(/[^a-z0-9]/g, "")) {
      setCode(val.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
  };

  // Onboard Action
  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: InstitutionOnboardRequest = {
        name: name.trim(),
        code: code.trim().toLowerCase(),
        logo_url: logoUrl.trim() || undefined,
        brand_color: brandColor.trim() || "#0070f3",
        admin_email: adminEmail.trim().toLowerCase(),
        admin_password: adminPassword,
        admin_first_name: adminFirstName.trim() || "University",
        admin_last_name: adminLastName.trim() || "Administrator",
      };

      await onboardInstitution(payload);
      notifications.show({
        title: "Campus Onboarded",
        message: `${payload.name} (${payload.code}) successfully created.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setModalOpen(false);
      setName("");
      setCode("");
      setLogoUrl("");
      setBrandColor("#0070f3");
      setAdminEmail("");
      setAdminPassword("");
      refetchInstitutions(true);
    } catch (err: any) {
      setError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Action
  const openEditModal = (inst: InstitutionItem) => {
    setEditingInst(inst);
    setEditName(inst.name);
    setEditCode(inst.code);
    setEditLogoUrl(inst.logo_url || "");
    setEditBrandColor(inst.brand_color || "#0070f3");
    setEditIsActive(inst.is_active);
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;
    setEditSubmitting(true);
    setEditError(null);

    try {
      await updateInstitution(editingInst.id, {
        name: editName.trim(),
        code: editCode.trim().toLowerCase(),
        logo_url: editLogoUrl.trim() || null,
        brand_color: editBrandColor.trim() || "#0070f3",
        is_active: editIsActive,
      });
      notifications.show({
        title: "Tenant Updated",
        message: `Settings saved for ${editName}.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setEditModalOpen(false);
      refetchInstitutions(true);
    } catch (err: any) {
      setEditError(getApiError(err));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Reset Password Action
  const openResetModal = (inst: InstitutionItem) => {
    setResetInst(inst);
    setNewPassword("Password123!");
    setResetSuccess(null);
    setResetError(null);
    setResetModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetInst) return;
    setResetSubmitting(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await resetInstitutionAdmin(resetInst.id, newPassword);
      setResetSuccess(`Password updated for ${res.email}!`);
      notifications.show({
        title: "Password Reset Complete",
        message: res.message,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      refetchInstitutions(true);
    } catch (err: any) {
      setResetError(getApiError(err));
    } finally {
      setResetSubmitting(false);
    }
  };

  // Toggle Active
  const handleToggleActive = async (inst: InstitutionItem) => {
    try {
      const res = await toggleInstitutionActive(inst.id);
      setInstitutionsData((prev) =>
        prev ? prev.map((i) => (i.id === inst.id ? { ...i, is_active: res.is_active } : i)) : prev
      );
      notifications.show({
        title: res.is_active ? "Campus Activated" : "Campus Suspended",
        message: `${inst.name} is now ${res.is_active ? "live and operational" : "suspended"}.`,
        color: res.is_active ? "teal" : "orange",
        icon: <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({
        title: "Action Failed",
        message: getApiError(err),
        color: "red",
      });
    }
  };

  // Batch Toggle Active
  const handleBatchToggleActive = async (setActive: boolean) => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    try {
      await batchToggleInstitutionsActive(selectedIds, setActive);
      setInstitutionsData((prev) =>
        prev
          ? prev.map((i) => (selectedIds.includes(i.id) ? { ...i, is_active: setActive } : i))
          : prev
      );
      notifications.show({
        title: setActive ? "Bulk Campuses Activated" : "Bulk Campuses Suspended",
        message: `${selectedIds.length} university tenant(s) updated.`,
        color: setActive ? "teal" : "orange",
        icon: <IconCheck size={16} />,
      });
      setSelectedIds([]);
    } catch (err) {
      notifications.show({
        title: "Bulk Action Failed",
        message: getApiError(err),
        color: "red",
      });
    } finally {
      setBatchLoading(false);
    }
  };

  const totalCampuses = instList.length;
  const activeCampuses = instList.filter((i) => i.is_active).length;
  const totalRoster = instList.reduce((sum, i) => sum + (i.attendee_count || 0), 0);
  const totalFleet = instList.reduce((sum, i) => sum + (i.device_count || 0), 0);

  if (loading && instList.length === 0) {
    return (
      <Container size="xl" pt={0} pb="4xl" className="superadmin-container">
        <Skeleton height={100} radius={18} mb="md" />
        <Skeleton height={420} radius={18} />
      </Container>
    );
  }

  return (
    <Container size="xl" pt={0} pb="4xl" className="superadmin-container">
      {/* ─── 1. Standard Page Header ─── */}
      <PageHeader
        title="University Tenants Directory"
        subtitle="Govern multi-tenant campuses, customize university branding, reset credentials, and monitor roster scale."
      >
        <Group gap="xs">
          <Button
            size="xs"
            variant="filled"
            leftSection={<IconPlus size={14} />}
            onClick={() => setModalOpen(true)}
            className="superadmin-btn-primary"
          >
            Onboard University
          </Button>
          <Tooltip label="Refresh tenant roster">
            <ActionIcon
              variant="default"
              size="input-xs"
              onClick={() => refetchInstitutions(true)}
              className="superadmin-btn-secondary"
              aria-label="Refresh"
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </PageHeader>

      {/* ─── 2. Operations Telemetry Tiles ─── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="md">
        <div className="superadmin-telemetry-tile">
          <div className="superadmin-telemetry-tile-top">
            <span className="superadmin-telemetry-tile-title">Total Tenants</span>
            <IconBuildingArch size={14} color="var(--brand-primary, #0070f3)" />
          </div>
          <div className="superadmin-telemetry-tile-value">{totalCampuses}</div>
          <span className="superadmin-telemetry-tile-sub">Registered university tenants</span>
        </div>

        <div className="superadmin-telemetry-tile">
          <div className="superadmin-telemetry-tile-top">
            <span className="superadmin-telemetry-tile-title">Active Campuses</span>
            <IconCheck size={14} color="#10b981" />
          </div>
          <div className="superadmin-telemetry-tile-value" style={{ color: "#10b981" }}>
            {activeCampuses}
          </div>
          <span className="superadmin-telemetry-tile-sub">Online institutional portals</span>
        </div>

        <div className="superadmin-telemetry-tile">
          <div className="superadmin-telemetry-tile-top">
            <span className="superadmin-telemetry-tile-title">Enrolled Students</span>
            <IconUsers size={14} color="#3b82f6" />
          </div>
          <div className="superadmin-telemetry-tile-value">{totalRoster.toLocaleString()}</div>
          <span className="superadmin-telemetry-tile-sub">Global biometric roster</span>
        </div>

        <div className="superadmin-telemetry-tile">
          <div className="superadmin-telemetry-tile-top">
            <span className="superadmin-telemetry-tile-title">Hardware Gates</span>
            <IconDeviceCctv size={14} color="#8b5cf6" />
          </div>
          <div className="superadmin-telemetry-tile-value">{totalFleet}</div>
          <span className="superadmin-telemetry-tile-sub">Edge scanner stations</span>
        </div>
      </SimpleGrid>

      {/* ─── 3. Object-Based Data Table Card with Zero Horizontal Scroll ─── */}
      <div className="superadmin-bento-card">
        {/* Table Toolbar: Search + Filter Chips */}
        <div className="superadmin-card-toolbar">
          <TextInput
            placeholder="Search university name, slug (/code), or admin email..."
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            size="xs"
            radius="md"
            className="superadmin-search-input"
          />
          <Group gap={6}>
            <Button
              size="compact-xs"
              variant={statusFilter === "all" ? "filled" : "default"}
              onClick={() => setStatusFilter("all")}
            >
              All ({instList.length})
            </Button>
            <Button
              size="compact-xs"
              color="teal"
              variant={statusFilter === "active" ? "filled" : "light"}
              onClick={() => setStatusFilter("active")}
            >
              Active ({activeCampuses})
            </Button>
            <Button
              size="compact-xs"
              color="orange"
              variant={statusFilter === "suspended" ? "filled" : "light"}
              onClick={() => setStatusFilter("suspended")}
            >
              Suspended ({totalCampuses - activeCampuses})
            </Button>
          </Group>
        </div>

        {/* ─── 4. Dynamic Sticky Batch Actions Bar ─── */}
        {selectedIds.length > 0 && (
          <Box
            mb="sm"
            p="xs"
            style={{
              background: "rgba(0, 112, 243, 0.08)",
              border: "1px solid var(--brand-primary, #0070f3)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Group gap="xs">
              <Badge size="sm" color="blue" variant="filled">
                {selectedIds.length} Campus(es) Selected
              </Badge>
              <Text size="xs" c="var(--text-secondary)">
                Choose batch status action:
              </Text>
            </Group>

            <Group gap={6}>
              <Button
                size="compact-xs"
                variant="light"
                color="teal"
                leftSection={<IconCheck size={12} />}
                loading={batchLoading}
                onClick={() => handleBatchToggleActive(true)}
              >
                Batch Activate
              </Button>
              <Button
                size="compact-xs"
                variant="light"
                color="orange"
                leftSection={<IconPower size={12} />}
                loading={batchLoading}
                onClick={() => handleBatchToggleActive(false)}
              >
                Batch Suspend
              </Button>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => setSelectedIds([])}
                aria-label="Deselect All"
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Box>
        )}

        {/* ─── 5. Compact Zero-Scroll Table ─── */}
        <div className="superadmin-table-container">
          <Table verticalSpacing="xs" horizontalSpacing="sm" className="superadmin-data-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: "42px", textAlign: "center" }}>
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={handleToggleSelectAll}
                    size="xs"
                    aria-label="Select all tenants"
                  />
                </Table.Th>
                <Table.Th style={{ width: "26%" }}>University & Portal Slug</Table.Th>
                <Table.Th style={{ width: "22%" }}>Roster & Infrastructure</Table.Th>
                <Table.Th style={{ width: "20%" }}>Tenant Administrator</Table.Th>
                <Table.Th style={{ width: "16%", whiteSpace: "nowrap" }}>Status</Table.Th>
                <Table.Th style={{ width: "16%", textAlign: "right", whiteSpace: "nowrap" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredInstitutions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: "28px 12px" }}>
                    <Text size="xs" c="dimmed">
                      {searchQuery ? `No campuses match "${searchQuery}"` : "Zero registered institutions found."}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredInstitutions.map((inst) => {
                  const isSelected = selectedIds.includes(inst.id);

                  return (
                    <Table.Tr
                      key={inst.id}
                      style={{
                        background: isSelected ? "rgba(0, 112, 243, 0.04)" : undefined,
                      }}
                    >
                      {/* Checkbox */}
                      <Table.Td style={{ textAlign: "center" }}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleRowSelect(inst.id)}
                          size="xs"
                          aria-label={`Select ${inst.name}`}
                        />
                      </Table.Td>

                      {/* University & Slug */}
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <span
                            className="superadmin-brand-swatch"
                            style={{ background: inst.brand_color || "#0070f3" }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <Text size="xs" fw={600} c="var(--text-primary)" truncate>
                              {inst.name}
                            </Text>
                            <Group gap={6} wrap="nowrap">
                              <Text size="10.5px" c="dimmed" style={{ fontFamily: "var(--font-mono)" }}>
                                /{inst.code}
                              </Text>
                              <Tooltip label="Public Student Portal" withArrow>
                                <ActionIcon
                                  size="16px"
                                  variant="subtle"
                                  color="gray"
                                  component="a"
                                  href={`/${inst.code.toLowerCase()}`}
                                  target="_blank"
                                  aria-label="Portal Link"
                                >
                                  <IconExternalLink size={11} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </div>
                        </Group>
                      </Table.Td>

                      {/* Roster & Infrastructure Badges */}
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <Badge size="compact-xs" variant="light" color="blue">
                            👥 {inst.attendee_count}
                          </Badge>
                          <Badge size="compact-xs" variant="light" color="violet">
                            📅 {inst.event_count}
                          </Badge>
                          <Badge size="compact-xs" variant="outline" color="gray">
                            📡 {inst.device_count}
                          </Badge>
                        </Group>
                      </Table.Td>

                      {/* Administrator */}
                      <Table.Td>
                        <div style={{ minWidth: 0 }}>
                          <Text size="11px" c="var(--text-secondary)" truncate title={inst.admin_email || ""}>
                            {inst.admin_email || "Not Configured"}
                          </Text>
                        </div>
                      </Table.Td>

                      {/* Status (Anti-Truncation Guaranteed) */}
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        <Group gap={6} wrap="nowrap" style={{ flexWrap: "nowrap" }}>
                          <Badge
                            size="xs"
                            color={inst.is_active ? "teal" : "gray"}
                            variant={inst.is_active ? "light" : "outline"}
                            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                          >
                            {inst.is_active ? "Active" : "Suspended"}
                          </Badge>
                          <Tooltip
                            label={inst.is_active ? "Suspend campus" : "Activate campus"}
                            withArrow
                          >
                            <Switch
                              checked={inst.is_active}
                              onChange={() => handleToggleActive(inst)}
                              color="teal"
                              size="xs"
                            />
                          </Tooltip>
                        </Group>
                      </Table.Td>

                      {/* Actions */}
                      <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div className="superadmin-table-actions-group">
                          <Tooltip label="Edit Tenant Details" withArrow>
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              size="xs"
                              onClick={() => openEditModal(inst)}
                              aria-label="Edit Tenant"
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="Reset Admin Password" withArrow>
                            <ActionIcon
                              variant="subtle"
                              color="orange"
                              size="xs"
                              onClick={() => openResetModal(inst)}
                              aria-label="Reset Password"
                            >
                              <IconKey size={14} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="Launch Public Portal" withArrow>
                            <ActionIcon
                              variant="default"
                              size="xs"
                              component="a"
                              href={`/${inst.code.toLowerCase()}`}
                              target="_blank"
                              aria-label="Open Portal"
                            >
                              <IconExternalLink size={12} />
                            </ActionIcon>
                          </Tooltip>
                        </div>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </div>
      </div>

      {/* ─── 6. Onboard University Modal ─── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <Group gap="xs">
            <IconBuildingArch size={18} color="var(--brand-primary, #0070f3)" />
            <Text fw={700} size="sm">
              Onboard New University Tenant
            </Text>
          </Group>
        }
        centered
        radius="lg"
        size="lg"
      >
        <form onSubmit={handleOnboard}>
          <Stack gap="md">
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
                {error}
              </Alert>
            )}

            <TextInput
              label="University / Institution Name"
              placeholder="e.g. Ateneo de Davao University"
              value={name}
              onChange={(e) => handleNameChange(e.currentTarget.value)}
              size="xs"
              required
            />

            <TextInput
              label="Tenant Slug / Campus Code"
              placeholder="e.g. addu"
              description="Used in public routing: attendify.app/{slug}"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              size="xs"
              required
            />

            <TextInput
              label="University Logo URL (Optional)"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.currentTarget.value)}
              size="xs"
            />

            <BrandCustomizerWithPreview
              value={brandColor}
              onChange={setBrandColor}
              institutionCode={code || "CAMPUS"}
              institutionName={name || "University"}
            />

            <Text fw={700} size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }} mt="xs">
              Primary Administrator Setup
            </Text>

            <Group grow gap="xs">
              <TextInput
                label="Admin First Name"
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.currentTarget.value)}
                size="xs"
              />
              <TextInput
                label="Admin Last Name"
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.currentTarget.value)}
                size="xs"
              />
            </Group>

            <TextInput
              label="Admin Email Address"
              placeholder="admin@university.edu.ph"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.currentTarget.value)}
              size="xs"
              required
            />

            <PasswordInput
              label="Initial Password"
              placeholder="Minimum 6 characters"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.currentTarget.value)}
              size="xs"
              required
            />

            <Group justify="flex-end" mt="md" gap="xs">
              <Button variant="default" size="xs" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="xs" className="superadmin-btn-primary" loading={submitting}>
                Onboard & Launch Tenant
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ─── 7. Edit University Modal ─── */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={
          <Group gap="xs">
            <IconEdit size={18} color="var(--brand-primary, #0070f3)" />
            <Text fw={700} size="sm">
              Edit Tenant: {editingInst?.name || ""}
            </Text>
          </Group>
        }
        centered
        radius="lg"
        size="md"
      >
        <form onSubmit={handleEditSubmit}>
          <Stack gap="md">
            {editError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
                {editError}
              </Alert>
            )}

            <TextInput
              label="University / Institution Name"
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
              size="xs"
              required
            />

            <TextInput
              label="Tenant Slug / Campus Code"
              description="Warning: Changing the slug alters login URLs (/slug/login)"
              value={editCode}
              onChange={(e) => setEditCode(e.currentTarget.value)}
              size="xs"
              required
            />

            <TextInput
              label="University Logo URL"
              placeholder="https://example.com/logo.png"
              value={editLogoUrl}
              onChange={(e) => setEditLogoUrl(e.currentTarget.value)}
              size="xs"
            />

            <BrandCustomizerWithPreview
              value={editBrandColor}
              onChange={setEditBrandColor}
              institutionCode={editCode || "CAMPUS"}
              institutionName={editName || "University"}
            />

            <Switch
              label="Active Status"
              description="Deactivating locks campus portal login and biometric scanners"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.currentTarget.checked)}
              color="teal"
              size="sm"
            />

            <Group justify="flex-end" mt="md" gap="xs">
              <Button variant="default" size="xs" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="xs" className="superadmin-btn-primary" loading={editSubmitting}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ─── 8. Reset Admin Password Modal ─── */}
      <Modal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={
          <Group gap="xs">
            <IconKey size={18} color="#f59e0b" />
            <Text fw={700} size="sm">
              Reset Admin Password: {resetInst?.name || ""}
            </Text>
          </Group>
        }
        centered
        radius="lg"
        size="md"
      >
        <form onSubmit={handleResetPassword}>
          <Stack gap="md">
            {resetSuccess && (
              <Alert icon={<IconCheck size={16} />} color="teal" radius="md">
                {resetSuccess}
              </Alert>
            )}
            {resetError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
                {resetError}
              </Alert>
            )}

            <Box p="xs" style={{ background: "var(--surface-0)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
              <Text size="xs" c="dimmed">
                Primary Administrator Email:
              </Text>
              <Text size="xs" fw={700} c="var(--text-primary)">
                {resetInst?.admin_email || "No admin user found"}
              </Text>
            </Box>

            <PasswordInput
              label="New Administrator Password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              size="xs"
              required
            />

            <Group justify="space-between" mt="md">
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconCopy size={13} />}
                onClick={() => {
                  navigator.clipboard.writeText(newPassword);
                  notifications.show({ title: "Copied", message: "Password copied to clipboard.", color: "blue" });
                }}
              >
                Copy Password
              </Button>
              <Group gap="xs">
                <Button variant="default" size="xs" onClick={() => setResetModalOpen(false)}>
                  Close
                </Button>
                <Button type="submit" size="xs" color="orange" loading={resetSubmitting}>
                  Update Password
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
