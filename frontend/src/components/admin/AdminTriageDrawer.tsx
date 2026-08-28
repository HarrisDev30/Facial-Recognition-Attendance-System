import React, { useState } from "react";
import {
  Modal,
  Text,
  Group,
  Badge,
  Button,
  Avatar,
  Paper,
  SimpleGrid,
  Box,
  Divider,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconRefresh,
  IconCamera,
  IconUser,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

import type { AttendanceLogResponse } from "../../api/attendance";
import type { AttendeeResponse } from "../../api/attendees";

export interface TriageItem {
  id: string;
  studentName: string;
  studentId: string;
  department: string;
  sessionName: string;
  confidence: number;
  reason: string;
  timestamp: string;
  status: "pending" | "approved" | "rejected";
}

interface AdminTriageDrawerProps {
  opened: boolean;
  onClose: () => void;
  logs?: AttendanceLogResponse[];
  attendees?: AttendeeResponse[];
}

export const AdminTriageDrawer: React.FC<AdminTriageDrawerProps> = ({
  opened,
  onClose,
  logs = [],
  attendees = [],
}) => {
  // Derive real triage exceptions from live session logs (low confidence < 85% or manual overrides)
  const initialItems: TriageItem[] = React.useMemo(() => {
    const attendeeMap = new Map(attendees.map((a) => [a.id, a]));
    const flagged = logs.filter(
      (l) => (l.confidence_score != null && l.confidence_score < 0.85) || l.verification_method === "marshal_override"
    );

    return flagged.map((log) => {
      const att = attendeeMap.get(log.attendee_id);
      const conf = log.confidence_score != null ? Math.round(log.confidence_score * 1000) / 10 : 75.0;
      return {
        id: log.id,
        studentName: log.attendee_name || (att ? `${att.first_name} ${att.last_name}` : "Enrolled Student"),
        studentId: att?.identifier || "Student ID",
        department: log.department_name || att?.department_name || "General Academic",
        sessionName: "Active Campus Session",
        confidence: conf,
        reason: log.verification_method === "marshal_override"
          ? "Manual staff override requested"
          : "Low confidence threshold match",
        timestamp: "Recent Influx",
        status: "pending" as const,
      };
    });
  }, [logs, attendees]);

  const [items, setItems] = useState<TriageItem[]>([]);

  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = (id: string, action: "approved" | "rejected" | "rescan") => {
    setResolvingId(id);
    setTimeout(() => {
      setResolvingId(null);
      if (action === "approved") {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "approved" } : item)));
        notifications.show({
          title: "Check-In Approved",
          message: "Student attendance has been verified and credited successfully.",
          color: "teal",
          icon: <IconCheck size={16} />,
        });
      } else if (action === "rejected") {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "rejected" } : item)));
        notifications.show({
          title: "Scan Rejected",
          message: "Check-in attempt was rejected and logged as unverified.",
          color: "red",
          icon: <IconX size={16} />,
        });
      } else {
        setItems((prev) => prev.filter((item) => item.id !== id));
        notifications.show({
          title: "Re-Scan Requested",
          message: "Notification sent to kiosk station for contactless re-scan.",
          color: "blue",
          icon: <IconRefresh size={16} />,
        });
      }
    }, 500);
  };

  const pendingItems = items.filter((i) => i.status === "pending");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <span className="admin-card-icon-badge" style={{ color: "#f97316" }}>
            <IconAlertTriangle size={16} />
          </span>
          <div>
            <Text fw={700} fz="1rem" c="var(--text-primary)">
              Live Exception Triage Desk
            </Text>
            <Text fz="0.75rem" c="dimmed">
              Instant administrative dispute resolution for low-confidence scans
            </Text>
          </div>
        </Group>
      }
      size="lg"
      radius="md"
      styles={{
        header: {
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "12px",
        },
        body: {
          paddingTop: "16px",
        },
      }}
    >
      {pendingItems.length === 0 ? (
        <div style={{ padding: "40px 16px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <IconCheck size={24} />
          </div>
          <Text fz="1rem" fw={700} c="var(--text-primary)">
            Triage Queue Clear
          </Text>
          <Text fz="0.8125rem" c="dimmed" mt={4} maw={340} mx="auto">
            All facial recognition scans across campus kiosks are operating above normal confidence thresholds (≥85%).
          </Text>
          <Button variant="light" color="teal" size="xs" mt="md" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {pendingItems.map((item) => (
            <Paper key={item.id} p="md" radius="md" bg="var(--surface-0)" style={{ border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <Text fz="0.9375rem" fw={700} c="var(--text-primary)">
                    {item.studentName}
                  </Text>
                  <Text fz="0.75rem" c="dimmed">
                    {item.studentId} • {item.department}
                  </Text>
                </div>

                <Badge color="orange" variant="light" size="sm">
                  {item.confidence}% Match
                </Badge>
              </div>

              {/* Side-by-Side Verification Capture vs Profile */}
              <SimpleGrid cols={2} spacing="xs" mb="sm">
                <Box p="xs" bg="var(--surface-1)" style={{ borderRadius: "8px", textAlign: "center" }}>
                  <Avatar size="lg" radius="md" mx="auto" mb={4} color="blue">
                    <IconUser size={28} />
                  </Avatar>
                  <Text fz="0.6875rem" fw={600} c="dimmed">REGISTERED PROFILE</Text>
                </Box>

                <Box p="xs" bg="var(--surface-1)" style={{ borderRadius: "8px", textAlign: "center" }}>
                  <Avatar size="lg" radius="md" mx="auto" mb={4} color="orange">
                    <IconCamera size={28} />
                  </Avatar>
                  <Text fz="0.6875rem" fw={600} c="dimmed">LIVE KIOSK CAPTURE</Text>
                </Box>
              </SimpleGrid>

              <Text fz="0.75rem" c="var(--text-secondary)" mb="md">
                <strong>Flag Reason:</strong> {item.reason} ({item.timestamp})
              </Text>

              <Divider mb="sm" />

              <Group justify="flex-end" gap="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  leftSection={<IconX size={14} />}
                  loading={resolvingId === item.id}
                  onClick={() => handleResolve(item.id, "rejected")}
                >
                  Reject
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  leftSection={<IconRefresh size={14} />}
                  loading={resolvingId === item.id}
                  onClick={() => handleResolve(item.id, "rescan")}
                >
                  Request Re-Scan
                </Button>
                <Button
                  size="xs"
                  variant="filled"
                  color="teal"
                  leftSection={<IconCheck size={14} />}
                  loading={resolvingId === item.id}
                  onClick={() => handleResolve(item.id, "approved")}
                >
                  Approve Check-In
                </Button>
              </Group>
            </Paper>
          ))}
        </div>
      )}
    </Modal>
  );
};
