import { useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  Badge,
  Button,
  Group,
} from "@mantine/core";
import {
  IconDeviceCctv,
  IconSettings,
} from "@tabler/icons-react";
import { listDevices } from "../api/devices";
import type { ScannerDeviceListItem } from "../api/devices";
import { useAsync } from "../hooks";
import { formatDateTime } from "../utils/formatters";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import PageHeader from "../components/layout/PageHeader";

const typeLabels: Record<string, string> = {
  dedicated_scanner: "Dedicated Scanner",
  mobile_scanner: "Mobile",
};

export default function AdminScannerDevicesPage() {
  const navigate = useNavigate();

  const { data: devices, loading } = useAsync(
    () => listDevices(),
    true,
  );

  const deviceList = devices ?? [];

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
          onClick={() => navigate(`/admin/scanner-config/${row.id}`)}
        >
          Configure
        </Button>
      ),
    },
  ];

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader title="Scanner Devices" />

      <DataTable
        columns={columns}
        rows={deviceList}
        loading={loading}
        emptyMessage="No scanner devices found."
      />

      <Text size="sm" c="dimmed" mt="sm">
        Showing {deviceList.length} device{deviceList.length !== 1 ? "s" : ""}
      </Text>
    </Container>
  );
}
