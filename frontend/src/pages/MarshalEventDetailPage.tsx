import { useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Group,
  Button,
  Badge,
  Text,
  SimpleGrid,
  Paper,
  Skeleton,
  Alert,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconMapPin,
  IconCamera,
  IconDeviceMobile,
} from "@tabler/icons-react";
import * as eventsApi from "../api/events";
import * as sessionsApi from "../api/sessions";
import type { EventResponse } from "../types/event";
import type { SessionResponse } from "../types/session";
import { useAsync } from "../hooks";
import StatusBadge from "../components/shared/StatusBadge";
import PageHeader from "../components/layout/PageHeader";
import EmptyState from "../components/EmptyState";
import { formatDate, formatTime } from "../utils/formatters";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../utils/constants";

export default function MarshalEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    if (!eventId) return { event: null as EventResponse | null, sessions: [] as SessionResponse[] };
    const [ev, sess] = await Promise.all([
      eventsApi.getEvent(eventId),
      sessionsApi.getSessions(eventId),
    ]);
    return { event: ev, sessions: sess };
  }, [eventId]);

  const { data, loading, error } = useAsync(loadData, true);

  const event = data?.event ?? null;
  const sessions = data?.sessions ?? [];

  const eventTypeLabel = event ? (EVENT_TYPE_LABELS[event.event_type] || event.event_type) : "";
  const eventTypeColor = event ? (EVENT_TYPE_COLORS[event.event_type] || "gray") : "gray";

  if (error) {
    return (
      <Container size="xl" pt={0} pb="4xl">
        <Alert color="red" title="Failed to load event">
          {error}
        </Alert>
        <Button variant="default" mt="md" onClick={() => navigate("/marshal/events")}>
          Back to Events
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" pt={0} pb="4xl">
      <PageHeader
        title={event?.name ?? "Event Sessions"}
        subtitle={
          event
            ? `${formatDate(event.start_date)} \u2013 ${formatDate(event.end_date)}${event.venue ? ` \u00b7 ${event.venue}` : ""}`
            : undefined
        }
        breadcrumbs={[
          { label: "Events", to: "/marshal/events" },
          { label: event?.name ?? "Sessions" },
        ]}
      >
        <Group gap="sm">
          {event && (
            <Badge size="lg" variant="light" color={eventTypeColor}>
              {eventTypeLabel}
            </Badge>
          )}
        </Group>
      </PageHeader>

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {Array.from({ length: 3 }).map((_, i) => (
            <Paper key={i} p="md" radius="md">
              <Skeleton height={14} width="30%" mb={10} />
              <Skeleton height={18} width="70%" mb={8} />
              <Skeleton height={12} width="50%" mb={6} />
              <Skeleton height={12} width="40%" mb={16} />
              <Group gap="xs">
                <Skeleton height={32} width={100} />
                <Skeleton height={32} width={100} />
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="This event has no sessions yet."
          icon={<IconCalendarEvent size={24} />}
          action={
            <Button variant="default" onClick={() => navigate("/marshal/events")}>
              Back to Events
            </Button>
          }
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {sessions.map((s) => {
            const isActive = s.status === "active";

            return (
              <Paper
                key={s.id}
                p="md"
                radius="md"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderLeft: `3px solid ${isActive ? "var(--mantine-color-teal-4)" : "var(--mantine-color-gray-6)"}`,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <Group justify="space-between" align="flex-start" mb="sm">
                  <StatusBadge status={s.status} />
                  {isActive && (
                    <Badge color="green" size="sm" leftSection={<span className="pulse-dot" />}>
                      Live
                    </Badge>
                  )}
                </Group>

                <Text fw={600} size="sm" truncate="end" mb="xs">
                  {s.name}
                </Text>

                <Group gap="xs" mt={4}>
                  <IconCalendarEvent size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                  <Text size="xs" c="dimmed" truncate="end">
                    {formatDate(s.start_time)} · {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </Text>
                </Group>

                <Group gap="xs" mt={2}>
                  <IconMapPin size={14} style={{ opacity: 0.5 }} />
                  <Text size="xs" c="dimmed">{s.venue || "No location assigned"}</Text>
                </Group>

                  <Group mt="md" gap="xs">
                  <Button
                    size="xs"
                    variant={isActive ? "filled" : "default"}
                    color={isActive ? "blue" : undefined}
                    leftSection={<IconDeviceMobile size={14} />}
                    disabled={!isActive}
                    onClick={() => navigate(`/scanner/mobile/${s.id}`)}
                  >
                    Single Face
                  </Button>
                  <Button
                    size="xs"
                    variant={isActive ? "filled" : "default"}
                    color={isActive ? "teal" : undefined}
                    leftSection={<IconCamera size={14} />}
                    disabled={!isActive}
                    onClick={() => navigate(`/scanner/multi/${s.id}`)}
                  >
                    Multi Face
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="orange"
                    onClick={async () => {
                      try {
                        await sessionsApi.extendSession(s.id, 15);
                        window.location.reload();
                      } catch (err) {
                        console.error("Failed to extend session", err);
                      }
                    }}
                  >
                    +15m
                  </Button>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
    </Container>
  );
}
