import { useState } from "react";
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
} from "@mantine/core";
import {
  IconDeviceCctv,
  IconSettings,
  IconKey,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import { listDevices, generatePairingCode } from "../api/devices";
import type { ScannerDeviceListItem, PairingCodeResponse } from "../api/devices";
import { useAsync } from "../hooks";
import { formatDateTime } from "../utils/formatters";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import PageHeader from "../components/layout/PageHeader";

const typeLabels: Record<string, string> = {
  dedicated_scanner: "Dedicated Scanner",
  mobile_scanner: "Mobile Scanner",
  workstation_laptop: "Workstation / Laptop",
};

export default function AdminScannerDevicesPage() {
  const navigate = useNavigate();
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingData, setPairingData] = useState<PairingCodeResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: devices, loading, execute: refetchDevices } = useAsync(
    () => listDevices(),
    true,
  );

  const deviceList = devices ?? [];

  const handleOpenPairingModal = async () => {
    setPairingModalOpen(true);
    setGenerating(true);
    try {
      const res = await generatePairingCode();
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
        <Button
          size="xs"
          variant="default"
          leftSection={<IconSettings size={14} />}
          onClick={() => navigate(`/admin/scanner-devices/${row.id}/zone`)}
        >
          Configure
        </Button>
      ),
    },
  ];

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader
        title="Scanner Devices"
        subtitle="Manage authorized hardware laptops, mobile scanners, and entrance kiosks."
      >
        <Button
          color="blue"
          leftSection={<IconKey size={16} />}
          onClick={handleOpenPairingModal}
        >
          Pair New Scanner Kiosk
        </Button>
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
              onClick={handleOpenPairingModal}
              loading={generating}
            >
              Generate New Code
            </Button>
          </Group>

          <Alert color="blue" variant="light" radius="md" title="Security Note">
            Pairing binds the entrance device securely to your institution without exposing administrator login credentials on shared hardware.
          </Alert>
        </Stack>
      </Modal>
    </Container>
  );
}
