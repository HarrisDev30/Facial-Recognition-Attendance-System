import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Text,
  SimpleGrid,
  Group,
  Badge,
  Button,
  Box,
  Alert,
  Skeleton,
  Stack,
  Progress,
  Tooltip,
} from "@mantine/core";
import {
  IconMapPin,
  IconClock,
  IconArrowRight,
  IconAlertCircle,
  IconCheck,
  IconCalendar,
  IconTarget,
  IconChartBar,
  IconHistory,
  IconShieldCheck,
  IconQrcode,
  IconUserCheck,
} from "@tabler/icons-react";
import { useAuthStore } from "../store/authStore";
import { useInstitutionTheme } from "../theme/InstitutionThemeProvider";
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
import { EVENT_TYPE_LABELS } from "../utils/constants";
import { formatDate, formatTime } from "../utils/formatters";
import "./StudentDashboardPage.css";

const TYPE_BAR_COLORS: Record<string, string> = {
  intramurals: "#a78bfa",
  seminar: "#60a5fa",
  workshop: "#22d3ee",
  conference: "#c084fc",
  campus_activity: "#2dd4bf",
  assembly: "#fb923c",
};

const VERIFICATION_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  face_recognition: {
    label: "Face ID Verified",
    icon: <IconShieldCheck size={14} />,
    color: "teal",
  },
  qr_code: {
    label: "QR Code Scan",
    icon: <IconQrcode size={14} />,
    color: "blue",
  },
  marshal_override: {
    label: "Marshal Verified",
    icon: <IconUserCheck size={14} />,
    color: "amber",
  },
};

export default function StudentDashboardPage() {
  const { user } = useAuthStore();
  const { institution } = useInstitutionTheme();
  const firstName = user?.first_name || user?.email?.split("@")[0] || "Student";

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
        getMyAttendanceLogs({ page: 1, size: 5, sort: "date_desc" }),
        getMyAttendanceSummary(),
        getAllEvents(1, 4),
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
      .map(([type, count]) => ({
        type,
        label: EVENT_TYPE_LABELS[type] ?? type,
        count,
        color: TYPE_BAR_COLORS[type] ?? "#94a3b8",
      }))
      .sort((a, b) => b.count - a.count);
  }, [summary]);

  const attendanceRate = summary?.attendance_rate ?? 0;
  const isClearanceSafe = attendanceRate >= 80;
  const nextEvent = upcoming.length > 0 ? upcoming[0] : null;

  // Calculate Countdown / Date Label for Next Event (Never truncated)
  const nextEventHeroText = useMemo(() => {
    if (!nextEvent) return "None Today";
    const eventDate = new Date(nextEvent.date);
    const now = new Date();
    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `In ${diffDays} Days`;
    return formatDate(nextEvent.date);
  }, [nextEvent]);

  // Calculate Clearance Safety Runway Buffer
  const safetyBufferText = useMemo(() => {
    if (!summary) return "Calculating standing...";
    const attended = summary.total_events_attended;
    const total = summary.total_events_available;
    if (total === 0) return "Term in progress";

    if (isClearanceSafe) {
      const allowableMisses = Math.max(0, Math.floor((attended - 0.8 * total) / 0.8));
      if (allowableMisses > 0) {
        return `Buffer: Can miss ${allowableMisses} event${allowableMisses > 1 ? "s" : ""} & stay ≥80%`;
      }
      return "On track (80% target met)";
    } else {
      const needed = Math.max(1, Math.ceil((0.8 * total - attended) / 0.2));
      return `Need ${needed} more session${needed > 1 ? "s" : ""} to reach 80%`;
    }
  }, [summary, isClearanceSafe]);

  // Minimal 6-Month Attendance Rhythm Data
  const rhythmData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("default", { month: "short" });
      const year = d.getFullYear();
      const monthIdx = d.getMonth();

      // Count logs matching this month
      const count = logs.filter((l) => {
        const logDate = new Date(l.check_in_time);
        return logDate.getFullYear() === year && logDate.getMonth() === monthIdx;
      }).length;

      months.push({
        label,
        count,
        isCurrent: i === 0,
      });
    }

    const maxCount = Math.max(1, ...months.map((m) => m.count));
    return months.map((m) => ({
      ...m,
      heightPercent: Math.max(15, (m.count / maxCount) * 100),
    }));
  }, [logs]);

  return (
    <Container size="lg" pt={0} pb="4xl" px={{ base: "xs", sm: "md" }}>
      {/* ─── Header Section ─── */}
      <div className="dash-stagger-1" style={{ marginBottom: 20 }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <div>
            <Text fz={{ base: "1.35rem", sm: "1.65rem" }} fw={700} c="var(--text-primary)" lh={1.2}>
              Welcome back, {firstName}
            </Text>
            <Text fz="0.825rem" c="var(--text-secondary)" mt={2}>
              {institution ? `${institution.name} • ` : ""}Academic Attendance & Clearance Overview
            </Text>
          </div>

          <Group gap="xs" style={{ flexShrink: 0 }}>
            <Badge
              size="sm"
              variant="filled"
              styles={{
                root: {
                  backgroundColor: "var(--brand-surface)",
                  color: "var(--brand-primary)",
                  border: "1px solid var(--brand-border)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                },
              }}
            >
              Goal: 80% Clearance
            </Badge>
          </Group>
        </Group>
      </div>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          mb="lg"
          withCloseButton
          onClose={() => setError(false)}
        >
          Unable to load live dashboard statistics. Please refresh or check connection.
        </Alert>
      )}

      {/* ─── Conditional Live Scanner Banner ─── */}
      {activeEvents.length > 0 && (
        <div className="live-event-banner dash-stagger-1">
          <Group gap="xs" align="center" style={{ minWidth: 0, flex: 1 }}>
            <span className="live-indicator-dot" />
            <div style={{ minWidth: 0 }}>
              <Text fz="0.85rem" fw={700} c="#ef4444" lh={1.3}>
                LIVE SCANNER ACTIVE: {activeEvents[0].name}
              </Text>
              <Text fz="0.725rem" c="var(--text-secondary)" mt={2}>
                {activeEvents[0].venue ?? "Campus Kiosk"} • Check-in is currently open
              </Text>
            </div>
          </Group>

          <Button
            className="btn-brand"
            size="xs"
            component={Link}
            to={`/student/events/${activeEvents[0].id}`}
            style={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            Event Details
          </Button>
        </div>
      )}

      {/* ─── 4-Tile Attendance Telemetry Grid (Harmonious Icons & High-Contrast Typography) ─── */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing={{ base: "xs", sm: "md" }} mb={{ base: "lg", md: "xl" }} className="dash-stagger-2">
        {/* Tile 1: Clearance Rate */}
        <div className={`metric-stat-card ${isClearanceSafe ? "accent-highlight" : ""}`}>
          <div className="metric-stat-label">
            <span>Clearance Standing</span>
            <IconTarget size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          </div>
          <div className="metric-stat-value" style={{ color: isClearanceSafe ? "var(--brand-primary)" : "var(--text-primary)" }}>
            {loading ? <Skeleton height={32} width={60} /> : `${Math.round(attendanceRate)}%`}
          </div>
          <div className="metric-stat-subtext">
            <Badge size="xs" variant="light" color={isClearanceSafe ? "teal" : "amber"} styles={{ root: { width: "fit-content", whiteSpace: "nowrap" } }}>
              {isClearanceSafe ? "On Track (≥80%)" : "Needs Attention"}
            </Badge>
            <Text fz="0.7rem" c="var(--text-secondary)" lh={1.3} mt={2}>
              {loading ? "Checking status..." : safetyBufferText}
            </Text>
          </div>
        </div>

        {/* Tile 2: Sessions Attended */}
        <div className="metric-stat-card">
          <div className="metric-stat-label">
            <span>Attended Events</span>
            <IconChartBar size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          </div>
          <div className="metric-stat-value">
            {loading ? (
              <Skeleton height={32} width={70} />
            ) : (
              `${summary?.total_events_attended ?? 0} / ${summary?.total_events_available ?? 0}`
            )}
          </div>
          <div className="metric-stat-subtext">
            <Text fz="0.725rem" c="var(--text-secondary)">
              Required university sessions
            </Text>
          </div>
        </div>

        {/* Tile 3: Next Event (Hero Countdown + 2-line title) */}
        <div className="metric-stat-card">
          <div className="metric-stat-label">
            <span>Next Scheduled</span>
            <IconCalendar size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          </div>
          <div className="metric-stat-value" style={{ color: nextEvent ? "var(--brand-primary)" : "var(--text-secondary)" }}>
            {loading ? <Skeleton height={32} width={80} /> : nextEventHeroText}
          </div>
          <div className="metric-stat-subtext">
            {nextEvent ? (
              <Text fz="0.725rem" fw={500} c="var(--text-secondary)" lh={1.35}>
                {nextEvent.name}
              </Text>
            ) : (
              <Text fz="0.725rem" c="var(--text-secondary)">
                No upcoming events this week
              </Text>
            )}
          </div>
        </div>

        {/* Tile 4: Last Check-In */}
        <div className="metric-stat-card">
          <div className="metric-stat-label">
            <span>Last Check-In</span>
            <IconHistory size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          </div>
          <div className="metric-stat-value" style={{ fontSize: "1.1rem", fontWeight: 600, minHeight: 32, display: "flex", alignItems: "center" }}>
            {loading ? (
              <Skeleton height={24} width={90} />
            ) : summary?.last_attendance ? (
              <Text fz="0.95rem" fw={600} c="var(--text-primary)">
                {formatDate(summary.last_attendance)}
              </Text>
            ) : (
              <Text fz="0.9rem" c="var(--text-secondary)">
                No logs yet
              </Text>
            )}
          </div>
          <div className="metric-stat-subtext">
            <Text fz="0.725rem" c="var(--text-secondary)">
              {summary?.last_attendance ? formatTime(summary.last_attendance) : "This semester"}
            </Text>
          </div>
        </div>
      </SimpleGrid>

      {/* ─── Main Section: Category Clearance & Activity Stream ─── */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {/* Left Column (65% / 2 cols): Requirements & Activity */}
        <Box style={{ gridColumn: "span 2" }}>
          {/* Category Clearance Progress */}
          <div className="dashboard-panel-card dash-stagger-3">
            <div className="panel-header-row">
              <div>
                <div className="panel-title">Category Clearance Requirements</div>
                <div className="panel-subtitle">Attendance breakdown across institutional event types</div>
              </div>
            </div>

            {loading ? (
              <Stack gap="xs">
                <Skeleton height={42} radius="sm" />
                <Skeleton height={42} radius="sm" />
                <Skeleton height={42} radius="sm" />
              </Stack>
            ) : typeEntries.length === 0 ? (
              <Box py="lg" ta="center">
                <Text fz="0.825rem" c="var(--text-secondary)">
                  No category records logged yet for this academic term.
                </Text>
              </Box>
            ) : (
              <Stack gap="xs">
                {typeEntries.map((item) => {
                  const isFulfilled = item.count >= 3;
                  return (
                    <div key={item.type} className="category-progress-item">
                      <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                        <Text fz="0.825rem" fw={600} c="var(--text-primary)" style={{ wordBreak: "break-word" }}>
                          {item.label}
                        </Text>
                        <Badge
                          size="xs"
                          variant="light"
                          color={isFulfilled ? "teal" : item.count > 0 ? "blue" : "gray"}
                          styles={{ root: { fontVariantNumeric: "tabular-nums", flexShrink: 0, whiteSpace: "nowrap" } }}
                        >
                          {isFulfilled
                            ? "✓ Completed"
                            : item.count > 0
                            ? `${item.count} attended`
                            : "0 attended"}
                        </Badge>
                      </Group>
                      <Progress
                        value={Math.min(100, item.count * 33.4)}
                        size="sm"
                        color={item.color}
                        radius="xl"
                      />
                    </div>
                  );
                })}
              </Stack>
            )}

            {/* Minimal Monthly Rhythm Micro-Chart */}
            <Box mt="md" pt="sm" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                <Text fz="0.75rem" fw={600} c="var(--text-secondary)" style={{ textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                  Monthly Attendance Rhythm
                </Text>
                <Text fz="0.7rem" c="var(--text-secondary)" style={{ whiteSpace: "nowrap" }}>
                  Past 6 Months
                </Text>
              </Group>

              <div className="rhythm-micro-chart">
                {rhythmData.map((m) => (
                  <Tooltip key={m.label} label={`${m.label}: ${m.count} check-ins`} withArrow>
                    <div className={`rhythm-bar-col ${m.isCurrent ? "is-current" : ""}`}>
                      <div className="rhythm-bar-track">
                        <div
                          className="rhythm-bar-fill"
                          style={{
                            height: `${m.heightPercent}%`,
                            opacity: m.count > 0 ? 1 : 0.25,
                          }}
                        />
                      </div>
                      <span className="rhythm-bar-label">{m.label}</span>
                    </div>
                  </Tooltip>
                ))}
              </div>
            </Box>
          </div>

          {/* Recent Attendance Activity Ledger */}
          <div className="dashboard-panel-card dash-stagger-3">
            <div className="panel-header-row">
              <div>
                <div className="panel-title">Recent Attendance History</div>
                <div className="panel-subtitle">Verified campus check-ins</div>
              </div>

              <Button
                variant="subtle"
                size="xs"
                component={Link}
                to="/student/attendance"
                rightSection={<IconArrowRight size={12} />}
                styles={{ root: { flexShrink: 0, whiteSpace: "nowrap" } }}
              >
                View Full Log
              </Button>
            </div>

            {loading ? (
              <Stack gap="xs">
                <Skeleton height={46} radius="sm" />
                <Skeleton height={46} radius="sm" />
                <Skeleton height={46} radius="sm" />
              </Stack>
            ) : logs.length === 0 ? (
              <Box py="xl" ta="center">
                <IconCheck size={28} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
                <Text fz="0.825rem" c="var(--text-secondary)" mt="xs">
                  No attendance entries recorded yet this term.
                </Text>
              </Box>
            ) : (
              <div>
                {logs.map((log) => {
                  const meta =
                    VERIFICATION_META[log.verification_method] ?? {
                      label: "Verified",
                      icon: <IconCheck size={14} />,
                      color: "teal",
                    };
                  return (
                    <div key={log.id} className="attendance-history-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text fz="0.85rem" fw={600} c="var(--text-primary)" lh={1.35}>
                          {log.event_name}
                        </Text>
                        <Group gap={6} align="center" mt={3} wrap="wrap">
                          <Text fz="0.725rem" c="var(--text-secondary)" style={{ whiteSpace: "nowrap" }}>
                            {formatDate(log.check_in_time)} • {formatTime(log.check_in_time)}
                          </Text>
                          {log.venue && (
                            <Text fz="0.725rem" c="var(--text-secondary)">
                              • {log.venue}
                            </Text>
                          )}
                        </Group>
                      </div>

                      <Badge
                        size="xs"
                        variant="light"
                        color={meta.color}
                        leftSection={meta.icon}
                        styles={{ root: { fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" } }}
                      >
                        {meta.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Box>

        {/* Right Column (35% / 1 col): Upcoming Campus Events & Quick Links */}
        <Box>
          {/* Upcoming Campus Schedule */}
          <div className="dashboard-panel-card dash-stagger-4">
            <div className="panel-header-row">
              <div>
                <div className="panel-title">Campus Schedule</div>
                <div className="panel-subtitle">Upcoming required events</div>
              </div>

              <Button
                variant="subtle"
                size="xs"
                component={Link}
                to="/student/events"
                rightSection={<IconArrowRight size={12} />}
                styles={{ root: { flexShrink: 0, whiteSpace: "nowrap" } }}
              >
                All Events
              </Button>
            </div>

            {loading ? (
              <Stack gap="xs">
                <Skeleton height={56} radius="sm" />
                <Skeleton height={56} radius="sm" />
              </Stack>
            ) : upcoming.length === 0 ? (
              <Box py="lg" ta="center">
                <IconCalendar size={28} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
                <Text fz="0.8rem" c="var(--text-secondary)" mt="xs">
                  You're all caught up! No required sessions scheduled for the next 7 days.
                </Text>
              </Box>
            ) : (
              <div>
                {upcoming.map((evt) => (
                  <Link
                    key={evt.id}
                    to={`/student/events/${evt.id}`}
                    className="schedule-event-card"
                    style={
                      {
                        "--item-color": TYPE_BAR_COLORS[evt.event_type] ?? "var(--brand-primary)",
                      } as React.CSSProperties
                    }
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                      <Text fz="0.85rem" fw={600} c="var(--text-primary)" lh={1.35}>
                        {evt.name}
                      </Text>
                      {evt.active_sessions_count > 0 && (
                        <Badge size="xs" color="red" variant="filled" styles={{ root: { flexShrink: 0, whiteSpace: "nowrap" } }}>
                          LIVE
                        </Badge>
                      )}
                    </Group>

                    <Group gap="xs" mt={3} wrap="wrap">
                      <Group gap={4} align="center" style={{ whiteSpace: "nowrap" }}>
                        <IconClock size={12} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                        <Text fz="0.7rem" c="var(--text-secondary)">
                          {formatDate(evt.date)}
                        </Text>
                      </Group>
                      {evt.venue && (
                        <Group gap={4} align="center">
                          <IconMapPin size={12} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                          <Text fz="0.7rem" c="var(--text-secondary)">
                            {evt.venue}
                          </Text>
                        </Group>
                      )}
                    </Group>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Resources Hub */}
          <div className="dashboard-panel-card dash-stagger-4">
            <div className="panel-title" style={{ marginBottom: 12 }}>
              Quick Navigation
            </div>
            <Stack gap={8}>
              <Button
                variant="light"
                fullWidth
                justify="space-between"
                rightSection={<IconArrowRight size={14} />}
                component={Link}
                to="/student/attendance"
                styles={{
                  root: {
                    backgroundColor: "var(--surface-0)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)",
                    fontWeight: 500,
                    fontSize: "0.8rem",
                  },
                }}
              >
                Detailed Attendance Log
              </Button>
              <Button
                variant="light"
                fullWidth
                justify="space-between"
                rightSection={<IconArrowRight size={14} />}
                component={Link}
                to="/student/profile"
                styles={{
                  root: {
                    backgroundColor: "var(--surface-0)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)",
                    fontWeight: 500,
                    fontSize: "0.8rem",
                  },
                }}
              >
                Profile & Face ID Settings
              </Button>
            </Stack>
          </div>
        </Box>
      </SimpleGrid>
    </Container>
  );
}
