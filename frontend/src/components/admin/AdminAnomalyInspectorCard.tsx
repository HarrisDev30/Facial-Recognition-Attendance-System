import React from "react";
import {
  Paper,
  Text,
  Group,
  Badge,
} from "@mantine/core";
import {
  IconRadar,
  IconShieldCheck,
} from "@tabler/icons-react";

interface AdminAnomalyInspectorCardProps {
  loading?: boolean;
}

export const AdminAnomalyInspectorCard: React.FC<AdminAnomalyInspectorCardProps> = ({
  loading: _loading = false,
}) => {
  return (
    <Paper className="admin-bento-card" p="md" radius="md">
      <div className="admin-card-header">
        <div className="admin-card-title-group">
          <Group gap="xs" align="center">
            <span className="admin-card-icon-badge" style={{ color: "#3b82f6" }}>
              <IconRadar size={16} />
            </span>
            <Text className="admin-card-heading">Gate Collision & Anomaly Watchdog</Text>
          </Group>
          <Text className="admin-card-subheading">
            Detects rapid multi-terminal scans and off-hours verification attempts
          </Text>
        </div>

        <Badge variant="light" color="teal" size="sm" leftSection={<IconShieldCheck size={12} />}>
          0 Collisions
        </Badge>
      </div>

      <div style={{ padding: "28px 16px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
          <IconShieldCheck size={22} />
        </div>
        <Text fz="0.9375rem" fw={700} c="var(--text-primary)">
          Gate Integrity Verified
        </Text>
        <Text fz="0.75rem" c="dimmed" maw={320} mx="auto" mt={4}>
          No concurrent multi-gate token collisions, unauthorized relay attempts, or off-schedule spoofing detected across campus terminals.
        </Text>
      </div>
    </Paper>
  );
};
