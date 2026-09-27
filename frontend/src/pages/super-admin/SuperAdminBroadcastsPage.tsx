import { useState, useEffect, useMemo } from "react";
import {
  Container,
  Text,
  Group,
  Stack,
  Badge,
  Switch,
  TextInput,
  Textarea,
  Button,
  Box,
  Skeleton,
  Table,
  Checkbox,
  ActionIcon,
  Tooltip,
  Modal,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBroadcast,
  IconAlertTriangle,
  IconPower,
  IconCheck,
  IconRefresh,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconSearch,
  IconCircleCheck,
  IconX,
  IconBuildingArch,
} from "@tabler/icons-react";
import PageHeader from "../../components/layout/PageHeader";
import {
  getTelemetry,
  getSuperAdminInstitutions,
  updateSystemStatus,
  clearSystemStatus,
  toggleInstitutionActive,
  batchToggleInstitutionsActive,
  type InstitutionItem,
} from "../../api/superAdmin";
import { getApiError } from "../../utils/error";
import "./SuperAdminDashboardPage.css";

const PRESET_TEMPLATES = [
  {
    label: "⚡ Gate Maintenance",
    text: "Scheduled gate gateway firmware synchronization tonight at 10:00 PM. Biometric check-ins remain operational.",
    severity: "orange",
  },
  {
    label: "🚨 Emergency Closure",
    text: "Campus entrance gates temporarily suspended due to emergency advisory. Please proceed to main reception.",
    severity: "red",
  },
  {
    label: "ℹ️ New Kiosk Online",
    text: "New high-speed facial recognition scanner stations are now live at the Main Entrance.",
    severity: "blue",
  },
  {
    label: "🌧️ Weather Advisory",
    text: "Inclement weather protocol in effect. Secondary entrance turnstiles open for all enrolled students.",
    severity: "orange",
  },
];

export default function SuperAdminBroadcastsPage() {
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "maintenance" | "broadcast">("all");

  // Selection state for Bulk / Batch operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Platform System Status
  const [globalMaintMode, setGlobalMaintMode] = useState(false);
  const [globalAnnouncement, setGlobalAnnouncement] = useState("");
  const [globalTargetCampus, setGlobalTargetCampus] = useState("all");
  const [globalBannerType, setGlobalBannerType] = useState("orange");

  // Broadcast Creation Modal state
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [scopeType, setScopeType] = useState<"all" | "custom">("all");
  const [selectedCampusesForModal, setSelectedCampusesForModal] = useState<string[]>([]);
  const [modalCampusSearch, setModalCampusSearch] = useState("");
  const [modalAnnouncement, setModalAnnouncement] = useState("");
  const [modalBannerType, setModalBannerType] = useState("orange");
  const [savingBroadcast, setSavingBroadcast] = useState(false);

  // Batch executing state
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  const fetchStatus = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [telemRes, instRes] = await Promise.all([
        getTelemetry().catch(() => null),
        getSuperAdminInstitutions().catch(() => []),
      ]);
      if (telemRes?.maintenance) {
        setGlobalMaintMode(telemRes.maintenance.maintenance_mode);
        setGlobalAnnouncement(telemRes.maintenance.announcement || "");
        setGlobalTargetCampus(telemRes.maintenance.target_campus || "all");
        setGlobalBannerType(telemRes.maintenance.banner_type || "orange");
      }
      setInstitutions(instRes);
    } catch (err) {
      console.error("Failed loading broadcast data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Helper to check if a specific campus has an active broadcast
  const getInstBroadcast = (instCode: string) => {
    if (!globalAnnouncement) return null;
    const target = (globalTargetCampus || "all").toLowerCase().trim();
    if (target === "all") {
      return { message: globalAnnouncement, type: globalBannerType, scope: "Global" };
    }
    const targetList = target.split(",").map((s) => s.trim().toLowerCase());
    if (targetList.includes(instCode.toLowerCase())) {
      return { message: globalAnnouncement, type: globalBannerType, scope: instCode.toUpperCase() };
    }
    return null;
  };

  // Filtered institutions
  const filteredInstitutions = useMemo(() => {
    return institutions.filter((inst) => {
      const hasBroadcast = getInstBroadcast(inst.code) !== null;
      if (statusFilter === "active" && !inst.is_active) return false;
      if (statusFilter === "maintenance" && inst.is_active) return false;
      if (statusFilter === "broadcast" && !hasBroadcast) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = inst.name.toLowerCase().includes(q);
        const matchesCode = inst.code.toLowerCase().includes(q);
        const matchesEmail = (inst.admin_email || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesEmail) return false;
      }
      return true;
    });
  }, [institutions, statusFilter, searchQuery, globalAnnouncement, globalTargetCampus, globalBannerType]);

  // Filtered institutions in Modal
  const modalFilteredInstitutions = useMemo(() => {
    if (!modalCampusSearch.trim()) return institutions;
    const q = modalCampusSearch.toLowerCase().trim();
    return institutions.filter(
      (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
  }, [institutions, modalCampusSearch]);

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

  // Open Broadcast Modal with pre-filled targets
  const handleOpenBroadcastModal = (presetTargetCodes?: string[]) => {
    if (presetTargetCodes && presetTargetCodes.length > 0) {
      setScopeType("custom");
      setSelectedCampusesForModal(presetTargetCodes);
    } else if (selectedIds.length > 0) {
      setScopeType("custom");
      const selectedCodes = institutions
        .filter((i) => selectedIds.includes(i.id))
        .map((i) => i.code.toLowerCase());
      setSelectedCampusesForModal(selectedCodes);
    } else {
      setScopeType("all");
      setSelectedCampusesForModal([]);
    }
    setModalCampusSearch("");
    setModalAnnouncement(globalAnnouncement || "");
    setModalBannerType(globalBannerType || "orange");
    setBroadcastModalOpen(true);
  };

  const handleToggleModalCampusChip = (code: string) => {
    const cleanCode = code.toLowerCase();
    setSelectedCampusesForModal((prev) =>
      prev.includes(cleanCode) ? prev.filter((c) => c !== cleanCode) : [...prev, cleanCode]
    );
  };

  // 1-Click Single Toggle Maintenance Mode
  const handleSingleToggleMaintenance = async (inst: InstitutionItem) => {
    try {
      const res = await toggleInstitutionActive(inst.id);
      setInstitutions((prev) =>
        prev.map((i) => (i.id === inst.id ? { ...i, is_active: res.is_active } : i))
      );
      notifications.show({
        title: res.is_active ? "Operational Mode Resumed" : "Maintenance Mode Enabled",
        message: `${inst.name} is now ${res.is_active ? "active" : "in maintenance mode (suspended)"}.`,
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

  // 1-Click Clear Broadcast for Single Campus
  const handleSingleClearBroadcast = async (inst: InstitutionItem) => {
    try {
      const target = (globalTargetCampus || "all").toLowerCase().trim();
      if (target === "all" || target === inst.code.toLowerCase()) {
        await clearSystemStatus();
        setGlobalAnnouncement("");
        setGlobalTargetCampus("all");
      } else {
        const remainingTargets = target
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((code) => code !== inst.code.toLowerCase());
        if (remainingTargets.length === 0) {
          await clearSystemStatus();
          setGlobalAnnouncement("");
        } else {
          await updateSystemStatus({
            maintenance_mode: globalMaintMode,
            announcement: globalAnnouncement,
            target_campus: remainingTargets.join(","),
            banner_type: globalBannerType,
          });
        }
      }
      notifications.show({
        title: "Broadcast Cleared",
        message: `Active notice removed for ${inst.name}.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      fetchStatus();
    } catch (err) {
      notifications.show({
        title: "Clear Failed",
        message: getApiError(err),
        color: "red",
      });
    }
  };

  // ─── Batch / Bulk Actions ───

  // Batch Maintenance (Set Active / Inactive)
  const handleBatchMaintenance = async (setActive: boolean) => {
    if (selectedIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      await batchToggleInstitutionsActive(selectedIds, setActive);
      setInstitutions((prev) =>
        prev.map((i) => (selectedIds.includes(i.id) ? { ...i, is_active: setActive } : i))
      );
      notifications.show({
        title: setActive ? "Bulk Operations Resumed" : "Bulk Maintenance Enabled",
        message: `${selectedIds.length} campus(es) set to ${setActive ? "Operational" : "Maintenance Mode"}.`,
        color: setActive ? "teal" : "orange",
        icon: <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({
        title: "Bulk Action Failed",
        message: getApiError(err),
        color: "red",
      });
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Batch Clear Broadcasts
  const handleBatchClearBroadcasts = async () => {
    if (selectedIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      const selectedCodes = institutions
        .filter((i) => selectedIds.includes(i.id))
        .map((i) => i.code.toLowerCase());

      const currentTarget = (globalTargetCampus || "all").toLowerCase().trim();
      if (currentTarget === "all") {
        await clearSystemStatus();
        setGlobalAnnouncement("");
      } else {
        const remaining = currentTarget
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((code) => !selectedCodes.includes(code));
        if (remaining.length === 0) {
          await clearSystemStatus();
          setGlobalAnnouncement("");
        } else {
          await updateSystemStatus({
            maintenance_mode: globalMaintMode,
            announcement: globalAnnouncement,
            target_campus: remaining.join(","),
            banner_type: globalBannerType,
          });
        }
      }
      notifications.show({
        title: "Broadcasts Removed",
        message: `Cleared notices for ${selectedIds.length} selected campus(es).`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      fetchStatus();
    } catch (err) {
      notifications.show({
        title: "Clear Failed",
        message: getApiError(err),
        color: "red",
      });
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Modal Submit
  const handleSaveBroadcastModal = async () => {
    if (!modalAnnouncement.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Please enter an announcement notice message.",
        color: "red",
      });
      return;
    }

    setSavingBroadcast(true);
    try {
      let targetScope = "all";
      if (scopeType === "custom") {
        if (selectedCampusesForModal.length === 0) {
          notifications.show({
            title: "Validation Error",
            message: "Please select at least one target campus.",
            color: "red",
          });
          setSavingBroadcast(false);
          return;
        }
        targetScope = selectedCampusesForModal.join(",");
      }

      await updateSystemStatus({
        maintenance_mode: globalMaintMode,
        announcement: modalAnnouncement.trim(),
        target_campus: targetScope,
        banner_type: modalBannerType,
      });

      notifications.show({
        title: "Broadcast Published",
        message: `Notice broadcasted to ${scopeType === "all" ? "All Campuses" : `${selectedCampusesForModal.length} selected campus(es)`}.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setBroadcastModalOpen(false);
      fetchStatus();
    } catch (err) {
      notifications.show({
        title: "Broadcast Failed",
        message: getApiError(err),
        color: "red",
      });
    } finally {
      setSavingBroadcast(false);
    }
  };

  // Global Kill-Switch toggle
  const handleGlobalKillSwitch = async (enabled: boolean) => {
    try {
      await updateSystemStatus({
        maintenance_mode: enabled,
        announcement: globalAnnouncement,
        target_campus: globalTargetCampus,
        banner_type: globalBannerType,
      });
      setGlobalMaintMode(enabled);
      notifications.show({
        title: enabled ? "Platform Maintenance Mode Engaged" : "Platform Restored to Normal",
        message: enabled
          ? "All biometric check-in pipelines halted globally."
          : "All platform check-in operations resumed.",
        color: enabled ? "red" : "teal",
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

  if (loading) {
    return (
      <Container size="xl" pt={0} pb="4xl" className="superadmin-container">
        <Skeleton height={100} radius={18} mb="md" />
        <Skeleton height={420} radius={18} />
      </Container>
    );
  }

  const activeCampusesCount = institutions.filter((i) => i.is_active).length;
  const maintenanceCampusesCount = institutions.filter((i) => !i.is_active).length;
  const campusesWithBroadcast = institutions.filter((i) => getInstBroadcast(i.code) !== null).length;

  return (
    <Container size="xl" pt={0} pb="4xl" className="superadmin-container">
      {/* ─── 1. Page Header (Uniform with App Structure) ─── */}
      <PageHeader
        title="Incident & Broadcast Hub"
        subtitle="Manage campus maintenance states, bulk toggle operational modes, and publish targeted emergency notices."
      >
        <Group gap="xs">
          <Button
            size="xs"
            variant="filled"
            leftSection={<IconPlus size={14} />}
            onClick={() => handleOpenBroadcastModal()}
            className="superadmin-btn-primary"
          >
            New Broadcast
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            loading={refreshing}
            onClick={() => fetchStatus(true)}
            className="superadmin-btn-secondary"
          >
            Refresh
          </Button>
        </Group>
      </PageHeader>

      {/* ─── 2. Global Platform Emergency Kill-Switch Bar ─── */}
      <Box mb="md" p="sm" className="superadmin-switch-box">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <IconPower size={20} color={globalMaintMode ? "#ef4444" : "#10b981"} />
            <div>
              <Group gap="xs">
                <Text size="sm" fw={700} c="var(--text-primary)">
                  Global Platform Kill-Switch: {globalMaintMode ? "ACTIVE (ALL GATES SUSPENDED)" : "NORMAL OPERATION"}
                </Text>
                <Badge size="xs" color={globalMaintMode ? "red" : "teal"} variant="light">
                  {globalMaintMode ? "Maintenance Active" : "Operational"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {globalMaintMode
                  ? "All automated biometric check-in pipelines halted globally across all student portals."
                  : "Platform operational. Individual campus maintenance states can be managed in the table below."}
              </Text>
            </div>
          </Group>
          <Switch
            checked={globalMaintMode}
            onChange={(e) => handleGlobalKillSwitch(e.currentTarget.checked)}
            color="red"
            size="md"
            label={globalMaintMode ? "Halt Active" : "Operational"}
          />
        </Group>
      </Box>

      {/* ─── 3. Main Object-Based Incident Table Card ─── */}
      <div className="superadmin-bento-card">
        {/* Table Toolbar: Search + Filter Chips */}
        <div className="superadmin-card-toolbar">
          <TextInput
            placeholder="Search campus name, code slug, or admin email..."
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
              All ({institutions.length})
            </Button>
            <Button
              size="compact-xs"
              color="teal"
              variant={statusFilter === "active" ? "filled" : "light"}
              onClick={() => setStatusFilter("active")}
            >
              Operational ({activeCampusesCount})
            </Button>
            <Button
              size="compact-xs"
              color="orange"
              variant={statusFilter === "maintenance" ? "filled" : "light"}
              onClick={() => setStatusFilter("maintenance")}
            >
              In Maintenance ({maintenanceCampusesCount})
            </Button>
            <Button
              size="compact-xs"
              color="blue"
              variant={statusFilter === "broadcast" ? "filled" : "light"}
              onClick={() => setStatusFilter("broadcast")}
            >
              Has Broadcast ({campusesWithBroadcast})
            </Button>
          </Group>
        </div>

        {/* ─── 4. Dynamic Sticky Batch Actions Bar (when 1+ items selected) ─── */}
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
                Choose batch maintenance or broadcast action:
              </Text>
            </Group>

            <Group gap={6}>
              <Button
                size="compact-xs"
                variant="filled"
                color="blue"
                leftSection={<IconBroadcast size={12} />}
                onClick={() => handleOpenBroadcastModal()}
              >
                Batch Broadcast
              </Button>
              <Button
                size="compact-xs"
                variant="light"
                color="orange"
                leftSection={<IconPower size={12} />}
                loading={batchActionLoading}
                onClick={() => handleBatchMaintenance(false)}
              >
                Put in Maintenance
              </Button>
              <Button
                size="compact-xs"
                variant="light"
                color="teal"
                leftSection={<IconCircleCheck size={12} />}
                loading={batchActionLoading}
                onClick={() => handleBatchMaintenance(true)}
              >
                Resume Operations
              </Button>
              <Button
                size="compact-xs"
                variant="light"
                color="red"
                leftSection={<IconTrash size={12} />}
                loading={batchActionLoading}
                onClick={handleBatchClearBroadcasts}
              >
                Remove Notices
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

        {/* ─── 5. Zero-Scroll Object-Based Table with Anti-Truncation ─── */}
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
                    aria-label="Select all campuses"
                  />
                </Table.Th>
                <Table.Th style={{ width: "28%" }}>Campus Tenant Scope</Table.Th>
                <Table.Th style={{ width: "18%" }}>Maintenance State</Table.Th>
                <Table.Th style={{ width: "28%" }}>Active Incident Advisory</Table.Th>
                <Table.Th style={{ width: "26%", textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredInstitutions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: "center", padding: "28px 12px" }}>
                    <Text size="xs" c="dimmed">
                      {searchQuery ? `No campuses match "${searchQuery}"` : "Zero registered institutions found."}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredInstitutions.map((inst) => {
                  const isSelected = selectedIds.includes(inst.id);
                  const broadcast = getInstBroadcast(inst.code);

                  return (
                    <Table.Tr
                      key={inst.id}
                      style={{
                        background: isSelected ? "rgba(0, 112, 243, 0.04)" : undefined,
                      }}
                    >
                      {/* Checkbox Column */}
                      <Table.Td style={{ textAlign: "center" }}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleRowSelect(inst.id)}
                          size="xs"
                          aria-label={`Select ${inst.name}`}
                        />
                      </Table.Td>

                      {/* Campus Scope Column */}
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
                              <Badge size="compact-xs" variant="outline" color="gray">
                                👥 {inst.attendee_count}
                              </Badge>
                              <Badge size="compact-xs" variant="outline" color="gray">
                                📡 {inst.device_count}
                              </Badge>
                            </Group>
                          </div>
                        </Group>
                      </Table.Td>

                      {/* Maintenance State Column */}
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Badge
                            size="xs"
                            color={inst.is_active ? "teal" : "orange"}
                            variant={inst.is_active ? "light" : "filled"}
                          >
                            {inst.is_active ? "Operational" : "In Maint"}
                          </Badge>
                          <Tooltip
                            label={
                              inst.is_active
                                ? "Click to set maintenance mode (suspends gates)"
                                : "Click to restore operational mode"
                            }
                            withArrow
                          >
                            <Switch
                              checked={inst.is_active}
                              onChange={() => handleSingleToggleMaintenance(inst)}
                              color="teal"
                              size="xs"
                            />
                          </Tooltip>
                        </Group>
                      </Table.Td>

                      {/* Active Incident Notice Column */}
                      <Table.Td>
                        {broadcast ? (
                          <div style={{ minWidth: 0 }}>
                            <Group gap={6} wrap="nowrap" mb={2}>
                              <Badge
                                size="compact-xs"
                                color={
                                  broadcast.type === "red"
                                    ? "red"
                                    : broadcast.type === "blue"
                                    ? "blue"
                                    : "orange"
                                }
                                variant="filled"
                              >
                                {broadcast.type.toUpperCase()}
                              </Badge>
                              <Text size="10px" c="dimmed">
                                Scope: {broadcast.scope}
                              </Text>
                            </Group>
                            <Text size="11px" fw={500} c="var(--text-primary)" truncate title={broadcast.message}>
                              "{broadcast.message}"
                            </Text>
                          </div>
                        ) : (
                          <Text size="11px" c="dimmed">
                            Zero active advisories
                          </Text>
                        )}
                      </Table.Td>

                      {/* Inline Actions Column (Anti-Truncation Guaranteed) */}
                      <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div className="superadmin-table-actions-group">
                          <Tooltip label="Set Broadcast Notice" withArrow>
                            <Button
                              size="compact-xs"
                              variant="light"
                              color="blue"
                              leftSection={<IconBroadcast size={11} />}
                              onClick={() => handleOpenBroadcastModal([inst.code.toLowerCase()])}
                            >
                              Broadcast
                            </Button>
                          </Tooltip>

                          <Tooltip
                            label={inst.is_active ? "Put in Maintenance Mode" : "Restore Operational Mode"}
                            withArrow
                          >
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color={inst.is_active ? "orange" : "teal"}
                              onClick={() => handleSingleToggleMaintenance(inst)}
                            >
                              {inst.is_active ? "Maintenance" : "Resume"}
                            </Button>
                          </Tooltip>

                          {broadcast && (
                            <Tooltip label="Remove Active Broadcast" withArrow>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="red"
                                onClick={() => handleSingleClearBroadcast(inst)}
                                aria-label="Remove Broadcast"
                              >
                                <IconTrash size={13} />
                              </ActionIcon>
                            </Tooltip>
                          )}
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

      {/* ─── 6. Redesigned Premium & Intuitive Broadcast Modal ─── */}
      <Modal
        opened={broadcastModalOpen}
        onClose={() => setBroadcastModalOpen(false)}
        title={
          <Group gap="xs">
            <IconBroadcast size={18} color="var(--brand-primary, #0070f3)" />
            <Text fw={700} size="sm" c="var(--text-primary)">
              Publish Incident Broadcast Advisory
            </Text>
          </Group>
        }
        radius="md"
        size="lg"
      >
        <Stack gap="md">
          {/* Scope Mode Selector Tabs */}
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }} mb={6}>
              1. Choose Target Audience Scope:
            </Text>
            <div className="superadmin-modal-scope-tabs">
              <button
                type="button"
                className={`superadmin-modal-scope-tab ${scopeType === "all" ? "active" : ""}`}
                onClick={() => setScopeType("all")}
              >
                <IconBuildingArch size={14} />
                <span>🌐 All Campuses (Global)</span>
              </button>
              <button
                type="button"
                className={`superadmin-modal-scope-tab ${scopeType === "custom" ? "active" : ""}`}
                onClick={() => setScopeType("custom")}
              >
                <IconCheck size={14} />
                <span>
                  🎯 Specific Campuses {selectedCampusesForModal.length > 0 && `(${selectedCampusesForModal.length})`}
                </span>
              </button>
            </div>
          </div>

          {/* Interactive Campus Selection Grid when Custom is Active */}
          {scopeType === "custom" && (
            <Box p="xs" style={{ background: "var(--surface-0)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
              <Group justify="space-between" mb={8}>
                <TextInput
                  placeholder="Filter campuses by name or slug..."
                  size="xs"
                  leftSection={<IconSearch size={12} />}
                  value={modalCampusSearch}
                  onChange={(e) => setModalCampusSearch(e.currentTarget.value)}
                  style={{ flex: 1, maxWidth: 240 }}
                />
                <Group gap={6}>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={() =>
                      setSelectedCampusesForModal(institutions.map((i) => i.code.toLowerCase()))
                    }
                  >
                    Select All ({institutions.length})
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => setSelectedCampusesForModal([])}
                  >
                    Clear
                  </Button>
                </Group>
              </Group>

              <div className="superadmin-modal-campus-grid">
                {modalFilteredInstitutions.map((inst) => {
                  const isChecked = selectedCampusesForModal.includes(inst.code.toLowerCase());
                  return (
                    <div
                      key={inst.id}
                      className={`superadmin-modal-campus-chip ${isChecked ? "selected" : ""}`}
                      onClick={() => handleToggleModalCampusChip(inst.code)}
                    >
                      <Checkbox
                        checked={isChecked}
                        onChange={() => {}}
                        size="xs"
                        tabIndex={-1}
                        style={{ pointerEvents: "none" }}
                      />
                      <span
                        className="superadmin-brand-swatch"
                        style={{ background: inst.brand_color || "#0070f3" }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text size="xs" fw={600} c="var(--text-primary)" truncate>
                          {inst.name}
                        </Text>
                        <Text size="10.5px" c="dimmed">
                          /{inst.code}
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Box>
          )}

          {/* Quick Message Presets */}
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }} mb={6}>
              2. Quick Message Templates (Optional):
            </Text>
            <Group gap={6} wrap="wrap">
              {PRESET_TEMPLATES.map((tmpl) => (
                <Button
                  key={tmpl.label}
                  size="compact-xs"
                  variant="light"
                  color="gray"
                  leftSection={<IconSparkles size={11} />}
                  onClick={() => {
                    setModalAnnouncement(tmpl.text);
                    setModalBannerType(tmpl.severity);
                  }}
                >
                  {tmpl.label}
                </Button>
              ))}
            </Group>
          </div>

          {/* Severity Selector Buttons */}
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }} mb={6}>
              3. Advisory Severity Color:
            </Text>
            <div className="superadmin-modal-severity-row">
              <button
                type="button"
                className={`superadmin-modal-severity-btn ${
                  modalBannerType === "orange" ? "active-orange" : ""
                }`}
                onClick={() => setModalBannerType("orange")}
              >
                <span>⚠️ Warning (Orange)</span>
              </button>
              <button
                type="button"
                className={`superadmin-modal-severity-btn ${
                  modalBannerType === "red" ? "active-red" : ""
                }`}
                onClick={() => setModalBannerType("red")}
              >
                <span>🚨 Critical (Red)</span>
              </button>
              <button
                type="button"
                className={`superadmin-modal-severity-btn ${
                  modalBannerType === "blue" ? "active-blue" : ""
                }`}
                onClick={() => setModalBannerType("blue")}
              >
                <span>ℹ️ Info (Blue)</span>
              </button>
            </div>
          </div>

          {/* Message Textarea */}
          <Textarea
            label="4. Broadcast Notice Message"
            placeholder="e.g. Scheduled gate gateway firmware synchronization tonight at 10:00 PM."
            value={modalAnnouncement}
            onChange={(e) => setModalAnnouncement(e.currentTarget.value)}
            minRows={3}
            size="xs"
          />

          {/* Real-Time Live Preview */}
          {modalAnnouncement.trim() && (
            <Box mt={2}>
              <Text size="11px" fw={600} c="dimmed" mb={2}>
                LIVE BANNER PREVIEW (TARGET:{" "}
                {scopeType === "all"
                  ? "ALL CAMPUSES"
                  : selectedCampusesForModal.length > 0
                  ? selectedCampusesForModal.map((c) => c.toUpperCase()).join(", ")
                  : "NONE SELECTED"}
                )
              </Text>
              <div className={`superadmin-preview-banner banner-${modalBannerType}`}>
                <IconAlertTriangle size={15} />
                <span style={{ flex: 1 }}>{modalAnnouncement}</span>
              </div>
            </Box>
          )}

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="default" size="xs" onClick={() => setBroadcastModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="superadmin-btn-primary"
              size="xs"
              loading={savingBroadcast}
              onClick={handleSaveBroadcastModal}
            >
              Publish Broadcast Notice
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
