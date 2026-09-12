import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Text,
  Button,
  Group,
  Modal,
  Stack,
  Alert,
  Select,
  TextInput,
  CloseButton,
  Tooltip,
  ActionIcon,
  Pagination,
  Skeleton,
} from "@mantine/core";
import {
  IconDeviceCctv,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconSettings,
  IconPlus,
  IconCheck,
  IconCopy,
  IconArrowsExchange,
  IconBuildingCommunity,
  IconSearch,
  IconRefresh,
  IconMapPin,
  IconExternalLink,
  IconShieldCheck,
  IconClock,
  IconKey,
} from "@tabler/icons-react";
import { listDevices, generatePairingCode, reassignDevice } from "../../api/devices";
import type { ScannerDeviceListItem, PairingCodeResponse } from "../../api/devices";
import { getOrganizations } from "../../api/organizations";
import type { Organization } from "../../types/organization";
import { useAuthStore } from "../../store/authStore";
import { useAsync } from "../../hooks";
import "./AdminScannerDevicesPage.css";

const typeLabels: Record<string, string> = {
  dedicated_scanner: "Dedicated Entrance Kiosk",
  mobile_scanner: "Mobile Scanner Tablet",
  workstation_laptop: "Laptop / Workstation",
};

const PAGE_SIZE = 9;

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never connected";
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Active just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString();
}

export default function AdminScannerDevicesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isOrgAdmin = user?.role === "org_admin";

  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingData, setPairingData] = useState<PairingCodeResponse | null>(null);
  const [selectedPairOrg, setSelectedPairOrg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Department filter for campus admin
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string | null>(null);

  // Status tab filter: 'all' | 'online' | 'offline'
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Reassign Modal state
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedDeviceToReassign, setSelectedDeviceToReassign] = useState<ScannerDeviceListItem | null>(null);
  const [reassignTargetOrg, setReassignTargetOrg] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);

  // Organizations list
  const [orgs, setOrgs] = useState<Organization[]>([]);

  useEffect(() => {
    getOrganizations()
      .then((res) => setOrgs(res || []))
      .catch((err) => console.error("Failed to load organizations", err));
  }, []);

  const { data: devices, loading, execute: refetchDevices } = useAsync(
    () => listDevices(selectedDeptFilter ?? undefined),
    true,
  );

  useEffect(() => {
    refetchDevices();
  }, [selectedDeptFilter]);

  const deviceList = devices ?? [];

  // Metrics
  const totalCount = deviceList.length;
  const onlineCount = useMemo(() => deviceList.filter((d) => d.is_active).length, [deviceList]);
  const offlineCount = totalCount - onlineCount;

  // Filtered dataset
  const filteredDevices = useMemo(() => {
    let rows = deviceList;

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.location ?? "").toLowerCase().includes(q) ||
          (d.organization_name ?? "").toLowerCase().includes(q) ||
          (d.organization_code ?? "").toLowerCase().includes(q),
      );
    }

    if (statusFilter === "online") {
      rows = rows.filter((d) => d.is_active);
    } else if (statusFilter === "offline") {
      rows = rows.filter((d) => !d.is_active);
    }

    return rows;
  }, [deviceList, search, statusFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, selectedDeptFilter]);

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / PAGE_SIZE));
  const paginatedDevices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredDevices.slice(start, start + PAGE_SIZE);
  }, [filteredDevices, page]);

  const handleOpenPairingModal = async (orgIdOverride?: string | null) => {
    setPairingModalOpen(true);
    setGenerating(true);
    const orgId = orgIdOverride !== undefined ? orgIdOverride : selectedPairOrg;
    try {
      const res = await generatePairingCode(orgId ?? undefined);
      setPairingData(res);
    } catch (err) {
      console.error("Failed to generate pairing code", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (pairingData?.code) {
      navigator.clipboard.writeText(pairingData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenReassignModal = (device: ScannerDeviceListItem) => {
    setSelectedDeviceToReassign(device);
    setReassignTargetOrg(device.organization_id ?? null);
    setReassignModalOpen(true);
  };

  const handleConfirmReassign = async () => {
    if (!selectedDeviceToReassign) return;
    setReassigning(true);
    try {
      await reassignDevice(selectedDeviceToReassign.id, reassignTargetOrg);
      setReassignModalOpen(false);
      refetchDevices();
    } catch (err) {
      console.error("Failed to reassign device", err);
    } finally {
      setReassigning(false);
    }
  };

  const orgSelectOptions = [
    { value: "", label: "Campus-Wide / Unassigned" },
    ...orgs.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` })),
  ];

  const getHardwareIcon = (type: string) => {
    if (type === "workstation_laptop") {
      return <IconDeviceLaptop size={20} />;
    }
    if (type === "mobile_scanner") {
      return <IconDeviceMobile size={20} />;
    }
    return <IconDeviceCctv size={20} />;
  };

  return (
    <div className="scanner-simple-container">
      {/* ─── 1. Header ─── */}
      <div className="scanner-simple-header">
        <div className="scanner-header-left">
          <h1 className="scanner-simple-title">
            {isOrgAdmin ? "Department Scanners" : "Scanner Devices"}
          </h1>
          <p className="scanner-simple-subtitle">
            Cameras and entrance tablets used for biometric attendance verification.
          </p>
        </div>

        <div className="scanner-header-actions">
          <Button
            size="xs"
            leftSection={<IconPlus size={15} />}
            onClick={() => handleOpenPairingModal()}
            className="scanner-btn-primary"
          >
            Pair Device
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconExternalLink size={14} />}
            onClick={() => window.open("/kiosk", "_blank")}
            className="scanner-btn-secondary"
          >
            Launch Scanner
          </Button>
          <Tooltip label="Refresh device status">
            <ActionIcon
              variant="default"
              size="input-xs"
              loading={loading}
              onClick={refetchDevices}
              className="scanner-btn-secondary"
              aria-label="Refresh devices"
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* ─── 2. Simple 3-Stat Summary Ribbon ─── */}
      <div className="scanner-stats-ribbon">
        <div className="scanner-stat-box">
          <div className="scanner-stat-info">
            <span className="scanner-stat-label">Total Devices</span>
            <span className="scanner-stat-value">
              {loading ? <Skeleton height={24} width={36} /> : totalCount}
            </span>
          </div>
          <div className="scanner-stat-icon total">
            <IconDeviceCctv size={20} />
          </div>
        </div>

        <div className="scanner-stat-box">
          <div className="scanner-stat-info">
            <span className="scanner-stat-label">Online Now</span>
            <span className="scanner-stat-value" style={{ color: "#10b981" }}>
              {loading ? <Skeleton height={24} width={36} /> : onlineCount}
            </span>
          </div>
          <div className="scanner-stat-icon online">
            <IconShieldCheck size={20} />
          </div>
        </div>

        <div className="scanner-stat-box">
          <div className="scanner-stat-info">
            <span className="scanner-stat-label">Offline</span>
            <span className="scanner-stat-value" style={{ color: "var(--text-muted)" }}>
              {loading ? <Skeleton height={24} width={36} /> : offlineCount}
            </span>
          </div>
          <div className="scanner-stat-icon standby">
            <IconClock size={20} />
          </div>
        </div>
      </div>

      {/* ─── 3. Filter & Search Controls Bar ─── */}
      <div className="scanner-controls-bar">
        <div className="scanner-pill-group">
          <button
            type="button"
            className={`scanner-pill ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <span>All</span>
            <span className="scanner-pill-count">{totalCount}</span>
          </button>
          <button
            type="button"
            className={`scanner-pill ${statusFilter === "online" ? "active" : ""}`}
            onClick={() => setStatusFilter("online")}
          >
            <span>Online</span>
            <span className="scanner-pill-count">{onlineCount}</span>
          </button>
          <button
            type="button"
            className={`scanner-pill ${statusFilter === "offline" ? "active" : ""}`}
            onClick={() => setStatusFilter("offline")}
          >
            <span>Offline</span>
            <span className="scanner-pill-count">{offlineCount}</span>
          </button>
        </div>

        <Group gap="xs" style={{ flexWrap: "wrap" }}>
          {!isOrgAdmin && orgs.length > 0 && (
            <Select
              size="xs"
              placeholder="All Departments"
              data={[{ value: "", label: "All Departments" }, ...orgs.map((o) => ({ value: o.id, label: o.name }))]}
              value={selectedDeptFilter ?? ""}
              onChange={(val) => setSelectedDeptFilter(val ? val : null)}
              clearable
              w={180}
              styles={{
                input: {
                  background: "var(--surface-1)",
                  borderColor: "var(--border-subtle)",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                },
              }}
            />
          )}

          <div className="scanner-search-box">
            <TextInput
              size="xs"
              placeholder="Search devices or gates..."
              leftSection={<IconSearch size={14} style={{ color: "var(--text-muted)" }} />}
              rightSection={
                search ? (
                  <CloseButton size="xs" onClick={() => setSearch("")} aria-label="Clear search" />
                ) : null
              }
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              styles={{
                input: {
                  background: "var(--surface-1)",
                  borderColor: "var(--border-subtle)",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                },
              }}
            />
          </div>
        </Group>
      </div>

      {/* ─── 4. Approachable Device Cards Grid ─── */}
      {loading ? (
        <div className="scanner-cards-grid">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="scanner-card" style={{ minHeight: 180 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Skeleton height={40} width={40} radius="md" />
                <Skeleton height={20} width={70} radius="xl" />
              </div>
              <Skeleton height={20} width="60%" />
              <Skeleton height={14} width="80%" />
              <Skeleton height={32} width="100%" radius="md" />
            </div>
          ))}
        </div>
      ) : paginatedDevices.length === 0 ? (
        <div className="scanner-simple-empty">
          <div className="scanner-empty-icon-wrap">
            <IconDeviceCctv size={24} />
          </div>
          <Text fw={600} size="sm" c="var(--text-primary)">
            {search || statusFilter !== "all" || selectedDeptFilter
              ? "No scanner devices match your filter"
              : "No scanner devices paired yet"}
          </Text>
          <Text size="xs" c="var(--text-muted)" maw={340}>
            {search || statusFilter !== "all" || selectedDeptFilter
              ? "Try clearing your search or switching to 'All' to see all devices."
              : "Pair an entrance camera, tablet, or laptop to begin verifying attendance."}
          </Text>
          {!search && statusFilter === "all" && (
            <Button
              size="xs"
              mt="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => handleOpenPairingModal()}
              className="scanner-btn-primary"
            >
              Pair First Device
            </Button>
          )}
        </div>
      ) : (
        <div className="scanner-cards-grid">
          {paginatedDevices.map((device) => {
            const isOnline = device.is_active;

            return (
              <div key={device.id} className="scanner-card">
                <div>
                  {/* Card Top: Icon & Status Chip */}
                  <div className="scanner-card-top">
                    <div className="scanner-card-device-icon">
                      {getHardwareIcon(device.device_type)}
                    </div>

                    <div className={`scanner-status-chip ${isOnline ? "online" : "offline"}`}>
                      {isOnline ? (
                        <>
                          <span className="scanner-status-dot-pulse" />
                          <span>Online</span>
                        </>
                      ) : (
                        <>
                          <span className="scanner-status-dot-standby" />
                          <span>Offline</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Title & Meta Info */}
                  <div className="scanner-card-body" style={{ marginTop: 12 }}>
                    <h2 className="scanner-card-name">{device.name}</h2>

                    <div className="scanner-card-meta-list">
                      {/* Form Factor Label */}
                      <div className="scanner-card-meta-item">
                        <Text size="xs" c="dimmed">
                          {typeLabels[device.device_type] ?? "Entrance Scanner"}
                        </Text>
                      </div>

                      {/* Location */}
                      <div className="scanner-card-meta-item">
                        <IconMapPin size={13} />
                        <span>{device.location || "General Entrance"}</span>
                      </div>

                      {/* Department Allocation */}
                      <div className="scanner-card-meta-item">
                        <IconBuildingCommunity size={13} />
                        <span>
                          {device.organization_name
                            ? `${device.organization_name}${device.organization_code ? ` (${device.organization_code})` : ""}`
                            : "Campus-Wide / All Events"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Last Activity & Actions */}
                <div className="scanner-card-footer">
                  <span className="scanner-card-time">
                    {formatRelativeTime(device.last_activity)}
                  </span>

                  <div className="scanner-card-btns">
                    <button
                      type="button"
                      className="scanner-tactile-btn"
                      onClick={() => navigate(`/admin/scanner-devices/${device.id}/zone`)}
                    >
                      <IconSettings size={13} />
                      <span>Configure Zone</span>
                    </button>

                    {!isOrgAdmin && (
                      <button
                        type="button"
                        className="scanner-tactile-btn reassign"
                        onClick={() => handleOpenReassignModal(device)}
                        title="Reassign Department"
                      >
                        <IconArrowsExchange size={13} />
                        <span>Reassign</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <Pagination
            total={totalPages}
            value={page}
            onChange={setPage}
            size="xs"
            radius="md"
          />
        </div>
      )}

      {/* ─── 5. Simple Pairing Modal ─── */}
      <Modal
        opened={pairingModalOpen}
        onClose={() => {
          setPairingModalOpen(false);
          refetchDevices();
        }}
        title={
          <Group gap={8} align="center">
            <IconKey size={18} style={{ color: "var(--brand-primary, #3b82f6)" }} />
            <Text fw={700} size="md" c="var(--text-primary)">
              Pair a Scanner Device
            </Text>
          </Group>
        }
        centered
        radius="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="var(--text-secondary)">
            1. Open <strong style={{ color: "var(--text-primary)" }}>/scanner/pair</strong> on the entrance camera laptop or tablet.
          </Text>

          <Text size="sm" c="var(--text-secondary)" style={{ marginTop: -8 }}>
            2. Enter this 6-digit code to link the device:
          </Text>

          {!isOrgAdmin && orgs.length > 0 && (
            <Select
              label="Assign to Department (Optional)"
              description="Allocate this camera to a specific organization"
              data={orgSelectOptions}
              value={selectedPairOrg ?? ""}
              onChange={(val) => {
                const target = val ? val : null;
                setSelectedPairOrg(target);
                handleOpenPairingModal(target);
              }}
              size="xs"
            />
          )}

          {/* Clean OTP Card */}
          <div className="scanner-otp-card">
            {generating ? (
              <Text size="sm" c="dimmed" py="sm">
                Generating code...
              </Text>
            ) : (
              <div className="scanner-otp-number">
                {pairingData?.code ?? "------"}
              </div>
            )}
            <Text size="xs" c="var(--text-muted)">
              Valid for 15 minutes · One-time use
            </Text>
          </div>

          <Group justify="center" gap="sm">
            <Button
              size="xs"
              variant="light"
              color={copied ? "teal" : "blue"}
              leftSection={copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
              onClick={handleCopyCode}
              disabled={!pairingData}
              className="scanner-btn-secondary"
            >
              {copied ? "Copied!" : "Copy Code"}
            </Button>
            <Button
              size="xs"
              variant="default"
              onClick={() => handleOpenPairingModal(selectedPairOrg)}
              loading={generating}
              className="scanner-btn-secondary"
            >
              New Code
            </Button>
          </Group>

          <Alert
            color="blue"
            variant="light"
            radius="md"
            icon={<IconShieldCheck size={16} />}
            title="Safe & Simple"
          >
            Pairing connects the device securely without having to enter your admin password on shared kiosk screens.
          </Alert>
        </Stack>
      </Modal>

      {/* ─── 6. Simple Reassign Modal ─── */}
      <Modal
        opened={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title="Reassign Scanner Device"
        centered
        radius="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="var(--text-secondary)">
            Change the department allocation for <strong>{selectedDeviceToReassign?.name}</strong>:
          </Text>

          <Select
            label="Department"
            data={orgSelectOptions}
            value={reassignTargetOrg ?? ""}
            onChange={(val) => setReassignTargetOrg(val ? val : null)}
            size="xs"
          />

          <Group justify="flex-end" gap="sm" mt="xs">
            <Button
              variant="default"
              size="xs"
              onClick={() => setReassignModalOpen(false)}
              className="scanner-btn-secondary"
            >
              Cancel
            </Button>
            <Button
              color="violet"
              size="xs"
              onClick={handleConfirmReassign}
              loading={reassigning}
              className="scanner-btn-primary"
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
