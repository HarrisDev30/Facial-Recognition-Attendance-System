import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Paper,
  Text,
  Group,
  Badge,
  Box,
  Progress,
  Center,
  SimpleGrid,
  Stack,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconClock,
  IconMapPin,
  IconCheck,
  IconCircleOff,
} from "@tabler/icons-react";
import { getAllEvents } from "../api/events";
import { getMyEventAttendance } from "../api/attendees";
import type { UpcomingEvent } from "../types/event";
import type { EventSessionAttendance } from "../types/auth";
import { useAsync } from "../hooks";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../utils/constants";
import { formatDate, formatTime, formatDateTime, formatConfidence } from "../utils/formatters";
import PageHeader from "../components/layout/PageHeader";

const TYPE_LABELS: Record<string, string> = {
  face_recognition: "Face Recognition",
  qr_code: "QR Code",
  marshal_override: "Manual Override",
};

export default function EventAttendanceDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const loadData = useCallback(async () => {
    if (!eventId) return { event: null, detail: null };
    const [eventsRes, detail] = await Promise.all([
      getAllEvents(1, 100),
      getMyEventAttendance(eventId),
    ]);
    const event = (eventsRes.items as UpcomingEvent[]).find(
      (e) => e.id === eventId,
    );
    return { event: event ?? null, detail };
  }, [eventId]);

  const { data, loading } = useAsync(loadData, true);
  const event = data?.event ?? null;
  const detail = data?.detail ?? null;

  const sessions = detail?.sessions ?? [];
  const checkedCount = sessions.filter((s) => s.verified_at).length;
  const totalSessions = sessions.length;
  const progressPercent =
    totalSessions > 0 ? Math.round((checkedCount / totalSessions) * 100) : 0;

  const grouped = useMemo(() => {
    const active: EventSessionAttendance[] = [];
    const upcoming: EventSessionAttendance[] = [];
    const completed: EventSessionAttendance[] = [];
    for (const s of sessions) {
      if (s.status === "active") active.push(s);
      else if (s.status === "completed") completed.push(s);
      else upcoming.push(s);
    }
    return { active, upcoming, completed };
  }, [sessions]);

  const accentColor = event ? EVENT_TYPE_COLORS[event.event_type] || "blue" : "blue";
  const eventTypeLabel = event
    ? EVENT_TYPE_LABELS[event.event_type] || event.event_type
    : "";

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader
        title={event?.name ?? "Event Details"}
        breadcrumbs={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Events", to: "/student/events" },
          { label: event?.name ?? "..." },
        ]}
      />

      {event && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mb="lg">
            <Paper p={0} radius="md" style={{ overflow: "hidden" }}>
              <Box
                style={{
                  position: "relative",
                  aspectRatio: "16 / 9",
                  background: event.photo_url
                    ? `url(${event.photo_url}) center / cover no-repeat`
                    : `linear-gradient(135deg, var(--mantine-color-${accentColor}-9) 0%, var(--mantine-color-${accentColor}-7) 100%)`,
                }}
              >
                {!event.photo_url && (
                  <Center style={{ position: "absolute", inset: 0 }}>
                    <IconCalendarEvent
                      size={48}
                      style={{ opacity: 0.2, color: "#fff" }}
                    />
                  </Center>
                )}
                <Badge
                  color={accentColor}
                  variant="filled"
                  size="md"
                  style={{ position: "absolute", top: 12, left: 12 }}
                >
                  {eventTypeLabel}
                </Badge>
                {event.active_sessions_count > 0 && (
                  <Badge
                    color="green"
                    variant="filled"
                    size="md"
                    style={{ position: "absolute", top: 12, right: 12 }}
                  >
                    {event.active_sessions_count} active
                  </Badge>
                )}
              </Box>
            </Paper>

            <Stack gap="sm" justify="center">
              <Group gap="lg" wrap="wrap">
                {event.venue && (
                  <Group gap={4}>
                    <IconMapPin size={16} style={{ opacity: 0.6 }} />
                    <Text size="sm" c="dimmed">
                      {event.venue}
                    </Text>
                  </Group>
                )}
                <Group gap={4}>
                  <IconCalendarEvent size={16} style={{ opacity: 0.6 }} />
                  <Text size="sm" c="dimmed">
                    {formatDate(event.date)}
                  </Text>
                </Group>
                <Group gap={4}>
                  <IconClock size={16} style={{ opacity: 0.6 }} />
                  <Text size="sm" c="dimmed">
                    {event.sessions_count} session{event.sessions_count !== 1 ? "s" : ""}
                  </Text>
                </Group>
              </Group>
              {event.description && (
                <Text size="sm" c="dimmed">
                  {event.description}
                </Text>
              )}
            </Stack>
          </SimpleGrid>

          <Paper p="md" radius="md" mb="lg" bg="var(--surface-1)">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600}>
                Attendance Progress
              </Text>
              <Text size="sm" fw={600} c="green">
                {checkedCount}/{totalSessions} ({progressPercent}%)
              </Text>
            </Group>
            <Progress
              value={progressPercent}
              size="md"
              color="green"
              radius="sm"
            />
          </Paper>

          <Stack gap="xs">
            {grouped.active.map((s) => (
              <SessionRow key={s.session_id} session={s} kind="active" />
            ))}
            {grouped.upcoming.map((s) => (
              <SessionRow key={s.session_id} session={s} kind="upcoming" />
            ))}
            {grouped.completed.map((s) => (
              <SessionRow key={s.session_id} session={s} kind="completed" />
            ))}
          </Stack>
        </>
      )}

      {loading && !event && (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Loading event details...
        </Text>
      )}

      {!loading && !event && (
        <Paper p="xl" radius="md" ta="center">
          <IconCalendarEvent size={48} style={{ opacity: 0.3 }} />
          <Text mt="md" c="dimmed">
            Event not found.
          </Text>
        </Paper>
      )}
    </Container>
  );
}

function SessionRow({
  session,
  kind,
}: {
  session: EventSessionAttendance;
  kind: "active" | "upcoming" | "completed";
}) {
  const accent =
    kind === "active"
      ? "var(--mantine-color-green-5)"
      : kind === "completed"
        ? "var(--mantine-color-gray-6)"
        : "var(--border-subtle)";

  return (
    <Paper
      p="md"
      radius="md"
      bg={kind === "active" ? "rgba(34, 197, 94, 0.06)" : "var(--surface-1)"}
      style={{
        borderLeft: `3px solid ${accent}`,
        opacity: kind === "completed" && !session.verified_at ? 0.55 : 1,
      }}
    >
      <Group justify="space-between" wrap="wrap">
        <div>
          <Group gap="xs" mb={4}>
            <Text fw={600} size="sm">
              {session.session_name}
            </Text>
            {kind === "active" && (
              <Badge size="xs" color="green" variant="filled">
                Active
              </Badge>
            )}
            {kind === "upcoming" && (
              <Badge size="xs" color="gray" variant="light">
                Upcoming
              </Badge>
            )}
            {kind === "completed" && (
              <Badge
                size="xs"
                color={session.verified_at ? "teal" : "gray"}
                variant={session.verified_at ? "filled" : "light"}
              >
                {session.verified_at ? "Attended" : "Missed"}
              </Badge>
            )}
          </Group>
          <Group gap="sm">
            <Group gap={4}>
              <IconClock size={14} style={{ opacity: 0.5 }} />
              <Text size="xs" c="dimmed">
                {formatTime(session.start_time)} – {formatTime(session.end_time)}
              </Text>
            </Group>
            {session.venue && (
              <Group gap={4}>
                <IconMapPin size={14} style={{ opacity: 0.5 }} />
                <Text size="xs" c="dimmed">
                  {session.venue}
                </Text>
              </Group>
            )}
          </Group>
        </div>

        {session.verified_at && (
          <Group gap="xs">
            <IconCheck size={16} style={{ color: "var(--mantine-color-teal-4)" }} />
            <div style={{ textAlign: "right" }}>
              <Text size="xs" c="teal" fw={500}>
                {formatDateTime(session.verified_at)}
              </Text>
              <Text size="xs" c="dimmed">
                {TYPE_LABELS[session.verification_method ?? ""] ?? session.verification_method}
                {session.confidence_score != null &&
                  ` · ${formatConfidence(session.confidence_score)}`}
              </Text>
            </div>
          </Group>
        )}

        {kind === "completed" && !session.verified_at && (
          <Group gap={4}>
            <IconCircleOff size={16} style={{ opacity: 0.4 }} />
            <Text size="xs" c="dimmed">
              Not attended
            </Text>
          </Group>
        )}
      </Group>
    </Paper>
  );
}
