import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Paper,
  Title,
  Alert,
  Select,
} from "@mantine/core";
import {
  IconDeviceCctv,
  IconSettings,
  IconKey,
  IconCheck,
  IconCopy,
  IconArrowsExchange,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { listDevices, generatePairingCode, reassignDevice } from "../../api/devices";
import type { ScannerDeviceListItem, PairingCodeResponse } from "../../api/devices";
import { getOrganizations } from "../../api/organizations";
import type { Organization } from "../../types/organization";
import { useAuthStore } from "../../store/authStore";
import { useAsync } from "../../hooks";
import { formatDateTime } from "../../utils/formatters";
import DataTable from "../../components/shared/DataTable";
import StatusBadge from "../../components/shared/StatusBadge";
import PageHeader from "../../components/layout/PageHeader";

const typeLabels: Record<string, string> = {
  dedicated_scanner: "Dedicated Scanner",
  mobile_scanner: "Mobile Scanner",
  workstation_laptop: "Workstation / Laptop",
};

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

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row: ScannerDeviceListItem) => (
        <Group gap="xs">
          <IconDeviceCctv size={16} />
          <Text size="sm" fw={500} component="span">
            {row.name}
          </Text>
        </Group>
      ),
    },
    {
      key: "device_type",
      label: "Type",
      render: (row: ScannerDeviceListItem) => (
        <Badge color="blue" size="sm">
          {typeLabels[row.device_type] ?? row.device_type}
        </Badge>
      ),
    },
    {
      key: "department",
      label: "Department Scope",
      render: (row: ScannerDeviceListItem) => (
        <Badge
          color={row.organization_name ? "violet" : "gray"}
          variant="light"
          size="sm"
          leftSection={<IconBuildingCommunity size={12} />}
        >
          {row.organization_name ?? "Campus-Wide"}
        </Badge>
      ),
    },
    { key: "location", label: "Location", render: (row: ScannerDeviceListItem) => <>{row.location ?? "\u2014"}</> },
    {
      key: "status",
      label: "Status",
      render: (row: ScannerDeviceListItem) => (
        <StatusBadge status={row.is_active ? "active" : "inactive"} />
      ),
    },
    {
      key: "last_activity",
      label: "Last Activity",
      render: (row: ScannerDeviceListItem) => (
        <>{row.last_activity ? formatDateTime(row.last_activity) : "\u2014"}</>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: ScannerDeviceListItem) => (
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconSettings size={14} />}
            onClick={() => navigate(`/admin/scanner-devices/${row.id}/zone`)}
          >
            Configure
          </Button>
          {!isOrgAdmin && (
            <Button
              size="xs"
              variant="light"
              color="violet"
              leftSection={<IconArrowsExchange size={14} />}
              onClick={() => handleOpenReassignModal(row)}
            >
              Reassign
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader
        title={isOrgAdmin ? "Department Scanner Devices" : "Scanner Hardware Fleet"}
        subtitle={
          isOrgAdmin
            ? "Manage and pair scanner tablets and laptops allocated to your department."
            : "Manage authorized hardware laptops, mobile scanners, and entrance kiosks across campus."
        }
      >
        <Group gap="sm">
          {!isOrgAdmin && orgs.length > 0 && (
            <Select
              placeholder="All Departments"
              data={[{ value: "", label: "All Departments" }, ...orgs.map((o) => ({ value: o.id, label: o.name }))]}
              value={selectedDeptFilter ?? ""}
              onChange={(val) => setSelectedDeptFilter(val ? val : null)}
              clearable
              size="xs"
              style={{ minWidth: 200 }}
            />
          )}
          <Button
            color="blue"
            leftSection={<IconKey size={16} />}
            onClick={() => handleOpenPairingModal()}
          >
            Pair New Scanner Kiosk
          </Button>
        </Group>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={deviceList}
        loading={loading}
        emptyMessage="No scanner devices found."
      />

      {/* 6-Digit Pairing Code Modal */}
      <Modal
        opened={pairingModalOpen}
        onClose={() => {
          setPairingModalOpen(false);
          refetchDevices();
        }}
        title="Pair Entrance Scanner Kiosk"
        centered
        radius="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            On the entrance laptop or mobile device, navigate to <strong>/scanner/pair</strong> and enter the 6-digit code below:
          </Text>

          {!isOrgAdmin && orgs.length > 0 && (
            <Select
              label="Assign to Department (Optional)"
              description="Hardware will be allocated to this department for event attendance"
              data={orgSelectOptions}
              value={selectedPairOrg ?? ""}
              onChange={(val) => {
                const target = val ? val : null;
                setSelectedPairOrg(target);
                handleOpenPairingModal(target);
              }}
              size="sm"
            />
          )}

          <Paper p="xl" radius="md" withBorder style={{ textAlign: "center", background: "rgba(15, 23, 42, 0.6)" }}>
            {generating ? (
              <Text size="lg" c="dimmed">Generating secure OTP...</Text>
            ) : (
              <Title order={1} style={{ fontSize: "3rem", letterSpacing: "0.25em", color: "#38bdf8", fontFamily: "monospace" }}>
                {pairingData?.code ?? "------"}
              </Title>
            )}
            <Text size="xs" c="dimmed" mt="xs">
              Valid for 15 minutes · One-time use per hardware device
            </Text>
          </Paper>

          <Group justify="center" gap="sm">
            <Button
              variant="light"
              color={copied ? "teal" : "blue"}
              leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              onClick={handleCopyCode}
              disabled={!pairingData}
            >
              {copied ? "Copied!" : "Copy Code"}
            </Button>
            <Button
              variant="default"
              onClick={() => handleOpenPairingModal(selectedPairOrg)}
              loading={generating}
            >
              Generate New Code
            </Button>
          </Group>

          <Alert color="blue" variant="light" radius="md" title="Security Note">
            Pairing binds the entrance device securely to your institution and department without exposing administrator login credentials on shared hardware.
          </Alert>
        </Stack>
      </Modal>

      {/* Reassign Hardware Modal */}
      <Modal
        opened={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title="Reassign Hardware Device"
        centered
        radius="lg"
      >
        <Stack gap="md">
          <Text size="sm">
            Reassign <strong>{selectedDeviceToReassign?.name}</strong> to another department or clear department allocation.
          </Text>

          <Select
            label="Target Department"
            data={orgSelectOptions}
            value={reassignTargetOrg ?? ""}
            onChange={(val) => setReassignTargetOrg(val ? val : null)}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="default" onClick={() => setReassignModalOpen(false)}>
              Cancel
            </Button>
            <Button color="violet" onClick={handleConfirmReassign} loading={reassigning}>
              Save Reassignment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
