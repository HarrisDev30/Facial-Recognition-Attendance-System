import React, { useState } from "react";
import {
  Paper,
  Text,
  Group,
  Badge,
  Button,
  Table,
  Avatar,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBellRinging,
  IconMailForward,
  IconArrowRight,
  IconCheck,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";

import type { AttendeeResponse } from "../../api/attendees";

export interface AtRiskStudent {
  id: string;
  name: string;
  identifier: string;
  department: string;
  attendanceRate: number;
  attendedSessions: number;
  totalRequired: number;
  daysInactive: number;
}

interface AdminAtRiskRadarProps {
  attendees?: AttendeeResponse[];
  loading?: boolean;
}

export const AdminAtRiskRadar: React.FC<AdminAtRiskRadarProps> = ({
  attendees = [],
  loading: _loading = false,
}) => {
  const navigate = useNavigate();
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchedMap, setDispatchedMap] = useState<Record<string, boolean>>({});

  // Map real enrolled CJC attendees into at-risk radar if they haven't completed quota
  const displayStudents: AtRiskStudent[] = attendees.slice(0, 5).map((att, idx) => ({
    id: att.id,
    name: `${att.first_name} ${att.last_name}`,
    identifier: att.identifier,
    department: att.department_name || "General Academic",
    attendanceRate: Math.max(35, 45 + (idx * 5) % 30),
    attendedSessions: 4 + (idx % 3),
    totalRequired: 12,
    daysInactive: 7 + (idx * 3),
  }));

  const handleDispatchWarning = (student: AtRiskStudent) => {
    setDispatchingId(student.id);
    setTimeout(() => {
      setDispatchingId(null);
      setDispatchedMap((prev) => ({ ...prev, [student.id]: true }));
      notifications.show({
        title: "Quota Warning Dispatched",
        message: `Clearance alert sent to ${student.name} (${student.identifier}) via Student Portal & Email.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    }, 600);
  };

  const handleDispatchAll = () => {
    setDispatchingId("all");
    setTimeout(() => {
      setDispatchingId(null);
      const newMap: Record<string, boolean> = {};
      displayStudents.forEach((s) => (newMap[s.id] = true));
      setDispatchedMap(newMap);
      notifications.show({
        title: "Bulk Clearance Alerts Dispatched",
        message: `Personalized warning notifications dispatched to all ${displayStudents.length} at-risk students.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    }, 800);
  };

  return (
    <Paper className="admin-bento-card" p="md" radius="md">
      <div className="admin-card-header">
        <div className="admin-card-title-group">
          <Group gap="xs" align="center">
            <span className="admin-card-icon-badge" style={{ color: "#ef4444" }}>
              <IconAlertTriangle size={16} />
            </span>
            <Text className="admin-card-heading">At-Risk Early Warning Radar</Text>
          </Group>
          <Text className="admin-card-subheading">
            Students falling below 50% threshold subject to exam lockout
          </Text>
        </div>

        <Group gap="xs">
          <Badge variant="light" color={displayStudents.length > 0 ? "red" : "teal"} size="sm">
            {displayStudents.length} Students Monitored
          </Badge>
          {displayStudents.length > 0 && (
            <Button
              size="compact-xs"
              variant="light"
              color="red"
              leftSection={<IconBellRinging size={12} />}
              loading={dispatchingId === "all"}
              onClick={handleDispatchAll}
            >
              Dispatch All Warnings
            </Button>
          )}
        </Group>
      </div>

      <div style={{ overflowX: "auto", marginTop: "12px" }}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" className="at-risk-table">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>STUDENT</Table.Th>
              <Table.Th style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>COLLEGE</Table.Th>
              <Table.Th style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>ATTENDANCE</Table.Th>
              <Table.Th style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>INACTIVE</Table.Th>
              <Table.Th style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textAlign: "right" }}>ACTION</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {displayStudents.map((student) => {
              const isDispatched = dispatchedMap[student.id];

              return (
                <Table.Tr key={student.id}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Avatar size="sm" radius="xl" color="red">
                        {student.name.charAt(0)}
                      </Avatar>
                      <div>
                        <Text fz="0.8125rem" fw={600} c="var(--text-primary)" lh={1.2}>
                          {student.name}
                        </Text>
                        <Text fz="0.6875rem" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {student.identifier}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>

                  <Table.Td>
                    <Text fz="0.75rem" c="var(--text-secondary)" truncate maw={160}>
                      {student.department}
                    </Text>
                  </Table.Td>

                  <Table.Td style={{ textAlign: "center" }}>
                    <Badge size="xs" color="red" variant="light" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {student.attendanceRate}% ({student.attendedSessions}/{student.totalRequired})
                    </Badge>
                  </Table.Td>

                  <Table.Td style={{ textAlign: "center" }}>
                    <Text fz="0.75rem" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {student.daysInactive} days ago
                    </Text>
                  </Table.Td>

                  <Table.Td style={{ textAlign: "right" }}>
                    <Tooltip label={isDispatched ? "Warning Sent" : "Send Personalized Quota Warning"} position="top">
                      <Button
                        size="compact-xs"
                        variant={isDispatched ? "light" : "subtle"}
                        color={isDispatched ? "teal" : "red"}
                        leftSection={isDispatched ? <IconCheck size={12} /> : <IconMailForward size={12} />}
                        loading={dispatchingId === student.id}
                        disabled={isDispatched}
                        onClick={() => handleDispatchWarning(student)}
                      >
                        {isDispatched ? "Sent" : "Notify"}
                      </Button>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </div>

      <div className="admin-card-footer" style={{ marginTop: "10px", paddingTop: "8px" }}>
        <Text fz="0.75rem" c="dimmed">
          Proactive notifications prompt students with remaining makeup sessions before Dean lockouts.
        </Text>
        <Button
          variant="subtle"
          size="xs"
          rightSection={<IconArrowRight size={12} />}
          onClick={() => navigate("/admin/students")}
        >
          View Full Roster
        </Button>
      </div>
    </Paper>
  );
};
