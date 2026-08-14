import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  SimpleGrid,
  Paper,
  Group,
  Badge,
  Button,
  Box,
  Alert,
  Skeleton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconMapPin,
  IconClock,
} from "@tabler/icons-react";
import { useAuthStore } from "../store/authStore";
import {
  getMyAttendanceLogs,
  getMyAttendanceSummary,
} from "../api/attendees";
import { getAllEvents } from "../api/events";
import type {
  AttendanceLogEntry,
  AttendanceSummary,
} from "../types/auth";
import type { UpcomingEvent } from "../types/event";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../utils/constants";
import { formatDate, formatTime } from "../utils/formatters";

const TYPE_BAR_COLORS: Record<string, string> = {
  intramurals: "#a78bfa",
  seminar: "#60a5fa",
  workshop: "#22d3ee",
  conference: "#c084fc",
  campus_activity: "#2dd4bf",
  assembly: "#fb923c",
};

const VERIFICATION_LABELS: Record<string, string> = {
  face_recognition: "Face",
  qr_code: "QR",
  marshal_override: "Manual",
};

const VERIFICATION_COLORS: Record<string, { bg: string; fg: string }> = {
  face_recognition: { bg: "rgba(59, 130, 246, 0.12)", fg: "#3b82f6" },
  marshal_override: { bg: "rgba(249, 115, 22, 0.12)", fg: "#f97316" },
  qr_code: { bg: "rgba(34, 211, 238, 0.12)", fg: "#22d3ee" },
};

export default function StudentDashboardPage() {
  const { user } = useAuthStore();
  const firstName = user?.first_name || user?.email?.split("@")[0] || "there";
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [logs, setLogs] = useState<AttendanceLogEntry[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [logRes, summaryRes, upcomingRes] = await Promise.all([
        getMyAttendanceLogs({ page: 1, size: 3, sort: "date_desc" }),
        getMyAttendanceSummary(),
        getAllEvents(1, 5),
      ]);
      setLogs(logRes.items);
      setSummary(summaryRes);
      setUpcoming(upcomingRes.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const activeEvents = useMemo(
    () => upcoming.filter((e) => e.active_sessions_count > 0),
    [upcoming],
  );

  const typeEntries = useMemo(() => {
    if (!summary?.attendance_by_type) return [];
    return Object.entries(summary.attendance_by_type)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({
        type,
        label: EVENT_TYPE_LABELS[type] || type.replace(/_/g, " "),
        count,
        color: TYPE_BAR_COLORS[type] || "#888888",
      }));
  }, [summary]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Container size="xl" pt={0} pb="4xl">
      {/* Greeting */}
      <Box mb="xl">
        <Text component="h1" fz={{ base: "1.5rem", md: "2rem" }} fw={700} lh={1.2} mb={4}>
          Welcome back, {firstName}
        </Text>
        <Text size="md" c="dimmed">
          {today}
        </Text>
       </Box>

      {error && (
        <Alert color="red" variant="light" mb="xl" withCloseButton onClose={() => setError(false)}>
          Could not load your dashboard. <Button variant="subtle" size="compact-xs" onClick={loadData} ml="xs" color="red">Retry</Button>
        </Alert>
      )}

      {/* Active Now */}
      {activeEvents.length > 0 && (
        <Paper
          p="md"
          radius="md"
          mb="xl"
          bg="rgba(34, 197, 94, 0.06)"
          style={{
            boxShadow: "0 0 20px 2px rgba(34, 197, 94, 0.06)",
          }}
        >
          <Group justify="space-between" wrap="wrap" gap="md">
            <Group gap="sm" wrap="wrap">
              <Badge
                variant="light"
                size="md"
                styles={{
                  root: {
                    background: "rgba(34, 197, 94, 0.12)",
                    color: "#22c55e",
                  },
                  label: { textTransform: "uppercase" as const },
                }}
                leftSection={<span className="pulse-dot" />}
              >
                ACTIVE NOW
              </Badge>
              {activeEvents.map((ev) => (
                <div key={ev.id}>
                  <Text fw={600} size="sm">
                    {ev.name}
                  </Text>
                  <Group gap={4}>
                    <IconMapPin size={12} style={{ opacity: 0.5 }} />
                    <Text size="xs" c="dimmed">
                      {ev.venue || "No venue"}
                    </Text>
                    <Text size="xs" c="dimmed" span>
                      {"\u00b7"} {ev.active_sessions_count} session
                      {ev.active_sessions_count !== 1 ? "s" : ""}
                    </Text>
                  </Group>
                </div>
              ))}
            </Group>
            <Button
              color="green"
              variant="filled"
              fullWidth={isMobile}
              onClick={() =>
                navigate(`/student/events/${activeEvents[0]?.id}`)
              }
            >
              Check In
            </Button>
          </Group>
        </Paper>
      )}

        {/* Stat Cards */}
      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md" mb="xl">
        <Paper
          p="md"
          radius="md"
          bg="rgba(45, 212, 191, 0.06)"
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
            Events Attended
          </Text>
          <Text size="2.25rem" fw={700} lh={1} c="#2dd4bf">
            {!loading ? (summary?.total_events_attended ?? 0) : "\u2014"}
          </Text>
        </Paper>
        <Paper
          p="md"
          radius="md"
          bg="rgba(34, 197, 94, 0.06)"
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
            Attendance Rate
          </Text>
          <Text size="2.25rem" fw={700} lh={1} c="#22c55e">
            {!loading ? (summary ? `${summary.attendance_rate}%` : "0%") : "\u2014"}
          </Text>
        </Paper>
        <Paper
          p="md"
          radius="md"
          bg="rgba(59, 130, 246, 0.06)"
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
            Last Check-in
          </Text>
          <Text size="2.25rem" fw={700} lh={1} c="#3b82f6">
            {!loading ? (
              summary?.last_attendance
                ? formatDate(summary.last_attendance)
                : "\u2014"
            ) : "\u2014"}
          </Text>
        </Paper>
        <Paper
          p="md"
          radius="md"
          bg="rgba(168, 85, 247, 0.06)"
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
            Active Now
          </Text>
          <Text size="2.25rem" fw={700} lh={1} c="#a855f7">
            {!loading ? activeEvents.length : "\u2014"}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Asymmetric Grid */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
        {/* Left Column (2/3) */}
        <div style={{ gridColumn: "span 2" }}>
          {/* Recent Logs */}
          <Box mb="xl">
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>
                Recent Logs
              </Text>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => navigate("/student/attendance")}
              >
                View All
              </Button>
            </Group>

            {loading ? (
              <Paper p="md" radius="md" bg="var(--surface-1)">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Group key={i} align="flex-start" wrap="nowrap" mb={i < 2 ? "md" : 0}>
                    <Skeleton circle width={40} height={40} radius="md" />
                    <Box style={{ flex: 1 }}>
                      <Skeleton height={16} width="70%" mb={6} />
                      <Skeleton height={12} width="50%" />
                    </Box>
                  </Group>
                ))}
              </Paper>
            ) : logs.length === 0 ? (
              <Paper p="lg" radius="md" bg="var(--surface-1)" ta="center">
                <Text size="sm" c="dimmed">
                  No attendance records yet.
                </Text>
              </Paper>
            ) : (
              <Paper radius="md" bg="var(--surface-1)" style={{ overflow: "hidden" }}>
                {logs.map((row) => {
                  const vc = VERIFICATION_COLORS[row.verification_method];
                  return (
                    <Group
                      key={row.id}
                      align="flex-start"
                      wrap="nowrap"
                      p="md"
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "var(--mantine-radius-md)",
                          background: "var(--surface-2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconClock size={20} style={{ opacity: 0.6 }} />
                      </Box>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Group justify="space-between" wrap="nowrap" gap="xs">
                          <Text size="sm" fw={600} style={{ wordBreak: "break-word" }}>
                            {row.event_name}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            style={{ flexShrink: 0 }}
                            styles={{
                              root: {
                                background: vc ? vc.bg : "rgba(136, 136, 136, 0.12)",
                                color: vc ? vc.fg : "#888888",
                              },
                            }}
                          >
                            {VERIFICATION_LABELS[row.verification_method] ||
                              row.verification_method}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {formatDate(row.session_date || row.check_in_time)}
                          {", "}
                          {formatTime(row.check_in_time)}
                          {" \u00b7 "}
                          {row.session_name || row.venue || "\u2014"}
                        </Text>
                      </div>
                    </Group>
                  );
                })}
              </Paper>
            )}
          </Box>

          {/* Upcoming Events */}
          {upcoming.length > 0 && (
            <Box>
              <Group justify="space-between" mb="md">
                <Text size="lg" fw={600}>
                  Upcoming Events
                </Text>
                <Group gap="xs">
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => navigate("/student/events")}
                  >
                    View All
                  </Button>
                </Group>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {upcoming.slice(0, 4).map((ev) => (
                  <Paper
                    key={ev.id}
                    p={0}
                    radius="md"
                    onClick={() => navigate(`/student/events/${ev.id}`)}
                    style={{
                      overflow: "hidden",
                      cursor: "pointer",
                      background: "var(--surface-1)",
                      border: ev.active_sessions_count > 0
                        ? "1px solid rgba(34, 197, 94, 0.3)"
                        : "1px solid var(--border-subtle)",
                    }}
                  >
                    <Box
                      style={{
                        height: 140,
                        position: "relative",
                        background: ev.photo_url
                          ? `url(${ev.photo_url}) center / cover no-repeat`
                          : `linear-gradient(135deg, var(--mantine-color-${EVENT_TYPE_COLORS[ev.event_type] || "gray"}-9) 0%, var(--mantine-color-${EVENT_TYPE_COLORS[ev.event_type] || "gray"}-7) 100%)`,
                      }}
                    >
                      <Badge
                        color="dark"
                        variant="filled"
                        size="xs"
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          background: "rgba(0,0,0,0.55)",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                      </Badge>
                      {ev.active_sessions_count > 0 && (
                        <Badge
                          color="green"
                          variant="filled"
                          size="xs"
                          leftSection={<span className="pulse-dot" />}
                          style={{ position: "absolute", top: 8, left: 8 }}
                        >
                          {ev.active_sessions_count} active
                        </Badge>
                      )}
                    </Box>
                    <Box p="sm">
                      <Text size="xs" fw={600} c="var(--mantine-color-blue-4)" mb={2}>
                        {formatDate(ev.date)}
                      </Text>
                      <Text size="sm" fw={600} lineClamp={1} mb={4}>
                        {ev.name}
                      </Text>
                      <Group gap={4}>
                        <IconMapPin size={12} style={{ opacity: 0.5 }} />
                        <Text size="xs" c="dimmed" truncate="end">
                          {ev.venue || "No venue"}
                        </Text>
                      </Group>
                    </Box>
                  </Paper>
                ))}
              </SimpleGrid>
            </Box>
          )}
        </div>

        {/* Right Column (1/3) — Attendance by Type */}
        <div>
          {typeEntries.length > 0 && (
            <Paper p="md" radius="md" bg="var(--surface-1)">
              <Text size="md" fw={600} mb="md">
                Attendance by Type
              </Text>
              {typeEntries.map((entry) => (
                <Group key={entry.type} justify="space-between" mb="xs">
                  <Group gap="xs">
                    <Box
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: entry.color,
                        flexShrink: 0,
                      }}
                    />
                    <Text size="sm" c="dimmed">
                      {entry.label}
                    </Text>
                  </Group>
                  <Text size="sm" fw={600}>
                    {entry.count}
                  </Text>
                </Group>
              ))}
            </Paper>
          )}
        </div>
      </SimpleGrid>
    </Container>
  );
}
