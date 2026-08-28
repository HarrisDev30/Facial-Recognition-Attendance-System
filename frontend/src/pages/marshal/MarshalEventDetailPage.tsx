import { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Group,
  Button,
  Badge,
  Text,
  SimpleGrid,
  Skeleton,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCalendarEvent,
  IconMapPin,
  IconDeviceMobile,
  IconPlayerPlay,
  IconScan,
  IconCheck,
  IconChevronLeft,
  IconClock,
} from "@tabler/icons-react";
import * as eventsApi from "../../api/events";
import * as sessionsApi from "../../api/sessions";
import type { EventResponse } from "../../types/event";
import type { SessionResponse } from "../../types/session";
import { useAsync } from "../../hooks";
import StatusBadge from "../../components/shared/StatusBadge";
import EmptyState from "../../components/EmptyState";
import { formatDate, formatTime } from "../../utils/formatters";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../../utils/constants";
import "./MarshalDashboardPage.css";

export default function MarshalEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return { event: null as EventResponse | null, sessions: [] as SessionResponse[] };
    const [ev, sess] = await Promise.all([
      eventsApi.getEvent(eventId),
      sessionsApi.getSessions(eventId),
    ]);
    return { event: ev, sessions: sess };
  }, [eventId]);

  const { data, loading, error, execute } = useAsync(loadData, true);

  const event = data?.event;
  const sessions = data?.sessions ?? [];

  const handleStartSession = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    try {
      await sessionsApi.activateSession(sessionId);
      notifications.show({
        title: "Station Activated",
        message: "Check-in session is now live!",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      execute();
    } catch {
      notifications.show({
        title: "Activation Failed",
        message: "Could not activate session.",
        color: "red",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExtendSession = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    try {
      await sessionsApi.extendSession(sessionId, 15);
      notifications.show({
        title: "Session Extended",
        message: "+15 minutes added to check-in window.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      execute();
    } catch {
      notifications.show({
        title: "Extension Failed",
        message: "Could not extend session.",
        color: "red",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Container
      fluid
      pt={0}
      pb={{ base: "6.5rem", sm: "4xl" }}
      px={0}
      style={{ maxWidth: 1440 }}
    >
      {/* ─── Header & Breadcrumb Bar ─── */}
      <div className="marshal-section-card" style={{ marginBottom: "20px" }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <Button
              className="marshal-action-btn-secondary"
              size="xs"
              leftSection={<IconChevronLeft size={14} />}
              onClick={() => navigate("/marshal/events")}
            >
              Back to Events
            </Button>
            <div>
              <h1 className="marshal-greeting-title" style={{ fontSize: "1.75rem" }}>
                {event?.name ?? "Event Details"}
              </h1>
              <Text size="xs" c="dimmed" mt={2}>
                Gate management and attendance session stations
              </Text>
            </div>
          </Group>

          {event && (
            <Group gap="xs">
              {event.event_type && (
                <Badge
                  color={EVENT_TYPE_COLORS[event.event_type] || "teal"}
                  variant="light"
                  size="sm"
                >
                  {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                </Badge>
              )}
              <StatusBadge status={event.status} />
            </Group>
          )}
        </Group>

        {event && (
          <Group gap="lg" mt="md" pt="sm" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <Group gap={6}>
              <IconCalendarEvent size={15} style={{ opacity: 0.6 }} />
              <Text size="xs" c="dimmed">
                {formatDate(event.start_date)} — {formatDate(event.end_date)}
              </Text>
            </Group>
            {event.venue && (
              <Group gap={6}>
                <IconMapPin size={15} style={{ opacity: 0.6 }} />
                <Text size="xs" c="dimmed">{event.venue}</Text>
              </Group>
            )}
          </Group>
        )}
      </div>

      {loading && !data && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Skeleton height={140} radius="md" />
          <Skeleton height={140} radius="md" />
        </SimpleGrid>
      )}

      {error && (
        <Alert color="red" title="Error Loading Event" mb="lg">
          Failed to load event details.
        </Alert>
      )}

      {/* ─── Sessions List ─── */}
      <div className="marshal-section-card">
        <div className="marshal-section-header">
          <h2 className="marshal-section-title">
            <IconClock size={18} color="var(--brand-primary, #10b981)" />
            Attendance Gate Sessions ({sessions.length})
          </h2>
        </div>

        {sessions.length === 0 && !loading ? (
          <EmptyState
            icon={<IconCalendarEvent size={32} />}
            title="No Sessions Configured"
            description="This event has no attendance sessions scheduled."
          />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {sessions.map((s) => {
              const isActive = s.status === "active";
              const isCompleted = s.status === "completed";

              return (
                <div
                  key={s.id}
                  className="marshal-station-item"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text fw={700} size="sm" c="var(--text-primary)" truncate="end">
                        {s.name}
                      </Text>
                      {isActive ? (
                        <span className="marshal-status-pill online">
                          <span className="marshal-live-beacon" />
                          Live Station
                        </span>
                      ) : (
                        <StatusBadge status={s.status} />
                      )}
                    </Group>

                    <Group gap="xs" mt={4}>
                      <IconCalendarEvent size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                      <Text size="xs" c="dimmed" truncate="end">
                        {formatDate(s.start_time)} · {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </Text>
                    </Group>

                    {s.venue && (
                      <Group gap="xs" mt={2}>
                        <IconMapPin size={14} style={{ opacity: 0.5 }} />
                        <Text size="xs" c="dimmed">{s.venue}</Text>
                      </Group>
                    )}
                  </div>

                  <Group mt="md" pt="sm" gap="xs" wrap="wrap" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    {isActive ? (
                      <>
                        <Button
                          className="marshal-action-btn-primary"
                          size="compact-xs"
                          leftSection={<IconScan size={12} />}
                          onClick={() => navigate(`/marshal/scanner/${s.id}`)}
                        >
                          Face Scanner
                        </Button>
                        <Button
                          className="marshal-action-btn-secondary"
                          size="compact-xs"
                          leftSection={<IconDeviceMobile size={12} />}
                          onClick={() => navigate(`/marshal/scanner/mobile/${s.id}`)}
                        >
                          Phone Scanner
                        </Button>
                        <Button
                          className="marshal-action-btn-secondary"
                          size="compact-xs"
                          loading={actionLoadingId === s.id}
                          onClick={() => handleExtendSession(s.id)}
                        >
                          +15m
                        </Button>
                      </>
                    ) : isCompleted ? (
                      <Badge size="sm" color="gray" variant="outline">
                        Session Ended
                      </Badge>
                    ) : (
                      <Button
                        className="marshal-action-btn-primary"
                        size="xs"
                        leftSection={<IconPlayerPlay size={14} />}
                        loading={actionLoadingId === s.id}
                        onClick={() => handleStartSession(s.id)}
                      >
                        Start Session
                      </Button>
                    )}
                  </Group>
                </div>
              );
            })}
          </SimpleGrid>
        )}
      </div>
    </Container>
  );
}
