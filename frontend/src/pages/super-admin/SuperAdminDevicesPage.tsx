import {
  Container,
  Text,
  Badge,
  Group,
} from "@mantine/core";
import {
  IconDeviceCctv,
} from "@tabler/icons-react";
import { getGlobalDevices } from "../../api/superAdmin";
import type { GlobalDeviceItem } from "../../api/superAdmin";
import { useAsync } from "../../hooks";
import { formatDateTime } from "../../utils/formatters";
import DataTable from "../../components/shared/DataTable";
import PageHeader from "../../components/layout/PageHeader";

const typeLabels: Record<string, string> = {
  dedicated_scanner: "Dedicated Scanner",
  mobile_scanner: "Mobile Scanner",
  workstation_laptop: "Workstation / Laptop",
};

export default function SuperAdminDevicesPage() {
  const { data: devices, loading } = useAsync(
    () => getGlobalDevices(),
    true,
  );

  const deviceList = devices ?? [];

  const columns = [
    {
      key: "name",
      label: "Device / Kiosk",
      render: (row: GlobalDeviceItem) => (
        <Group gap="xs">
          <IconDeviceCctv size={16} />
          <div>
            <Text size="sm" fw={500}>
              {row.name}
            </Text>
            <Text size="xs" c="dimmed">
              {row.location || "No location specified"}
            </Text>
          </div>
        </Group>
      ),
    },
    {
      key: "institution",
      label: "Campus Tenant",
      render: (row: GlobalDeviceItem) => (
        <Badge variant="light" color="blue" size="sm">
          {row.institution_name}
        </Badge>
      ),
    },
    {
      key: "device_type",
      label: "Type",
      render: (row: GlobalDeviceItem) => (
        <Text size="xs" c="dimmed">
          {typeLabels[row.device_type] ?? row.device_type}
        </Text>
      ),
    },
    {
      key: "heartbeat",
      label: "Live Heartbeat",
      render: (row: GlobalDeviceItem) => (
        <Badge
          color={row.is_online ? "teal" : "gray"}
          size="sm"
          variant={row.is_online ? "filled" : "outline"}
        >
          {row.is_online ? "Online · Active" : "Offline"}
        </Badge>
      ),
    },
    {
      key: "last_activity",
      label: "Last Activity",
      render: (row: GlobalDeviceItem) => (
        <Text size="xs" c="dimmed">
          {row.last_activity ? formatDateTime(row.last_activity) : "Never"}
        </Text>
      ),
    },
  ];

  return (
    <Container size="xl" pt={0} pb="4xl">
      <PageHeader
        title="Global Scanner Fleet"
        subtitle="Live hardware heartbeat monitoring across all registered campus entrance kiosks."
      />

      <DataTable
        columns={columns}
        rows={deviceList}
        loading={loading}
        emptyMessage="No scanner devices connected across institutions."
      />
    </Container>
  );
}
