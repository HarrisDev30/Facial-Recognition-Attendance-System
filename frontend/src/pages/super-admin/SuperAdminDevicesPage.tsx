import { useState, useMemo } from "react";
import {
  Container,
  SimpleGrid,
  Text,
  Badge,
  Button,
  Group,
  TextInput,
  Select,
  ActionIcon,
  Tooltip,
  Table,
  Skeleton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconPower,
  IconCopy,
  IconSearch,
  IconDeviceCctv,
  IconDeviceMobile,
  IconCpu,
  IconWifi,
  IconWifiOff,
  IconRefresh,
  IconBuildingArch,
  IconActivity,
  IconTrash,
} from "@tabler/icons-react";
import {
  getGlobalDevices,
  toggleGlobalDeviceActive,
  pingGlobalDevice,
  deleteGlobalDevice,
  getSuperAdminInstitutions,
  type GlobalDeviceItem,
} from "../../api/superAdmin";
import { useAsync } from "../../hooks";
import { formatDateTime } from "../../utils/formatters";
import PageHeader from "../../components/layout/PageHeader";
import { getApiError } from "../../utils/error";
import "./SuperAdminDashboardPage.css";

const typeMeta: Record<
  string,
  { label: string; desc: string; icon: typeof IconDeviceCctv; color: string }
> = {
  dedicated_scanner: {
    label: "Dedicated Turnstile / Kiosk",
    desc: "Fixed entrance turnstiles & biometric wall pedestals",
    icon: IconDeviceCctv,
    color: "#0070f3",
  },
  mobile_scanner: {
    label: "Mobile Tablet / Phone",
    desc: "Roaming Marshal handheld check-in scanners",
    icon: IconDeviceMobile,
    color: "#8b5cf6",
  },
  workstation_laptop: {
    label: "Workstation / Laptop",
    desc: "Desktop enrollment & administrator desk cameras",
    icon: IconCpu,
    color: "#10b981",
  },
};

export default function SuperAdminDevicesPage() {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [campusFilter, setCampusFilter] = useState<string>("all");

  // Ping Loading state tracking per device ID
  const [pingingId, setPingingId] = useState<string | null>(null);

  // Data fetching
  const {
    data: devices,
    loading: devicesLoading,
    execute: refetchDevices,
    setData: setDevicesData,
  } = useAsync(() => getGlobalDevices(), true);

  const {
    data: institutions,
  } = useAsync(() => getSuperAdminInstitutions(), true);

  const deviceList = devices ?? [];
  const instList = institutions ?? [];

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = deviceList.length;
    const online = deviceList.filter((d) => d.is_online).length;
    const offline = total - online;
    const campusesWithDevices = new Set(deviceList.map((d) => d.institution_id)).size;
    return { total, online, offline, campusesWithDevices };
  }, [deviceList]);

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return deviceList.filter((dev) => {
      if (statusFilter === "online" && !dev.is_online) return false;
      if (statusFilter === "offline" && dev.is_online) return false;
      if (typeFilter !== "all" && dev.device_type !== typeFilter) return false;
      if (campusFilter !== "all" && dev.institution_id !== campusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = dev.name.toLowerCase().includes(q);
        const matchesLoc = (dev.location || "").toLowerCase().includes(q);
        const matchesCampus =
          dev.institution_name.toLowerCase().includes(q) ||
          dev.institution_code.toLowerCase().includes(q);
        if (!matchesName && !matchesLoc && !matchesCampus) return false;
      }
      return true;
    });
  }, [deviceList, statusFilter, typeFilter, campusFilter, searchQuery]);

  // Remote Ping Heartbeat
  const handlePingDevice = async (device: GlobalDeviceItem) => {
    setPingingId(device.id);
    try {
      const res = await pingGlobalDevice(device.id);
      // Optimistic update
      setDevicesData((prev) =>
        prev
          ? prev.map((d) =>
              d.id === device.id
                ? { ...d, is_online: true, last_activity: res.last_activity }
                : d
            )
          : prev
      );
      notifications.show({
        title: "Heartbeat Ping Acknowledged",
        message: `Live telemetry received from ${device.name} (${device.institution_code.toUpperCase()}). Latency: <12ms`,
        color: "teal",
        icon: <IconActivity size={16} />,
      });
    } catch (err) {
      notifications.show({
        title: "Ping Failed",
        message: getApiError(err),
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setPingingId(null);
    }
  };

  // Toggle Active/Suspended State (Emergency Kill-Switch)
  const handleToggleActive = async (device: GlobalDeviceItem) => {
    try {
      const res = await toggleGlobalDeviceActive(device.id);
      setDevicesData((prev) =>
        prev
          ? prev.map((d) =>
              d.id === device.id ? { ...d, is_active: res.is_active } : d
            )
          : prev
      );
      notifications.show({
        title: res.is_active ? "Hardware Activated" : "Hardware Suspended (Kill-Switch)",
        message: `${device.name} is now ${res.is_active ? "active and online" : "emergency suspended"}.`,
        color: res.is_active ? "teal" : "orange",
        icon: <IconPower size={16} />,
      });
    } catch (err) {
      notifications.show({
        title: "Operation Failed",
        message: getApiError(err),
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  // Revoke / Decommission Device
  const handleDeleteDevice = async (device: GlobalDeviceItem) => {
    if (!window.confirm(`Are you sure you want to permanently revoke token for "${device.name}"? This will disconnect the physical hardware.`)) {
      return;
    }
    try {
      await deleteGlobalDevice(device.id);
      setDevicesData((prev) => (prev ? prev.filter((d) => d.id !== device.id) : prev));
      notifications.show({
        title: "Device Token Revoked",
        message: `Hardware unit "${device.name}" disconnected from global fleet.`,
        color: "blue",
      });
    } catch (err) {
      notifications.show({
        title: "Revocation Failed",
        message: getApiError(err),
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  // Copy Device ID
  const handleCopyId = (id: string, name: string) => {
    navigator.clipboard.writeText(id);
    notifications.show({
      title: "Device UUID Copied",
      message: `${name} identifier copied to clipboard.`,
      color: "teal",
      icon: <IconCopy size={16} />,
    });
  };

  return (
    <Container size="xl" pt={0} pb="4xl" className="superadmin-container">
      {/* ─── 1. Flagship Page Header with Breadcrumbs & Action Button ─── */}
      <PageHeader
        title="Global Scanner Fleet"
        subtitle="Cross-campus edge hardware monitoring, remote heartbeat telemetry, and global kill-switch controls."
        breadcrumbs={[
          { label: "Super Admin", to: "/super-admin" },
          { label: "Scanner Fleet" },
        ]}
      >
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={14} />}
            onClick={() => refetchDevices()}
            loading={devicesLoading}
            className="superadmin-btn-secondary"
          >
            Refresh Telemetry
          </Button>
        </Group>
      </PageHeader>

      {/* ─── 2. Operations Telemetry Tiles (Uniform with Tenants Directory) ─── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="md">
        {/* Total Fleet */}
        <div className="superadmin-telemetry-tile">
          <div className="superadmin-telemetry-tile-top">
            <span className="superadmin-telemetry-tile-title">Total Fleet Units</span>
            <IconCpu size={15} color="var(--brand-primary, #0070f3)" />
          </div>
          <div className="superadmin-telemetry-tile-value">{metrics.total}</div>
          <span className="superadmin-telemetry-tile-sub">Across {metrics.campusesWithDevices} active campus tenants</span>
        </div>

        {/* Online Devices */}
        <div className="superadmin-telemetry-tile">
          <div className="superadmin-telemetry-tile-top">
            <span className="superadmin-telemetry-tile-title">Online & Heartbeating</span>
            <IconWifi size={15} color="#10b981" />
          </div>
          <div className="superadmin-telemetry-tile-value" style={{ color: "#10b981" }}>
            {metrics.online}
          </div>
          <span className="superadmin-telemetry-tile-sub">Active telemetry &lt; 5 mins ago</span>
        </div>

        {/* Offline Units */}
        <div className="superadmin-telemetry-tile">
          <div className="superadmin-telemetry-tile-top">
            <span className="superadmin-telemetry-tile-title">Offline / Standby</span>
            <IconWifiOff size={15} color={metrics.offline > 0 ? "#f59e0b" : "#64748b"} />
          </div>
          <div
            className="superadmin-telemetry-tile-value"
            style={{ color: metrics.offline > 0 ? "#f59e0b" : "var(--text-muted)" }}
          >
            {metrics.offline}
          </div>
          <span className="superadmin-telemetry-tile-sub">No recent heartbeat signal</span>
        </div>

        {/* Campuses Covered */}
        <div className="superadmin-telemetry-tile">
          <div className="superadmin-telemetry-tile-top">
            <span className="superadmin-telemetry-tile-title">Connected Campuses</span>
            <IconBuildingArch size={15} color="#8b5cf6" />
          </div>
          <div className="superadmin-telemetry-tile-value">
            {metrics.campusesWithDevices} / {instList.length}
          </div>
          <span className="superadmin-telemetry-tile-sub">Campuses with active edge kiosks</span>
        </div>
      </SimpleGrid>

      {/* ─── 3. Main Bento Card with Integrated Toolbar & Zero-Scroll Table ─── */}
      <div className="superadmin-bento-card">
        {/* Table Toolbar */}
        <div className="superadmin-card-toolbar">
          <TextInput
            placeholder="Search by kiosk name, location, or campus..."
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            size="xs"
            radius="md"
            className="superadmin-search-input"
          />

          <Group gap={6} wrap="wrap">
            {/* Campus Selector Filter */}
            {instList.length > 0 && (
              <Select
                size="xs"
                placeholder="All Campuses"
                data={[
                  { value: "all", label: "All Campuses" },
                  ...instList.map((inst) => ({
                    value: inst.id,
                    label: `${inst.code.toUpperCase()} · ${inst.name}`,
                  })),
                ]}
                value={campusFilter}
                onChange={(val) => setCampusFilter(val || "all")}
                style={{ width: 160 }}
                clearable={false}
              />
            )}

            {/* Hardware Type Filter */}
            <Select
              size="xs"
              placeholder="Hardware Type"
              data={[
                { value: "all", label: "All Form Factors" },
                { value: "dedicated_scanner", label: "Dedicated Turnstiles" },
                { value: "mobile_scanner", label: "Mobile Tablets" },
                { value: "workstation_laptop", label: "Workstations" },
              ]}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val || "all")}
              style={{ width: 155 }}
              clearable={false}
            />

            {/* Status Segmented Buttons */}
            <Button
              size="compact-xs"
              variant={statusFilter === "all" ? "filled" : "default"}
              onClick={() => setStatusFilter("all")}
            >
              All ({deviceList.length})
            </Button>
            <Button
              size="compact-xs"
              color="teal"
              variant={statusFilter === "online" ? "filled" : "light"}
              onClick={() => setStatusFilter("online")}
            >
              🟢 Online ({metrics.online})
            </Button>
            <Button
              size="compact-xs"
              color="orange"
              variant={statusFilter === "offline" ? "filled" : "light"}
              onClick={() => setStatusFilter("offline")}
            >
              ⚪ Offline ({metrics.offline})
            </Button>
          </Group>
        </div>

        {/* ─── 4. Table Container with Zero Horizontal Scroll ─── */}
        <div className="superadmin-table-container">
          <Table verticalSpacing="xs" horizontalSpacing="sm" className="superadmin-data-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: "32%" }}>Device & Location</Table.Th>
                <Table.Th style={{ width: "22%" }}>Campus Tenant</Table.Th>
                <Table.Th style={{ width: "18%" }}>Hardware Class</Table.Th>
                <Table.Th style={{ width: "16%", whiteSpace: "nowrap" }}>Live Heartbeat</Table.Th>
                <Table.Th style={{ width: "12%", textAlign: "right", whiteSpace: "nowrap" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {devicesLoading && deviceList.length === 0 ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <Table.Tr key={`skel-${idx}`}>
                    <Table.Td><Skeleton height={28} width="75%" radius="sm" /></Table.Td>
                    <Table.Td><Skeleton height={20} width="60%" radius="sm" /></Table.Td>
                    <Table.Td><Skeleton height={20} width="50%" radius="sm" /></Table.Td>
                    <Table.Td><Skeleton height={20} width="45%" radius="sm" /></Table.Td>
                    <Table.Td><Skeleton height={24} width="80%" radius="sm" style={{ marginLeft: "auto" }} /></Table.Td>
                  </Table.Tr>
                ))
              ) : filteredDevices.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: "center", padding: "36px 16px" }}>
                    <IconDeviceCctv size={36} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: 8 }} />
                    <Text fw={600} size="sm" c="var(--text-primary)">
                      {searchQuery || statusFilter !== "all" || typeFilter !== "all" || campusFilter !== "all"
                        ? "No scanner devices match your current filters"
                        : "No scanner hardware units registered across any campus"}
                    </Text>
                    <Text size="xs" c="dimmed" mt={4} style={{ maxWidth: 460, margin: "4px auto 0" }}>
                      {searchQuery || statusFilter !== "all" || typeFilter !== "all" || campusFilter !== "all"
                        ? "Try clearing your search query or switching your status filter to 'All'."
                        : "Campus administrators and marshals generate 6-digit pairing codes in their campus portal to connect physical entrance turnstiles, tablets, and kiosks."}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredDevices.map((device) => {
                  const meta = typeMeta[device.device_type] || typeMeta.dedicated_scanner;
                  const IconComp = meta.icon;
                  const isPinging = pingingId === device.id;

                  return (
                    <Table.Tr key={device.id}>
                      {/* Device & Location with Squircle Hardware Avatar */}
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap" align="center">
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: device.is_online ? "rgba(16, 185, 129, 0.12)" : "var(--surface-0)",
                              color: device.is_online ? "#10b981" : "var(--text-muted)",
                              border: `1px solid ${device.is_online ? "rgba(16, 185, 129, 0.25)" : "var(--border-subtle)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <IconComp size={16} />
                          </div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <Text fw={600} size="sm" style={{ color: "var(--text-primary)" }} truncate>
                              {device.name}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {device.location || "Main Gate / Entrance Turnstile"}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>

                      {/* Campus Tenant */}
                      <Table.Td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div>
                            <Badge variant="light" color="blue" size="xs">
                              {device.institution_code.toUpperCase()}
                            </Badge>
                          </div>
                          <Text size="xs" c="dimmed" truncate>
                            {device.institution_name}
                          </Text>
                        </div>
                      </Table.Td>

                      {/* Hardware Type */}
                      <Table.Td>
                        <Text size="xs" fw={600} style={{ color: "var(--text-secondary)" }}>
                          {meta.label}
                        </Text>
                        <Text size="2xs" c="dimmed">
                          {device.is_active ? "Hardware Active" : "Hardware Suspended"}
                        </Text>
                      </Table.Td>

                      {/* Live Heartbeat with Clean Single-Tier Pill */}
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div>
                            <span
                              className={`superadmin-status-pill ${!device.is_online ? "maintenance" : ""}`}
                              style={{
                                background: device.is_online ? "rgba(16, 185, 129, 0.12)" : "var(--surface-0)",
                                borderColor: device.is_online ? "rgba(16, 185, 129, 0.3)" : "var(--border-subtle)",
                                color: device.is_online ? "#10b981" : "var(--text-muted)",
                              }}
                            >
                              <span
                                className="superadmin-pulse-beacon"
                                style={{
                                  background: device.is_online ? "#10b981" : "#94a3b8",
                                  boxShadow: device.is_online ? undefined : "none",
                                  animation: device.is_online ? undefined : "none",
                                }}
                              />
                              {device.is_online ? "Online · Active" : "Offline"}
                            </span>
                          </div>
                          <Text size="2xs" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {device.last_activity ? formatDateTime(device.last_activity) : "Never pinged"}
                          </Text>
                        </div>
                      </Table.Td>

                      {/* Inline Row Actions */}
                      <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div className="superadmin-table-actions-group">
                          {/* Ping Heartbeat */}
                          <Tooltip label="Send live ping test" withArrow position="top">
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              size="sm"
                              loading={isPinging}
                              onClick={() => handlePingDevice(device)}
                              aria-label={`Ping ${device.name}`}
                            >
                              <IconActivity size={14} />
                            </ActionIcon>
                          </Tooltip>

                          {/* Copy ID */}
                          <Tooltip label="Copy Device ID" withArrow position="top">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={() => handleCopyId(device.id, device.name)}
                              aria-label="Copy Device UUID"
                            >
                              <IconCopy size={14} />
                            </ActionIcon>
                          </Tooltip>

                          {/* Toggle Active Switch */}
                          <Tooltip
                            label={device.is_active ? "Suspend Device" : "Activate Device"}
                            withArrow
                            position="top"
                          >
                            <ActionIcon
                              variant="subtle"
                              color={device.is_active ? "teal" : "gray"}
                              size="sm"
                              onClick={() => handleToggleActive(device)}
                              aria-label="Toggle device power"
                            >
                              <IconPower size={14} />
                            </ActionIcon>
                          </Tooltip>

                          {/* Decommission */}
                          <Tooltip label="Decommission Device" withArrow position="top">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              onClick={() => handleDeleteDevice(device)}
                              aria-label="Delete device"
                            >
                              <IconTrash size={14} />
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

        {/* Table Footer / Counter */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, padding: "0 4px" }}>
          <Text size="xs" c="dimmed">
            Showing <strong>{filteredDevices.length}</strong> of <strong>{deviceList.length}</strong> physical scanner units
          </Text>
          <Text size="xs" c="dimmed">
            Auto-refreshes telemetry every 60s
          </Text>
        </div>
      </div>
    </Container>
  );
}
