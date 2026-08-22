import { useState, useEffect, useMemo } from "react";
import {
  Container,
  SimpleGrid,
  Paper,
  Text,
  Title,
  Group,
  Stack,
  Badge,
  Switch,
  TextInput,
  Button,
  Table,
  ThemeIcon,
  Alert,
  Select,
  Box,
  Progress,
} from "@mantine/core";
import {
  IconBuildingArch,
  IconUsers,
  IconChecklist,
  IconDeviceCctv,
  IconServer,
  IconAlertTriangle,
  IconBroadcast,
  IconCheck,
  IconInfoCircle,
  IconEye,
  IconTrash,
  IconCpu,
  IconChartBar,
} from "@tabler/icons-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  getTelemetry,
  updateSystemStatus,
  clearSystemStatus,
  getMultiCampusAnalytics,
} from "../../api/superAdmin";
import type { MultiCampusAnalytics } from "../../api/superAdmin";
import { getInstitutions } from "../../api/institutions";
import { useAsync } from "../../hooks";
import PageHeader from "../../components/layout/PageHeader";

const CAMPUS_COLORS = ["#339af0", "#51cf66", "#fcc419", "#ff922b", "#845ef7", "#20c997"];

export default function SuperAdminDashboardPage() {
  const { data: telemetry, execute: refetchTelemetry } = useAsync(
    () => getTelemetry(),
    true,
  );
  const { data: institutions } = useAsync(
    () => getInstitutions(false),
    true,
  );
  const { data: analytics } = useAsync<MultiCampusAnalytics>(
    () => getMultiCampusAnalytics(),
    true,
  );

  const [maintMode, setMaintMode] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string>("");
  const [targetCampus, setTargetCampus] = useState<string>("all");
  const [bannerType, setBannerType] = useState<string>("orange");
  const [savingStatus, setSavingStatus] = useState(false);
  const [clearingStatus, setClearingStatus] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState(false);

  // Dynamically build broadcast scopes from active institutions
  const scopeOptions = useMemo(() => {
    const list = [
      { value: "all", label: "Global (All Campuses & Landing Page)" },
    ];
    if (institutions && institutions.length > 0) {
      institutions.forEach((inst) => {
        list.push({
          value: inst.code,
          label: `${inst.name} (${inst.code.toUpperCase()} Only)`,
        });
      });
    }
    return list;
  }, [institutions]);

  // Sync state on load
  useEffect(() => {
    if (telemetry?.maintenance) {
      setMaintMode(telemetry.maintenance.maintenance_mode);
      setAnnouncement(telemetry.maintenance.announcement || "");
      if (telemetry.maintenance.target_campus) {
        setTargetCampus(telemetry.maintenance.target_campus);
      }
      if (telemetry.maintenance.banner_type) {
        setBannerType(telemetry.maintenance.banner_type);
      }
    }
  }, [telemetry]);

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    setStatusSuccess(false);
    try {
      await updateSystemStatus({
        maintenance_mode: maintMode,
        announcement,
        target_campus: targetCampus,
        banner_type: bannerType,
      });
      setStatusSuccess(true);
      window.dispatchEvent(new Event("system_status_updated"));
      setTimeout(() => setStatusSuccess(false), 3000);
      refetchTelemetry(true);
    } catch (err) {
      console.error("Failed to update system status", err);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleClearStatus = async () => {
    setClearingStatus(true);
    try {
      await clearSystemStatus();
      setMaintMode(false);
      setAnnouncement("");
      setTargetCampus("all");
      setBannerType("orange");
      setStatusSuccess(true);
      window.dispatchEvent(new Event("system_status_updated"));
      setTimeout(() => setStatusSuccess(false), 3000);
      refetchTelemetry(true);
    } catch (err) {
      console.error("Failed to clear broadcast status", err);
    } finally {
      setClearingStatus(false);
    }
  };

  const counts = telemetry?.counts;
  const platform = telemetry?.platform;
  const vectorEngine = telemetry?.vector_engine;
  const bioTelemetry = analytics?.biometric_telemetry;
  const scannerFleet = analytics?.scanner_fleet;
  const campusShares = analytics?.campus_shares ?? [];
  const dailyAttendance = analytics?.daily_attendance ?? [];

  const fleetPieData = [
    { name: "Online Kiosks", value: scannerFleet?.online ?? 0, color: "#20c997" },
    { name: "Offline / Standby", value: scannerFleet?.offline ?? 0, color: "#868e96" },
  ];

  return (
    <Container size="xl" pt={0} pb="4xl">
      <PageHeader
        title="Global Fleet Telemetry & Platform Diagnostics"
        subtitle="Cross-tenant verification telemetry, biometric vector index health, and multi-campus system administration."
      >
        <Group gap="xs">
          <Badge size="lg" color="teal" variant="light">
            Attendify Core v{platform?.version ?? "2.0.0"}
          </Badge>
          <Badge size="lg" color="blue" variant="dot">
            Multi-Tenant FlatIP
          </Badge>
        </Group>
      </PageHeader>

      {/* Top 4 Global KPI Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              University Tenants
            </Text>
            <ThemeIcon color="blue" variant="light" size="md" radius="md">
              <IconBuildingArch size={18} />
            </ThemeIcon>
          </Group>
          <Title order={2} fw={700}>
            {counts?.active_institutions ?? 0}
            <Text span size="sm" c="dimmed" fw={400} ml={6}>
              / {counts?.total_institutions ?? 0} active
            </Text>
          </Title>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Total Enrolled Students
            </Text>
            <ThemeIcon color="indigo" variant="light" size="md" radius="md">
              <IconUsers size={18} />
            </ThemeIcon>
          </Group>
          <Title order={2} fw={700}>
            {counts?.total_attendees?.toLocaleString() ?? 0}
          </Title>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Verified Attendance Logs
            </Text>
            <ThemeIcon color="teal" variant="light" size="md" radius="md">
              <IconChecklist size={18} />
            </ThemeIcon>
          </Group>
          <Title order={2} fw={700}>
            {counts?.total_checkins?.toLocaleString() ?? 0}
          </Title>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Online Scanner Kiosks
            </Text>
            <ThemeIcon color="cyan" variant="light" size="md" radius="md">
              <IconDeviceCctv size={18} />
            </ThemeIcon>
          </Group>
          <Title order={2} fw={700}>
            {counts?.online_devices ?? 0}
            <Text span size="sm" c="dimmed" fw={400} ml={6}>
              / {counts?.total_devices ?? 0} total
            </Text>
          </Title>
        </Paper>
      </SimpleGrid>

      {/* Visual Section: Multi-Campus Attendance Volume Comparison & Fleet Distribution */}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg" mb="xl">
        {/* Multi-Campus 7-Day Attendance Volume (Takes 2 cols) */}
        <Paper p="lg" radius="md" withBorder style={{ gridColumn: "span 2" }}>
          <Group justify="space-between" mb="md">
            <div>
              <Group gap="xs">
                <ThemeIcon color="blue" variant="light" size="sm" radius="md">
                  <IconChartBar size={16} />
                </ThemeIcon>
                <Title order={4}>Cross-Tenant Daily Verification Volume (Last 7 Days)</Title>
              </Group>
              <Text size="xs" c="dimmed">
                Real-time biometric & QR attendance throughput comparison across university tenants
              </Text>
            </div>
            <Badge color="blue" variant="light">7-Day Telemetry</Badge>
          </Group>

          <Box h={260} w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyAttendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-1)",
                    borderColor: "var(--surface-3)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {institutions?.map((inst, index) => (
                  <Bar
                    key={inst.code}
                    dataKey={inst.code}
                    name={inst.name}
                    fill={CAMPUS_COLORS[index % CAMPUS_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Global Scanner Fleet Distribution Ring Chart */}
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Group gap="xs">
                <ThemeIcon color="cyan" variant="light" size="sm" radius="md">
                  <IconDeviceCctv size={16} />
                </ThemeIcon>
                <Title order={4}>Scanner Fleet Health</Title>
              </Group>
              <Text size="xs" c="dimmed">
                Hardware kiosk heartbeat & connectivity
              </Text>
            </div>
            <Badge color={scannerFleet?.online ? "teal" : "gray"}>
              {scannerFleet?.online ?? 0} Live
            </Badge>
          </Group>

          <Box h={180} w="100%" style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fleetPieData}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {fleetPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Box>

          <Stack gap="xs" mt="xs">
            <Group justify="space-between">
              <Group gap="xs">
                <Box w={10} h={10} style={{ borderRadius: "50%", backgroundColor: "#20c997" }} />
                <Text size="xs">Online Kiosks</Text>
              </Group>
              <Text size="xs" fw={700}>{scannerFleet?.online ?? 0}</Text>
            </Group>
            <Group justify="space-between">
              <Group gap="xs">
                <Box w={10} h={10} style={{ borderRadius: "50%", backgroundColor: "#868e96" }} />
                <Text size="xs">Offline / Standby</Text>
              </Group>
              <Text size="xs" fw={700}>{scannerFleet?.offline ?? 0}</Text>
            </Group>
            <Progress
              value={scannerFleet?.total ? ((scannerFleet.online / scannerFleet.total) * 100) : 100}
              color="teal"
              size="sm"
              radius="xl"
              mt={4}
            />
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* Biometric Vector Engine & Multi-Campus Telemetry Section */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="xl">
        {/* Biometric Engine Performance */}
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Group gap="xs">
                <ThemeIcon color="violet" variant="light" size="sm" radius="md">
                  <IconCpu size={16} />
                </ThemeIcon>
                <Title order={4}>Biometric Engine Health</Title>
              </Group>
              <Text size="xs" c="dimmed">
                InsightFace & FAISS vector fleet status
              </Text>
            </div>
            <Badge color="green" variant="light">Operational</Badge>
          </Group>

          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Recognition Model:</Text>
              <Text size="xs" fw={600}>{bioTelemetry?.model ?? "InsightFace Buffalo_L (512-dim)"}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Vector Engine:</Text>
              <Text size="xs" fw={600}>FAISS FlatIP Per-Tenant Fleet</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Avg Search Latency:</Text>
              <Badge color="blue" size="sm">~{bioTelemetry?.avg_match_latency_ms ?? 1.45} ms</Badge>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Confidence Threshold:</Text>
              <Badge color="teal" size="sm">0.72 (L2 Cosine)</Badge>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Active FAISS Spaces:</Text>
              <Text size="xs" fw={700}>{vectorEngine?.active_indices_count ?? 0} In-Memory</Text>
            </Group>
          </Stack>
        </Paper>

        {/* Multi-Tenant Campus Utilization Breakdown (Takes 2 cols) */}
        <Paper p="lg" radius="md" withBorder style={{ gridColumn: "span 2" }}>
          <Group justify="space-between" mb="md">
            <div>
              <Group gap="xs">
                <ThemeIcon color="indigo" variant="light" size="sm" radius="md">
                  <IconBuildingArch size={16} />
                </ThemeIcon>
                <Title order={4}>University Tenant Telemetry</Title>
              </Group>
              <Text size="xs" c="dimmed">
                Per-campus enrolled students, registered scanners, and verified attendance volume
              </Text>
            </div>
            <Badge color="indigo" variant="light">{campusShares.length} Universities</Badge>
          </Group>

          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>University</Table.Th>
                <Table.Th>Code</Table.Th>
                <Table.Th>Enrolled</Table.Th>
                <Table.Th>Events</Table.Th>
                <Table.Th>Scanners</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campusShares.map((campus) => (
                <Table.Tr key={campus.institution_id}>
                  <Table.Td fw={600}>{campus.name}</Table.Td>
                  <Table.Td><Badge size="xs" variant="outline" color="gray">{campus.code}</Badge></Table.Td>
                  <Table.Td>{campus.attendees.toLocaleString()}</Table.Td>
                  <Table.Td>{campus.events}</Table.Td>
                  <Table.Td>{campus.devices}</Table.Td>
                  <Table.Td>
                    <Badge color={campus.is_active ? "teal" : "gray"} size="xs">
                      {campus.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </SimpleGrid>

      {/* Prominent Section: Platform Maintenance Mode & Global Announcements Controller */}
      <Paper p="xl" radius="md" withBorder mb="xl" bg="var(--surface-1)">
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group gap="sm">
            <ThemeIcon color={maintMode ? "orange" : "blue"} variant="light" size="lg" radius="md">
              {maintMode ? <IconAlertTriangle size={22} /> : <IconBroadcast size={22} />}
            </ThemeIcon>
            <div>
              <Title order={4}>Platform Maintenance & Global Announcements</Title>
              <Text size="xs" c="dimmed">
                Configure instant campus notices, schedule system maintenance, or alert specific university portals.
              </Text>
            </div>
          </Group>

          <Switch
            label="Lockdown Maintenance Mode"
            description="Prevents event check-ins during server upgrades"
            checked={maintMode}
            onChange={(e) => setMaintMode(e.currentTarget.checked)}
            color="orange"
            size="md"
          />
        </Group>

        {statusSuccess && (
          <Alert color="teal" icon={<IconCheck size={16} />} radius="md" mb="md">
            Broadcast status updated and distributed across all active clients!
          </Alert>
        )}

        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Broadcast Scope"
              data={scopeOptions}
              value={targetCampus}
              onChange={(v) => setTargetCampus(v || "all")}
              searchable
              clearable={false}
              allowDeselect={false}
            />
            <Select
              label="Banner Severity Style"
              data={[
                { value: "blue", label: "Informational Notice (Blue)" },
                { value: "orange", label: "Scheduled Maintenance (Orange)" },
                { value: "red", label: "Critical Urgent Alert (Red)" },
              ]}
              value={bannerType}
              onChange={(v) => setBannerType(v || "orange")}
              clearable={false}
              allowDeselect={false}
            />
          </SimpleGrid>

          <TextInput
            label="Announcement Message"
            placeholder="e.g. Scheduled platform maintenance will occur this Sunday from 2:00 AM to 4:00 AM UTC."
            value={announcement}
            onChange={(e) => setAnnouncement(e.currentTarget.value)}
          />

          {/* Live Preview Card */}
          {(announcement || maintMode) && (
            <Box p="xs" style={{ border: "1px dashed var(--surface-3)", borderRadius: 8 }}>
              <Group gap="xs" mb={4}>
                <IconEye size={14} color="var(--text-muted)" />
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Live Banner Preview ({scopeOptions.find((s) => s.value === targetCampus)?.label || targetCampus})
                </Text>
              </Group>
              <Alert
                color={maintMode ? "orange" : bannerType}
                radius="sm"
                variant="filled"
                p="xs"
              >
                <Group justify="center" gap="xs">
                  <IconInfoCircle size={16} />
                  <Text size="xs" fw={600}>
                    {maintMode && "[System Maintenance] "}
                    {announcement || "Scheduled system maintenance is currently in progress."}
                  </Text>
                </Group>
              </Alert>
            </Box>
          )}

          <Group justify="space-between" mt="xs" wrap="wrap">
            {(announcement || maintMode) ? (
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={16} />}
                loading={clearingStatus}
                onClick={handleClearStatus}
              >
                Clear & Dismiss Active Broadcast
              </Button>
            ) : <div />}
            <Button
              color={maintMode ? "orange" : "blue"}
              leftSection={<IconBroadcast size={16} />}
              loading={savingStatus}
              onClick={handleSaveStatus}
            >
              Publish & Broadcast Announcement
            </Button>
          </Group>
        </Stack>
      </Paper>

      {/* Grid: Server Host Diagnostics & Memory */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {/* Vector Engine Memory Table */}
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Title order={4}>Partitioned FAISS Vector Spaces</Title>
              <Text size="xs" c="dimmed">
                Active in-memory biometric vector indexes loaded per university
              </Text>
            </div>
            <Badge color="violet" variant="light">
              {vectorEngine?.active_indices_count ?? 0} Active
            </Badge>
          </Group>

          <Box style={{ maxHeight: 220, overflowY: "auto" }}>
            {vectorEngine?.indices && vectorEngine.indices.length > 0 ? (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>University</Table.Th>
                    <Table.Th>Vectors</Table.Th>
                    <Table.Th>Dim</Table.Th>
                    <Table.Th>Idle</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {vectorEngine.indices.map((idx) => (
                    <Table.Tr key={idx.institution_id}>
                      <Table.Td fw={500}>{idx.institution_name}</Table.Td>
                      <Table.Td>{idx.vector_count} embs</Table.Td>
                      <Table.Td>{idx.dimension}-d</Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={idx.idle_seconds > 1800 ? "orange" : "teal"}>
                          {Math.floor(idx.idle_seconds / 60)}m
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No active event sessions. Vector indices load on-demand when sessions activate.
              </Text>
            )}
          </Box>
        </Paper>

        {/* Server Host Diagnostics */}
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Title order={4}>Host Server Diagnostics</Title>
              <Text size="xs" c="dimmed">
                Process resource allocation and backend engine state
              </Text>
            </div>
            <ThemeIcon color="gray" variant="light">
              <IconServer size={18} />
            </ThemeIcon>
          </Group>

          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm">Resident Process Memory (RSS):</Text>
              <Badge size="lg" variant="light" color="blue">
                {platform?.rss_memory_mb ?? 0} MB
              </Badge>
            </Group>

            <Group justify="space-between">
              <Text size="sm">System Uptime:</Text>
              <Text size="sm" fw={600}>
                {Math.floor((platform?.uptime_seconds ?? 0) / 3600)}h {Math.floor(((platform?.uptime_seconds ?? 0) % 3600) / 60)}m
              </Text>
            </Group>

            <Group justify="space-between">
              <Text size="sm">InsightFace Model State:</Text>
              <Badge color="green">Buffalo_L (Loaded)</Badge>
            </Group>

            <Group justify="space-between">
              <Text size="sm">Vector Search Strategy:</Text>
              <Text size="sm" c="dimmed">Partitioned In-Memory Cosine L2</Text>
            </Group>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Container>
  );
}
