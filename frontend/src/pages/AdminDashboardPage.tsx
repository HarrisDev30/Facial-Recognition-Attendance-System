import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Paper,
  Text,
  Group,
  Badge,
  Button,
  SimpleGrid,
  Alert,
  Skeleton,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconDeviceLaptop,
  IconActivity,
  IconPlus,
  IconUserPlus,
  IconMapPin,
  IconClock,
} from "@tabler/icons-react";
import { getEvents } from "../api/events";
import { getAttendees } from "../api/attendees";
import { getActiveSessions } from "../api/marshal";
import { listDevices } from "../api/devices";
import type { EventResponse } from "../types/event";
import type { ActiveSession } from "../api/marshal";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../utils/constants";
import { formatDate, formatTime } from "../utils/formatters";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [totalEvents, setTotalEvents] = useState<number | null>(null);
  const [totalAttendees, setTotalAttendees] = useState<number | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [totalDevices, setTotalDevices] = useState<number | null>(null);
  const [recentEvents, setRecentEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(false);
    try {
      const [eventsRes, attendees, sessions, devices] = await Promise.all([
        getEvents(0, 1),
        getAttendees(),
        getActiveSessions().catch(() => [] as ActiveSession[]),
        listDevices().catch(() => []),
      ]);
      setTotalEvents(eventsRes.total);
      setTotalAttendees(attendees.length);
      setActiveSessions(sessions);
      setTotalDevices(devices.length);

      const recent = await getEvents(0, 5);
      setRecentEvents(recent.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const activeChecks = activeSessions.reduce(
    (sum, s) => sum + (s.checked_in_count || 0),
    0,
  );
  const totalRegistered =
    activeSessions.length > 0 && activeSessions[0].total_registered
      ? activeSessions.reduce(
          (sum, s) => sum + (s.total_registered || 0),
          0,
        )
      : null;
  const attendanceRate =
    totalRegistered && totalRegistered > 0
      ? Math.round((activeChecks / totalRegistered) * 100)
      : null;

  return (
    <Container size="xl" pt={0} pb="4xl">
      <Box mb="xl">
        <Text component="h1" fz="2rem" fw={700} lh={1.2} mb={4}>
          Dashboard
        </Text>
        <Text size="md" c="dimmed">
          Overview of your attendance system
        </Text>
      </Box>

      {error && (
        <Alert
          color="red"
          variant="light"
          mb="xl"
          withCloseButton
          onClose={() => setError(false)}
        >
          Could not load dashboard data.{" "}
          <Button
            variant="subtle"
            size="compact-xs"
            onClick={loadDashboard}
            ml="xs"
            color="red"
          >
            Retry
          </Button>
        </Alert>
      )}

      {/* Stat Cards */}
      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md" mb="md">
        <Paper p="md" radius="md" bg="rgba(34, 211, 238, 0.06)">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
            Events
          </Text>
          <Text size="2rem" fw={700} lh={1} c="#22d3ee">
            {!loading ? (totalEvents ?? "\u2014") : "\u2014"}
          </Text>
        </Paper>
        <Paper p="md" radius="md" bg="rgba(34, 197, 94, 0.06)">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
            Active Sessions
          </Text>
          <Text size="2rem" fw={700} lh={1} c="#22c55e">
            {!loading ? activeSessions.length : "\u2014"}
          </Text>
        </Paper>
        <Paper p="md" radius="md" bg="rgba(168, 85, 247, 0.06)">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
            Attendees
          </Text>
          <Text size="2rem" fw={700} lh={1} c="#a855f7">
            {!loading ? (totalAttendees ?? "\u2014") : "\u2014"}
          </Text>
        </Paper>
        <Paper p="md" radius="md" bg="rgba(249, 115, 22, 0.06)">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
            Devices
          </Text>
          <Text size="2rem" fw={700} lh={1} c="#f97316">
            {!loading ? (totalDevices ?? "\u2014") : "\u2014"}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Attendance context */}
      {attendanceRate !== null && (
        <Paper p="sm" radius="md" bg="var(--surface-1)" mb="xl">
          <Group gap="xs" wrap="wrap">
            <Text size="sm" c="dimmed">
              Today across {activeSessions.length} active session
              {activeSessions.length !== 1 ? "s" : ""}:
            </Text>
            <Group gap={4}>
              <IconActivity size={14} style={{ opacity: 0.6 }} />
              <Text size="sm" fw={600}>
                {activeChecks} checked in
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              of {totalRegistered}
            </Text>
            <Badge
              size="sm"
              variant="filled"
              color={attendanceRate >= 75 ? "green" : "orange"}
            >
              {attendanceRate}%
            </Badge>
          </Group>
        </Paper>
      )}

      {/* Quick Actions */}
      <Paper p="md" radius="md" bg="var(--surface-1)" mb="xl">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
          Quick Actions
        </Text>
        <Group gap="sm" wrap="wrap">
          <Button
            size="sm"
            variant="filled"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate("/admin/events")}
          >
            Create Event
          </Button>
          <Button
            size="sm"
            variant="default"
            leftSection={<IconUserPlus size={16} />}
            onClick={() => navigate("/admin/attendees")}
          >
            Add Attendee
          </Button>
          <Button
            size="sm"
            variant="default"
            leftSection={<IconDeviceLaptop size={16} />}
            onClick={() => navigate("/admin/scanner-devices")}
          >
            Scanner Devices
          </Button>
        </Group>
      </Paper>

      {/* Asymmetric Grid */}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="xl">
        {/* Left: Active Sessions (span 2) */}
        <div style={{ gridColumn: "span 2" }}>
          <Group justify="space-between" mb="md">
            <Text size="lg" fw={600}>
              Active Sessions
            </Text>
            {activeSessions.length > 0 && (
              <Button
                variant="subtle"
                size="xs"
                onClick={() => navigate("/admin/events")}
              >
                View all
              </Button>
            )}
          </Group>

          {loading ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {Array.from({ length: 2 }).map((_, i) => (
                <Paper key={i} p="md" radius="md" bg="var(--surface-1)">
                  <Skeleton height={16} width="60%" mb={8} />
                  <Skeleton height={12} width="40%" mb={12} />
                  <Skeleton height={12} width="30%" />
                </Paper>
              ))}
            </SimpleGrid>
          ) : activeSessions.length === 0 ? (
            <Paper p="xl" radius="md" bg="var(--surface-1)" ta="center">
              <IconCalendarEvent size={32} style={{ opacity: 0.15 }} />
              <Text c="dimmed" size="sm" mt="md">
                No active sessions
              </Text>
              <Button
                variant="default"
                size="xs"
                mt="sm"
                onClick={() => navigate("/admin/events")}
              >
                Manage events
              </Button>
            </Paper>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {activeSessions.map((s) => (
                <Paper
                  key={s.session_id}
                  p="md"
                  radius="md"
                  bg="rgba(34, 197, 94, 0.04)"
                  style={{
                    cursor: "pointer",
                    transition: "transform 0.15s ease, background-color 0.15s ease",
                  }}
                  onClick={() => navigate(`/scanner/${s.session_id}`)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "rgba(34, 197, 94, 0.08)";
                    (e.currentTarget as HTMLElement).style.transform =
                      "scale(1.01)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "rgba(34, 197, 94, 0.04)";
                    (e.currentTarget as HTMLElement).style.transform =
                      "scale(1)";
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Badge
                      size="xs"
                      color={EVENT_TYPE_COLORS[s.event_type ?? ""] || "gray"}
                    >
                      {EVENT_TYPE_LABELS[s.event_type ?? ""] || s.event_type}
                    </Badge>
                    <Badge size="xs" color="green" variant="filled">
                      Active
                    </Badge>
                  </Group>
                  <Text fw={600} size="sm" mb={4}>
                    {s.session_name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1} mb="xs">
                    {s.event_name}
                  </Text>
                  <Group gap="lg" mb="sm">
                    <Group gap={4}>
                      <IconMapPin size={12} style={{ opacity: 0.5 }} />
                      <Text size="xs" c="dimmed">
                        {s.venue || "\u2014"}
                      </Text>
                    </Group>
                    <Group gap={4}>
                      <IconClock size={12} style={{ opacity: 0.5 }} />
                      <Text size="xs" c="dimmed">
                        {formatTime(s.start_time)}
                      </Text>
                    </Group>
                  </Group>
                  <Text size="xs" fw={600}>
                    {s.checked_in_count ?? 0} / {s.total_registered ?? "\u2014"}{" "}
                    checked in
                  </Text>
                </Paper>
              ))}
            </SimpleGrid>
          )}
        </div>

        {/* Right: Recent Events */}
        <div>
          <Group justify="space-between" mb="md">
            <Text size="lg" fw={600}>
              Recent Events
            </Text>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => navigate("/admin/events")}
            >
              View all
            </Button>
          </Group>

          {loading ? (
            <Paper p="md" radius="md" bg="var(--surface-1)">
              {Array.from({ length: 3 }).map((_, i) => (
                <Box key={i} mb={i < 2 ? "md" : 0}>
                  <Skeleton height={14} width="80%" mb={6} />
                  <Skeleton height={12} width="50%" />
                </Box>
              ))}
            </Paper>
          ) : recentEvents.length === 0 ? (
            <Paper p="xl" radius="md" bg="var(--surface-1)" ta="center">
              <IconCalendarEvent size={32} style={{ opacity: 0.15 }} />
              <Text c="dimmed" size="sm" mt="md">
                No events yet
              </Text>
              <Button
                variant="default"
                size="xs"
                mt="sm"
                onClick={() => navigate("/admin/events")}
              >
                Create your first event
              </Button>
            </Paper>
          ) : (
            <Paper radius="md" bg="var(--surface-1)" style={{ overflow: "hidden" }}>
              {recentEvents.map((ev, i) => (
                <Group
                  key={ev.id}
                  p="md"
                  wrap="nowrap"
                  style={{
                    cursor: "pointer",
                    borderBottom:
                      i < recentEvents.length - 1
                        ? "1px solid var(--border-subtle)"
                        : undefined,
                    transition: "background-color 0.15s ease",
                  }}
                  onClick={() =>
                    navigate(`/admin/events/${ev.id}/sessions`)
                  }
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--mantine-radius-md)",
                      background: "var(--surface-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconCalendarEvent size={18} style={{ opacity: 0.6 }} />
                  </Box>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="sm" fw={600} truncate="end">
                        {ev.name}
                      </Text>
                      <Badge
                        size="xs"
                        variant="light"
                        color={
                          EVENT_TYPE_COLORS[ev.event_type] || "gray"
                        }
                        style={{ flexShrink: 0 }}
                      >
                        {EVENT_TYPE_LABELS[ev.event_type] ||
                          ev.event_type}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {formatDate(ev.start_date)}{" "}
                      {"\u2013"} {formatDate(ev.end_date)}
                      {ev.venue ? ` \u00b7 ${ev.venue}` : ""}
                    </Text>
                  </div>
                </Group>
              ))}
            </Paper>
          )}
        </div>
      </SimpleGrid>
    </Container>
  );
}
