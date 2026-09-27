import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  SimpleGrid,
  Text,
  Group,
  Stack,
  Badge,
  TextInput,
  PasswordInput,
  Button,
  Table,
  Box,
  Modal,
  ColorInput,
  ActionIcon,
  Tooltip,
  Skeleton,
  RingProgress,
  Center,
} from "@mantine/core";
import { Sparkline } from "@mantine/charts";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingArch,
  IconDeviceCctv,
  IconCheck,
  IconRefresh,
  IconCpu,
  IconKey,
  IconPlus,
  IconSearch,
  IconExternalLink,
  IconPower,
  IconBroadcast,
  IconArrowRight,
} from "@tabler/icons-react";
import {
  getTelemetry,
  getSuperAdminInstitutions,
  getGlobalDevices,
  onboardInstitution,
  toggleInstitutionActive,
  resetInstitutionAdmin,
  type PlatformTelemetry,
  type InstitutionItem,
  type GlobalDeviceItem,
  type InstitutionOnboardRequest,
} from "../../api/superAdmin";
import { getApiError } from "../../utils/error";
import "./SuperAdminDashboardPage.css";

export default function SuperAdminDashboardPage() {
  const [telemetry, setTelemetry] = useState<PlatformTelemetry | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [devices, setDevices] = useState<GlobalDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states
  const [instSearch, setInstSearch] = useState("");
  const [instStatusFilter, setInstStatusFilter] = useState<"all" | "active" | "suspended">("all");

  // Onboarding Modal state
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState<InstitutionOnboardRequest>({
    name: "",
    code: "",
    brand_color: "#0070f3",
    admin_email: "",
    admin_password: "",
    admin_first_name: "University",
    admin_last_name: "Administrator",
  });
  const [onboarding, setOnboarding] = useState(false);

  // Password Reset Modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedInstForReset, setSelectedInstForReset] = useState<InstitutionItem | null>(null);
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const fetchAllData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const [telemRes, instRes, devRes] = await Promise.all([
        getTelemetry().catch(() => null),
        getSuperAdminInstitutions().catch(() => []),
        getGlobalDevices().catch(() => []),
      ]);

      if (telemRes) setTelemetry(telemRes);
      setInstitutions(instRes);
      setDevices(devRes);
    } catch (err) {
      console.error("Failed loading super admin data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filtered institutions
  const filteredInstitutions = useMemo(() => {
    return institutions.filter((inst) => {
      if (instStatusFilter === "active" && !inst.is_active) return false;
      if (instStatusFilter === "suspended" && inst.is_active) return false;
      if (instSearch.trim()) {
        const q = instSearch.toLowerCase().trim();
        const matchesName = inst.name.toLowerCase().includes(q);
        const matchesCode = inst.code.toLowerCase().includes(q);
        const matchesEmail = (inst.admin_email || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesEmail) return false;
      }
      return true;
    });
  }, [institutions, instSearch, instStatusFilter]);

  const totalOnlineDevices = telemetry?.counts?.online_devices ?? devices.filter((d) => d.is_online).length;
  const totalFleetDevices = telemetry?.counts?.total_devices ?? devices.length;
  const totalAttendees = telemetry?.counts?.total_attendees ?? institutions.reduce((s, i) => s + (i.attendee_count || 0), 0);
  const totalCheckins = telemetry?.counts?.total_checkins ?? 0;
  const activeCampusesCount = institutions.filter((i) => i.is_active).length;
  const onlineRate = totalFleetDevices > 0 ? Math.round((totalOnlineDevices / totalFleetDevices) * 100) : 100;
  const maintMode = telemetry?.maintenance?.maintenance_mode ?? false;

  // Sparkline data for check-in velocity
  const velocitySparkline = totalCheckins > 0 
    ? [Math.max(1, Math.round(totalCheckins * 0.25)), Math.max(1, Math.round(totalCheckins * 0.6)), totalCheckins] 
    : [2, 5, 8];

  // Action: Toggle Active status (Kill-switch)
  const handleToggleActive = async (inst: InstitutionItem) => {
    try {
      const res = await toggleInstitutionActive(inst.id);
      setInstitutions((prev) =>
        prev.map((i) => (i.id === inst.id ? { ...i, is_active: res.is_active } : i))
      );
      notifications.show({
        title: res.is_active ? "Campus Activated" : "Campus Suspended",
        message: `${inst.name} is now ${res.is_active ? "live and active" : "suspended"}.`,
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

  // Action: Onboard Institution
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.name.trim() || !onboardForm.code.trim() || !onboardForm.admin_email.trim() || !onboardForm.admin_password.trim()) {
      notifications.show({ title: "Validation Error", message: "All required fields must be filled.", color: "red" });
      return;
    }

    setOnboarding(true);
    try {
      const res = await onboardInstitution({
        ...onboardForm,
        code: onboardForm.code.trim().toLowerCase(),
        admin_email: onboardForm.admin_email.trim().toLowerCase(),
      });
      notifications.show({
        title: "Campus Onboarded Successfully",
        message: `${res.name} (${res.code}) created with admin ${res.admin_email}.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setOnboardModalOpen(false);
      setOnboardForm({
        name: "",
        code: "",
        brand_color: "#0070f3",
        admin_email: "",
        admin_password: "",
        admin_first_name: "University",
        admin_last_name: "Administrator",
      });
      fetchAllData(true);
    } catch (err) {
      notifications.show({
        title: "Onboarding Failed",
        message: getApiError(err),
        color: "red",
      });
    } finally {
      setOnboarding(false);
    }
  };

  // Action: Reset Admin Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstForReset || !newAdminPassword.trim()) return;

    setResettingPassword(true);
    try {
      const res = await resetInstitutionAdmin(selectedInstForReset.id, newAdminPassword.trim());
      notifications.show({
        title: "Password Reset Complete",
        message: res.message,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setResetModalOpen(false);
      setSelectedInstForReset(null);
      setNewAdminPassword("");
    } catch (err) {
      notifications.show({
        title: "Reset Failed",
        message: getApiError(err),
        color: "red",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  if (loading) {
    return (
      <Container size="xl" pt={0} pb="4xl" className="superadmin-container">
        <Skeleton height={140} radius={20} mb="md" />
        <Skeleton height={380} radius={18} mb="md" />
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Skeleton height={320} radius={18} />
          <Skeleton height={320} radius={18} />
        </SimpleGrid>
      </Container>
    );
  }

  return (
    <Container size="xl" pt={0} pb="4xl" className="superadmin-container">
      {/* ─── 1. Flagship Executive Split Header Card ─── */}
      <div className="superadmin-header-card">
        {/* Left Column: Platform Identity & Status */}
        <div className="superadmin-identity-col">
          <div className="superadmin-title-group">
            <span className="superadmin-eyebrow">Enterprise Platform Controller</span>
            <h1 className="superadmin-greeting-title">Mission Control & Multi-Campus Fleet</h1>
            <span className="superadmin-sub-tagline">
              Multi-Tenant Biometric Orchestrator • Global Engine v{telemetry?.platform?.version ?? "2.0"}
            </span>
          </div>

          <div className="superadmin-credential-stack">
            <span className="superadmin-id-tag">
              SCOPE: GLOBAL MULTI-TENANT
            </span>

            <span className={`superadmin-status-pill ${maintMode ? "maintenance" : ""}`}>
              {maintMode ? (
                <>
                  <IconPower size={12} />
                  <span>Maintenance Mode Active</span>
                </>
              ) : (
                <>
                  <span className="superadmin-pulse-beacon" />
                  <span>All Systems Operational</span>
                </>
              )}
            </span>

            <span className="superadmin-id-tag">
              CPU: {telemetry?.platform?.cpu_percent ?? 1.5}%
            </span>
          </div>

          <div className="superadmin-cta-row">
            <Button
              size="xs"
              variant="filled"
              leftSection={<IconPlus size={14} />}
              onClick={() => setOnboardModalOpen(true)}
              className="superadmin-btn-primary"
            >
              Onboard Campus
            </Button>
            <Button
              size="xs"
              variant="default"
              component={Link}
              to="/super-admin/broadcasts"
              leftSection={<IconBroadcast size={14} />}
              className="superadmin-btn-secondary"
            >
              Broadcast Hub
            </Button>
            <Tooltip label="Refresh global telemetry">
              <ActionIcon
                variant="default"
                size="input-xs"
                loading={refreshing}
                onClick={() => fetchAllData(true)}
                className="superadmin-btn-secondary"
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {/* Right Column: 3 Flagship Visual Telemetry Frames */}
        <div className="superadmin-visual-frame">
          {/* Frame 1: Enterprise Ecosystem Scale */}
          <div className="superadmin-visual-slide">
            <span className="superadmin-slide-category">Campus Ecosystem</span>
            <div className="superadmin-slide-gauge-row">
              <div>
                <div className="superadmin-slide-big-metric">{institutions.length}</div>
                <span className="superadmin-slide-subtext">{activeCampusesCount} Active • {totalAttendees.toLocaleString()} Roster</span>
              </div>
              <RingProgress
                size={44}
                thickness={4}
                roundCaps
                sections={[{ value: 100, color: "teal.6" }]}
                label={
                  <Center>
                    <IconBuildingArch size={14} color="#10b981" />
                  </Center>
                }
              />
            </div>
            <span className="superadmin-slide-subtext" style={{ fontSize: "10.5px" }}>
              Tier-1 Multi-Tenant Isolation
            </span>
          </div>

          {/* Frame 2: Ingress Flow Velocity */}
          <div className="superadmin-visual-slide">
            <span className="superadmin-slide-category">Ingress Velocity</span>
            <div className="superadmin-slide-chart">
              <Sparkline
                w="100%"
                h={36}
                data={velocitySparkline}
                color="blue.6"
                fillOpacity={0.22}
                curveType="natural"
              />
            </div>
            <div className="superadmin-slide-big-metric" style={{ fontSize: "1.45rem" }}>
              {totalCheckins.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>verifications</span>
            </div>
            <span className="superadmin-slide-subtext" style={{ fontSize: "10.5px" }}>
              Sub-Second Touchless Gate Clearance
            </span>
          </div>

          {/* Frame 3: Hardware Edge Gateway Fleet */}
          <div className="superadmin-visual-slide">
            <span className="superadmin-slide-category">Hardware Fleet SLA</span>
            <div className="superadmin-slide-gauge-row">
              <div>
                <div className="superadmin-slide-big-metric">
                  {totalOnlineDevices}
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    /{totalFleetDevices}
                  </span>
                </div>
                <span className="superadmin-slide-subtext">
                  {totalFleetDevices > 0 && totalOnlineDevices === totalFleetDevices
                    ? "100% Gates responding"
                    : `${totalFleetDevices - totalOnlineDevices} Offline Gate(s)`}
                </span>
              </div>
              <RingProgress
                size={44}
                thickness={4}
                roundCaps
                sections={[{ value: onlineRate, color: totalOnlineDevices === totalFleetDevices && totalFleetDevices > 0 ? "teal.6" : "orange.5" }]}
                label={
                  <Center>
                    <IconDeviceCctv size={13} style={{ opacity: 0.85 }} />
                  </Center>
                }
              />
            </div>
            <span className="superadmin-slide-subtext" style={{ fontSize: "10.5px" }}>
              {onlineRate}% Fleet Operational SLA
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. Campus Tenants Card Deck (Zero Horizontal Scroll!) ─── */}
      <div className="superadmin-bento-card">
        <div className="superadmin-card-header">
          <div className="superadmin-card-heading-group">
            <h2 className="superadmin-card-heading">Registered Campus Tenants</h2>
            <span className="superadmin-card-subheading">
              Multi-tenant university management, credential resets, and dedicated portal routing
            </span>
          </div>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              component={Link}
              to="/super-admin/institutions"
              rightSection={<IconArrowRight size={13} />}
            >
              All Universities
            </Button>
            <Button
              size="xs"
              variant="filled"
              leftSection={<IconPlus size={14} />}
              onClick={() => setOnboardModalOpen(true)}
              className="superadmin-btn-primary"
            >
              Onboard Campus
            </Button>
          </Group>
        </div>

        {/* Toolbar with Search & Filter Chips */}
        <div className="superadmin-card-toolbar">
          <TextInput
            placeholder="Search campus name, slug, or admin email..."
            leftSection={<IconSearch size={14} />}
            value={instSearch}
            onChange={(e) => setInstSearch(e.currentTarget.value)}
            size="xs"
            radius="md"
            className="superadmin-search-input"
          />
          <Group gap={6}>
            <Button
              size="compact-xs"
              variant={instStatusFilter === "all" ? "filled" : "default"}
              onClick={() => setInstStatusFilter("all")}
            >
              All ({institutions.length})
            </Button>
            <Button
              size="compact-xs"
              color="teal"
              variant={instStatusFilter === "active" ? "filled" : "light"}
              onClick={() => setInstStatusFilter("active")}
            >
              Active ({institutions.filter((i) => i.is_active).length})
            </Button>
            <Button
              size="compact-xs"
              color="gray"
              variant={instStatusFilter === "suspended" ? "filled" : "light"}
              onClick={() => setInstStatusFilter("suspended")}
            >
              Suspended ({institutions.filter((i) => !i.is_active).length})
            </Button>
          </Group>
        </div>

        {/* Compact Zero-Scroll Campus Tenants Table */}
        <div className="superadmin-table-container">
          <Table verticalSpacing="xs" horizontalSpacing="sm" className="superadmin-data-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: "28%" }}>University & Slug</Table.Th>
                <Table.Th style={{ width: "20%" }}>Roster & Gates</Table.Th>
                <Table.Th style={{ width: "22%" }}>Administrator Contact</Table.Th>
                <Table.Th style={{ width: "15%", whiteSpace: "nowrap" }}>Status</Table.Th>
                <Table.Th style={{ width: "15%", textAlign: "right", whiteSpace: "nowrap" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredInstitutions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: "center", padding: "28px 12px" }}>
                    <Text size="xs" c="dimmed">
                      {instSearch ? `No campus matching "${instSearch}"` : "No institutions onboarded yet."}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredInstitutions.map((inst) => (
                  <Table.Tr key={inst.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <span
                          className="superadmin-brand-swatch"
                          style={{ background: inst.brand_color || "#0070f3" }}
                          title={`Brand: ${inst.brand_color || "#0070f3"}`}
                        />
                        <div style={{ minWidth: 0 }}>
                          <Text size="xs" fw={600} c="var(--text-primary)" truncate>
                            {inst.name}
                          </Text>
                          <Text size="10.5px" c="dimmed" style={{ fontFamily: "var(--font-mono)" }}>
                            /{inst.code}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Badge size="xs" variant="light" color="blue">
                          👥 {inst.attendee_count}
                        </Badge>
                        <Badge size="xs" variant="outline" color="gray">
                          📡 {inst.device_count}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="11px" c="var(--text-secondary)" truncate title={inst.admin_email || ""}>
                        {inst.admin_email || "None"}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Badge
                        size="xs"
                        color={inst.is_active ? "teal" : "gray"}
                        variant={inst.is_active ? "light" : "outline"}
                        style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                      >
                        {inst.is_active ? "Active" : "Suspended"}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div className="superadmin-table-actions-group">
                        <Tooltip label={inst.is_active ? "Suspend Campus" : "Activate Campus"} withArrow>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color={inst.is_active ? "red" : "teal"}
                            onClick={() => handleToggleActive(inst)}
                            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                          >
                            {inst.is_active ? "Suspend" : "Activate"}
                          </Button>
                        </Tooltip>
                        <Tooltip label="Reset Admin Password" withArrow>
                          <ActionIcon
                            variant="default"
                            size="xs"
                            onClick={() => {
                              setSelectedInstForReset(inst);
                              setNewAdminPassword("");
                              setResetModalOpen(true);
                            }}
                            aria-label="Reset Admin Password"
                          >
                            <IconKey size={12} />
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
                ))
              )}
            </Table.Tbody>
          </Table>
        </div>
      </div>

      {/* ─── 3. Hardware Fleet Telemetry & Quick Action Deck ─── */}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        {/* Hardware Fleet Quick Card */}
        <div className="superadmin-bento-card">
          <div className="superadmin-card-header">
            <div className="superadmin-card-heading-group">
              <h2 className="superadmin-card-heading">Hardware Gateway Fleet</h2>
              <span className="superadmin-card-subheading">
                Live edge telemetry across campus access points
              </span>
            </div>
            <Button
              size="xs"
              variant="subtle"
              component={Link}
              to="/super-admin/devices"
              rightSection={<IconArrowRight size={13} />}
            >
              Fleet View
            </Button>
          </div>

          <div className="superadmin-telemetry-duo">
            <div className="superadmin-telemetry-tile">
              <div className="superadmin-telemetry-tile-top">
                <span className="superadmin-telemetry-tile-title">Live Gates Online</span>
                <IconDeviceCctv size={14} color="var(--brand-primary, #0070f3)" />
              </div>
              <div className="superadmin-telemetry-tile-value">
                {totalOnlineDevices} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>/ {totalFleetDevices}</span>
              </div>
              <span className="superadmin-telemetry-tile-sub">Active edge kiosks</span>
            </div>

            <div className="superadmin-telemetry-tile">
              <div className="superadmin-telemetry-tile-top">
                <span className="superadmin-telemetry-tile-title">Host Server RAM</span>
                <IconCpu size={14} color="#10b981" />
              </div>
              <div className="superadmin-telemetry-tile-value">
                {telemetry?.platform?.rss_memory_mb ?? 145} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>MB</span>
              </div>
              <span className="superadmin-telemetry-tile-sub">CPU {telemetry?.platform?.cpu_percent ?? 1.5}% load</span>
            </div>
          </div>

          <Stack gap="xs" mt="xs">
            {devices.slice(0, 4).map((dev) => (
              <Group key={dev.id} justify="space-between" p="xs" style={{ background: "var(--surface-0)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <Group gap="xs">
                  <IconDeviceCctv size={14} color="var(--text-secondary)" />
                  <div>
                    <Text size="xs" fw={600} c="var(--text-primary)">{dev.name}</Text>
                    <Text size="10px" c="dimmed">{dev.institution_name} • {dev.location || "Main Gate"}</Text>
                  </div>
                </Group>
                <Badge size="xs" color={dev.is_online ? "teal" : "red"} variant="light">
                  {dev.is_online ? "Live Online" : "Offline"}
                </Badge>
              </Group>
            ))}
          </Stack>
        </div>

        {/* Multi-Campus Broadcast & Incident Preview Card */}
        <div className="superadmin-bento-card">
          <div className="superadmin-card-header">
            <div className="superadmin-card-heading-group">
              <h2 className="superadmin-card-heading">Broadcast Announcements</h2>
              <span className="superadmin-card-subheading">
                Multi-campus advisory banners and emergency kill-switch
              </span>
            </div>
            <Button
              size="xs"
              variant="subtle"
              component={Link}
              to="/super-admin/broadcasts"
              rightSection={<IconArrowRight size={13} />}
            >
              Broadcast Hub
            </Button>
          </div>

          <Box p="md" mb="md" className="superadmin-switch-box">
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" fw={600} c="var(--text-primary)">
                  Global Platform Ingress State
                </Text>
                <Text size="10px" c="dimmed">
                  {maintMode ? "Biometric check-ins disabled (Emergency Mode)" : "All campus check-ins operating normally"}
                </Text>
              </div>
              <Badge size="sm" color={maintMode ? "red" : "teal"} variant="light">
                {maintMode ? "Maintenance Active" : "Operational"}
              </Badge>
            </Group>
          </Box>

          {telemetry?.maintenance?.announcement ? (
            <div className="superadmin-active-announcement-card">
              <Group gap="xs">
                <Badge size="xs" color="teal" variant="light">
                  Target: {telemetry.maintenance.target_campus?.toUpperCase() || "GLOBAL"}
                </Badge>
                <Text size="xs" fw={500} c="var(--text-primary)">
                  "{telemetry.maintenance.announcement}"
                </Text>
              </Group>
            </div>
          ) : (
            <Box p="lg" ta="center" style={{ background: "var(--surface-0)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
              <IconBroadcast size={24} style={{ opacity: 0.3, margin: "0 auto 6px" }} />
              <Text size="xs" fw={600} c="var(--text-primary)">
                No Active Broadcast Notices
              </Text>
              <Text size="10.5px" c="dimmed" mt={2} mb="xs">
                Publish targeted downtime or advisory alerts to campus entrance gates.
              </Text>
              <Button
                size="compact-xs"
                variant="default"
                component={Link}
                to="/super-admin/broadcasts"
                className="superadmin-btn-secondary"
              >
                Create Announcement
              </Button>
            </Box>
          )}
        </div>
      </SimpleGrid>

      {/* ─── Modal 1: Onboard Campus Modal ─── */}
      <Modal
        opened={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        title={
          <Group gap="xs">
            <IconBuildingArch size={18} color="var(--brand-primary, #0070f3)" />
            <Text fw={700} size="md">
              Onboard New University / Campus
            </Text>
          </Group>
        }
        centered
        size="md"
        radius="lg"
      >
        <form onSubmit={handleOnboardSubmit}>
          <Stack gap="sm">
            <TextInput
              label="University / Institution Name"
              placeholder="e.g. Silicon Valley State University"
              required
              value={onboardForm.name}
              onChange={(e) => {
                const name = e.currentTarget.value;
                const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
                setOnboardForm((prev) => ({
                  ...prev,
                  name,
                  code: prev.code === "" || prev.code === autoSlug.slice(0, -1) ? autoSlug : prev.code,
                }));
              }}
              size="sm"
            />

            <TextInput
              label="Campus Slug / URL Code"
              description="Used for dedicated portal routing (e.g. /svsu)"
              placeholder="e.g. svsu"
              required
              value={onboardForm.code}
              onChange={(e) => setOnboardForm((prev) => ({ ...prev, code: e.currentTarget.value }))}
              size="sm"
            />

            <ColorInput
              label="Primary Brand Color"
              value={onboardForm.brand_color || "#0070f3"}
              onChange={(val) => setOnboardForm((prev) => ({ ...prev, brand_color: val }))}
              size="sm"
            />

            <TextInput
              label="Initial University Admin Email"
              type="email"
              placeholder="admin@university.edu"
              required
              value={onboardForm.admin_email}
              onChange={(e) => setOnboardForm((prev) => ({ ...prev, admin_email: e.currentTarget.value }))}
              size="sm"
            />

            <PasswordInput
              label="Initial Admin Password"
              placeholder="Enter secure initial password"
              required
              value={onboardForm.admin_password}
              onChange={(e) => setOnboardForm((prev) => ({ ...prev, admin_password: e.currentTarget.value }))}
              size="sm"
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setOnboardModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="superadmin-btn-primary" loading={onboarding}>
                Onboard University
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ─── Modal 2: Reset Admin Password Modal ─── */}
      <Modal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={
          <Group gap="xs">
            <IconKey size={18} color="var(--brand-primary, #0070f3)" />
            <Text fw={700} size="md">
              Reset Admin Password
            </Text>
          </Group>
        }
        centered
        size="sm"
        radius="lg"
      >
        <form onSubmit={handleResetPasswordSubmit}>
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              Set a new password for the primary administrator account of <strong>{selectedInstForReset?.name}</strong> ({selectedInstForReset?.admin_email}).
            </Text>

            <PasswordInput
              label="New Admin Password"
              placeholder="Enter new password (min 6 chars)"
              required
              minLength={6}
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.currentTarget.value)}
              size="sm"
              autoFocus
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setResetModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="superadmin-btn-primary" loading={resettingPassword}>
                Update Password
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
