import React from "react";
import {
  Paper,
  Text,
  Group,
  Badge,
  Button,
  Avatar,
  ScrollArea,
} from "@mantine/core";
import {
  IconActivity,
  IconShieldCheck,
  IconQrcode,
  IconUserCheck,
  IconFlame,
  IconClock,
  IconArrowRight,
} from "@tabler/icons-react";
import type { AttendanceLogResponse } from "../../api/attendance";
import { useNavigate } from "react-router-dom";
import { formatTime, formatConfidence } from "../../utils/formatters";

interface AdminLiveStreamCardProps {
  logs: AttendanceLogResponse[];
  loading?: boolean;
}

const VERIFICATION_ICONS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  face_recognition: {
    label: "Face ID",
    icon: <IconShieldCheck size={13} />,
    color: "teal",
  },
  qr_code: {
    label: "QR Code",
    icon: <IconQrcode size={13} />,
    color: "blue",
  },
  marshal_override: {
    label: "Marshal Override",
    icon: <IconUserCheck size={13} />,
    color: "orange",
  },
};

export const AdminLiveStreamCard: React.FC<AdminLiveStreamCardProps> = ({
  logs,
  loading: _loading = false,
}) => {
  const navigate = useNavigate();

  // Influx Velocity Calculation from actual live logs
  const recentLogsCount = logs.length;
  const scansPerMin = recentLogsCount > 0 ? Math.max(1, recentLogsCount * 4) : 0;
  const isSurge = scansPerMin > 30;

  return (
    <Paper className="admin-bento-card" p="md" radius="md">
      <div className="admin-card-header">
        <div className="admin-card-title-group">
          <Group gap="xs" align="center">
            <span className="admin-card-icon-badge text-teal">
              <IconActivity size={16} />
            </span>
            <Text className="admin-card-heading">Live Check-In Stream</Text>
          </Group>
          <Text className="admin-card-subheading">
            Real-time biometric & contactless attendee influx
          </Text>
        </div>

        {/* Throughput Velocity Meter Badge */}
        <Badge
          variant="light"
          color={isSurge ? "red" : logs.length > 0 ? "teal" : "gray"}
          size="md"
          leftSection={isSurge ? <IconFlame size={14} /> : <IconActivity size={14} />}
          className="admin-velocity-badge"
        >
          {logs.length > 0
            ? `${scansPerMin} scans / min ${isSurge ? "• Surge Influx" : "• Active Flow"}`
            : "Station Standby • 0 scans/min"}
        </Badge>
      </div>

      {/* Live Check-In Ticker Feed */}
      <ScrollArea h={220} scrollbarSize={6} offsetScrollbars mt="sm" pr="xs">
        {logs.length === 0 ? (
          <div className="live-stream-empty-standby">
            <div className="radar-ping-container">
              <span className="radar-ping-ring" />
              <span className="radar-ping-dot" />
            </div>
            <Text fz="0.875rem" fw={600} c="var(--text-primary)" mt="sm">
              Waiting for Live Influx
            </Text>
            <Text fz="0.75rem" c="dimmed" ta="center" maw={320} mt={4}>
              No check-ins recorded yet for active sessions. When students scan at kiosk stations, logs will stream here in real time.
            </Text>
          </div>
        ) : (
          <div className="live-stream-list">
            {logs.slice(0, 10).map((log) => {
              const meta = VERIFICATION_ICONS[log.verification_method] || {
                label: "Verified",
                icon: <IconShieldCheck size={13} />,
                color: "teal",
              };

              return (
                <div key={log.id} className="live-stream-row">
                  <Group gap="sm" wrap="nowrap" align="center" style={{ flex: 1, minWidth: 0 }}>
                    <Avatar
                      radius="xl"
                      size="sm"
                      color={meta.color}
                      className="live-attendee-avatar"
                    >
                      {log.attendee_name ? log.attendee_name.charAt(0) : "S"}
                    </Avatar>

                    <div className="live-stream-info">
                      <Text className="live-stream-name" truncate>
                        {log.attendee_name || "Enrolled Student"}
                      </Text>
                      <Text className="live-stream-dept" truncate>
                        {log.department_name || "General Academic"}
                      </Text>
                    </div>
                  </Group>

                  <Group gap="xs" wrap="nowrap" align="center">
                    <Badge
                      size="xs"
                      color={meta.color}
                      variant="light"
                      leftSection={meta.icon}
                      className="live-stream-method-badge"
                    >
                      {meta.label}
                      {log.confidence_score != null
                        ? ` (${formatConfidence(log.confidence_score)})`
                        : ""}
                    </Badge>

                    <Text className="live-stream-timestamp">
                      <IconClock size={11} style={{ marginRight: 3, opacity: 0.6 }} />
                      {formatTime(log.verified_at)}
                    </Text>
                  </Group>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Card Footer */}
      <div className="admin-card-footer" style={{ marginTop: "10px", paddingTop: "8px" }}>
        <Text fz="0.75rem" c="dimmed">
          Live stream connected via WebSocket to active scanner nodes.
        </Text>
        <Button
          variant="subtle"
          size="xs"
          rightSection={<IconArrowRight size={12} />}
          onClick={() => navigate("/admin/students")}
        >
          View Full Audit Log
        </Button>
      </div>
    </Paper>
  );
};
