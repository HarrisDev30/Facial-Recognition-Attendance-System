import { useState } from "react";
import {
  Container,
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
  Avatar,
  Switch,
  Tooltip,
} from "@mantine/core";
import {
  IconPlus,
  IconAlertCircle,
  IconPower,
  IconEdit,
  IconKey,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import {
  getSuperAdminInstitutions,
  onboardInstitution,
  updateInstitution,
  resetInstitutionAdmin,
  toggleInstitutionActive,
} from "../../api/superAdmin";
import type { InstitutionItem, InstitutionOnboardRequest } from "../../api/superAdmin";
import { useAsync } from "../../hooks";
import DataTable from "../../components/shared/DataTable";
import PageHeader from "../../components/layout/PageHeader";
import BrandCustomizerWithPreview from "../../components/super-admin/BrandCustomizerWithPreview";

export default function SuperAdminInstitutionsPage() {
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

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: institutions, loading, execute: refetchInstitutions, setData: setInstitutionsData } = useAsync(
    () => getSuperAdminInstitutions(),
    true,
  );

  const instList = institutions ?? [];

  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code === name.toLowerCase().replace(/[^a-z0-9]/g, "")) {
      setCode(val.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
  };

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
      setModalOpen(false);
      setName("");
      setCode("");
      setLogoUrl("");
      setBrandColor("#0070f3");
      setAdminEmail("");
      setAdminPassword("");
      refetchInstitutions(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to onboard institution");
    } finally {
      setSubmitting(false);
    }
  };

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
      setEditModalOpen(false);
      refetchInstitutions(true);
    } catch (err: any) {
      setEditError(err.response?.data?.detail || "Failed to update institution");
    } finally {
      setEditSubmitting(false);
    }
  };

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
      setResetSuccess(`Password successfully updated for ${res.email}!`);
      refetchInstitutions(true);
    } catch (err: any) {
      setResetError(err.response?.data?.detail || "Failed to reset admin password");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    setTogglingId(id);
    setInstitutionsData((prev) =>
      prev ? prev.map((inst) => (inst.id === id ? { ...inst, is_active: !inst.is_active } : inst)) : prev
    );

    try {
      await toggleInstitutionActive(id);
      await refetchInstitutions(true);
    } catch (err) {
      console.error("Failed to toggle status", err);
      refetchInstitutions(true);
    } finally {
      setTogglingId(null);
    }
  };

  const columns = [
    {
      key: "institution",
      label: "University Tenant",
      render: (row: InstitutionItem) => (
        <Group gap="sm">
          <Avatar
            src={row.logo_url}
            radius="md"
            style={{ border: `2px solid ${row.brand_color || "#0070f3"}` }}
          >
            {row.code.toUpperCase().slice(0, 3)}
          </Avatar>
          <div>
            <Group gap={6} align="center">
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: row.brand_color || "#0070f3",
                  display: "inline-block",
                }}
              />
              <Text size="sm" fw={600}>
                {row.name}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              attendify.app/{row.code}
            </Text>
          </div>
        </Group>
      ),
    },
    {
      key: "code",
      label: "Slug / Code",
      render: (row: InstitutionItem) => (
        <Badge variant="outline" color="gray" size="sm">
          {row.code}
        </Badge>
      ),
    },
    {
      key: "attendees",
      label: "Students",
      render: (row: InstitutionItem) => <Text size="sm">{row.attendee_count}</Text>,
    },
    {
      key: "events",
      label: "Events",
      render: (row: InstitutionItem) => <Text size="sm">{row.event_count}</Text>,
    },
    {
      key: "devices",
      label: "Scanners",
      render: (row: InstitutionItem) => <Text size="sm">{row.device_count}</Text>,
    },
    {
      key: "admin",
      label: "Primary Admin",
      render: (row: InstitutionItem) => (
        <Text size="xs" c="dimmed">
          {row.admin_email ?? "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: InstitutionItem) => (
        <Badge color={row.is_active ? "teal" : "gray"} size="sm">
          {row.is_active ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: InstitutionItem) => (
        <Group gap="xs">
          <Tooltip label="Edit Tenant Details">
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={() => openEditModal(row)}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Reset Admin Password">
            <ActionIcon
              variant="subtle"
              color="orange"
              onClick={() => openResetModal(row)}
            >
              <IconKey size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={row.is_active ? "Deactivate Tenant" : "Activate Tenant"}>
            <ActionIcon
              variant="light"
              color={row.is_active ? "red" : "teal"}
              loading={togglingId === row.id}
              onClick={() => handleToggleActive(row.id)}
            >
              <IconPower size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <Container size="xl" pt={0} pb="4xl">
      <PageHeader
        title="University Tenants"
        subtitle="Manage multi-tenant campuses, edit university branding, and govern administrator access."
      >
        <Button
          color="blue"
          leftSection={<IconPlus size={16} />}
          onClick={() => setModalOpen(true)}
        >
          Onboard University Tenant
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={instList}
        loading={loading}
        emptyMessage="No university tenants registered."
      />

      {/* Onboard University Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Onboard New University Tenant"
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
              required
            />

            <TextInput
              label="Tenant Slug / Campus Subdomain"
              placeholder="e.g. addu"
              description="Used in campus URL routing (e.g. attendify.app/addu)"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              required
            />

            <TextInput
              label="University Logo URL (Optional)"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.currentTarget.value)}
            />

            <BrandCustomizerWithPreview
              value={brandColor}
              onChange={setBrandColor}
              institutionCode={code || "CAMPUS"}
              institutionName={name || "University"}
            />

            <Text fw={600} size="sm" mt="xs">
              Primary Administrator Credentials
            </Text>

            <Group grow>
              <TextInput
                label="Admin First Name"
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.currentTarget.value)}
              />
              <TextInput
                label="Admin Last Name"
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.currentTarget.value)}
              />
            </Group>

            <TextInput
              label="Admin Email Address"
              placeholder="admin@university.edu.ph"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.currentTarget.value)}
              required
            />

            <PasswordInput
              label="Initial Administrator Password"
              placeholder="Minimum 6 characters"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.currentTarget.value)}
              required
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" color="blue" loading={submitting}>
                Onboard & Create Tenant
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit University Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Tenant: ${editingInst?.name || ""}`}
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
              required
            />

            <TextInput
              label="Tenant Slug / Campus Code"
              description="Warning: Changing the slug affects login URLs (/slug/login)"
              value={editCode}
              onChange={(e) => setEditCode(e.currentTarget.value)}
              required
            />

            <TextInput
              label="University Logo URL"
              placeholder="https://example.com/logo.png"
              value={editLogoUrl}
              onChange={(e) => setEditLogoUrl(e.currentTarget.value)}
            />

            <BrandCustomizerWithPreview
              value={editBrandColor}
              onChange={setEditBrandColor}
              institutionCode={editCode || "CAMPUS"}
              institutionName={editName || "University"}
            />

            <Switch
              label="Active Status"
              description="Deactivating locks campus users and scanner check-ins"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.currentTarget.checked)}
              color="teal"
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" color="blue" loading={editSubmitting}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Reset Admin Password Modal */}
      <Modal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={`Reset Admin Password: ${resetInst?.name || ""}`}
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

            <Text size="sm" c="dimmed">
              Primary Administrator Account: <strong>{resetInst?.admin_email || "Not Configured"}</strong>
            </Text>

            <PasswordInput
              label="New Administrator Password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              required
            />

            <Group justify="space-between" mt="md">
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconCopy size={14} />}
                onClick={() => {
                  navigator.clipboard.writeText(newPassword);
                }}
              >
                Copy Password
              </Button>
              <Group gap="xs">
                <Button variant="default" onClick={() => setResetModalOpen(false)}>
                  Close
                </Button>
                <Button type="submit" color="orange" loading={resetSubmitting}>
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
