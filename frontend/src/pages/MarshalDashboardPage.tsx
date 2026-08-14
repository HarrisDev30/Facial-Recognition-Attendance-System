import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  Paper,
  Group,
  Badge,
  Button,
  Alert,
  Box,
  SimpleGrid,
  Skeleton,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconDeviceMobile,
  IconQrcode,
  IconUserPlus,
  IconCalendarEvent,
  IconClock,
  IconMapPin,
  IconLogin,
  IconRefresh,
  IconScan,
  IconCheck,
  IconUserCheck,
  IconPercentage,
} from "@tabler/icons-react";
import { useAuthStore } from "../store/authStore";
import { useAsync } from "../hooks";
import { getActiveSessions, getMyOverrides, type ActiveSession } from "../api/marshal";
import MarshalOverride from "../components/MarshalOverride";
import PageHeader from "../components/layout/PageHeader";
import StatsRow from "../components/StatsRow";
import EmptyState from "../components/EmptyState";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "../utils/constants";
import { formatTime, timeAgo, greeting } from "../utils/formatters";

interface EventGroup {
  eventId: string;
  eventName: string;
  eventType: string | null;
  venue: string | null;
  sessionCount: number;
  sessions: ActiveSession[];
}

export default function MarshalDashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data, loading, error, execute } = useAsync(async () => {
    const [sessions, overrides] = await Promise.all([
      getActiveSessions(),
      getMyOverrides(),
    ]);
    return { sessions, overrides };
  }, true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      execute();
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [execute]);

  const sessions = data?.sessions ?? [];
  const overrides = data?.overrides ?? [];

  const [overrideSessionId, setOverrideSessionId] = useState<string | null>(null);
  const [marshalOpen, { open: openMarshal, close: closeMarshal }] = useDisclosure(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    if (data) setLastUpdated(Date.now());
  }, [data]);

  const openOverride = (sessionId: string) => {
    setOverrideSessionId(sessionId);
    openMarshal();
  };

  const eventsMap = useMemo(() => {
    const map = new Map<string, EventGroup>();
    for (const s of sessions) {
      if (!map.has(s.event_id)) {
        map.set(s.event_id, {
          eventId: s.event_id,
          eventName: s.event_name,
          eventType: s.event_type,
          venue: s.venue,
          sessionCount: 0,
          sessions: [],
        });
      }
      const group = map.get(s.event_id)!;
      group.sessions.push(s);
      group.sessionCount = group.sessions.length;
    }
    return Array.from(map.values());
  }, [sessions]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (eventsMap.length > 0 && !selectedEventId) {
      setSelectedEventId(eventsMap[0].eventId);
    } else if (eventsMap.length === 0) {
      setSelectedEventId(null);
    }
  }, [eventsMap, selectedEventId]);

  useEffect(() => {
    if (selectedEventId && eventsMap.length > 0 && !eventsMap.some((e) => e.eventId === selectedEventId)) {
      setSelectedEventId(eventsMap[0].eventId);
    }
  }, [eventsMap, selectedEventId]);

  const showTabs = eventsMap.length > 1;

  const filteredSessions =
    showTabs && selectedEventId
      ? sessions.filter((s) => s.event_id === selectedEventId)
      : sessions;

  const totalCheckedIn = filteredSessions.reduce(
    (sum, s) => sum + (s.checked_in_count || 0),
    0,
  );
  const totalRegistered =
    filteredSessions.length > 0 && filteredSessions[0].total_registered
      ? filteredSessions[0].total_registered
      : null;
  const checkInRate =
    totalRegistered && totalRegistered > 0
      ? Math.round((totalCheckedIn / totalRegistered) * 100)
      : null;

  return (
    <Box>
      <Container size="lg" py="3xl">
        <PageHeader
          title={
            user?.first_name
              ? greeting(user.first_name)
              : "Marshal Dashboard"
          }
          subtitle={user?.email || undefined}
        >
          <Group gap="sm">
            {lastUpdated && (
              <Text size="xs" c="dimmed" visibleFrom="sm">
                Updated {timeAgo(new Date(lastUpdated).toISOString())}
              </Text>
            )}
            <Button
              size="sm"
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={() => execute()}
              loading={loading}
            >
              Refresh
            </Button>
          </Group>
        </PageHeader>

        {/* Event tabs */}
        {showTabs && (
          <Group gap="sm" mb="md" wrap="wrap">
            {eventsMap.map((event) => (
              <Paper
                key={event.eventId}
                p="xs"
                px="sm"
                radius="xl"
                withBorder
                style={{
                  cursor: "pointer",
                  backgroundColor:
                    selectedEventId === event.eventId
                      ? "var(--mantine-color-blue-0)"
                      : undefined,
                  borderColor:
                    selectedEventId === event.eventId
                      ? "var(--mantine-color-blue-4)"
                      : "var(--mantine-color-default-border)",
                  transition:
                    "background-color 0.15s ease, border-color 0.15s ease",
                }}
                onClick={() => setSelectedEventId(event.eventId)}
              >
                <Group gap={6} wrap="nowrap">
                  <Text
                    size="sm"
                    fw={selectedEventId === event.eventId ? 600 : 400}
                    style={{ maxWidth: 180 }}
                    truncate
                  >
                    {event.eventName}
                  </Text>
                  <Badge
                    size="xs"
                    color={selectedEventId === event.eventId ? "blue" : "gray"}
                    variant="light"
                  >
                    {event.sessionCount}
                  </Badge>
                </Group>
              </Paper>
            ))}
          </Group>
        )}

        <StatsRow
          stats={[
            {
              label: "Active sessions",
              value: filteredSessions.length,
              icon: <IconCalendarEvent size={20} />,
              accentColor: "#2dd4bf",
            },
            {
              label: "Checked in",
              value: totalCheckedIn,
              icon: <IconCheck size={20} />,
              accentColor: "#22d3ee",
            },
            {
              label: "Check-in rate",
              value: checkInRate !== null ? `${checkInRate}%` : "\u2014",
              icon: <IconPercentage size={20} />,
              accentColor:
                checkInRate !== null && checkInRate >= 50
                  ? "#22c55e"
                  : "#fb923c",
            },
            {
              label: "Total overrides",
              value: overrides.length,
              icon: <IconUserCheck size={20} />,
              accentColor: "#a78bfa",
            },
          ]}
          cols={4}
        />

        {error && (
          <Alert
            color="red"
            mt="md"
            title="Failed to load dashboard"
            onClose={() => {}}
            withCloseButton={false}
          >
            <Group mt={4}>
              <Text size="sm">{error}</Text>
              <Button
                variant="outline"
                color="red"
                size="xs"
                onClick={() => execute()}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        )}

        <Group justify="space-between" mb="md" mt="xl">
          <Text size="lg" fw={600}>
            {showTabs && selectedEventId
              ? eventsMap.find((e) => e.eventId === selectedEventId)
                  ?.eventName ?? "Sessions"
              : "Active Sessions"}
          </Text>
          {filteredSessions.length > 0 && (
            <Badge size="sm" color="green">
              {filteredSessions.length}
            </Badge>
          )}
        </Group>

        {loading ? (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {Array.from({ length: 2 }).map((_, i) => (
              <Paper key={i} p="lg" radius="md" bg="var(--surface-1)">
                <Skeleton height={18} width="60%" mb={8} />
                <Skeleton height={14} width="40%" mb={12} />
                <Skeleton height={14} width="70%" mb={16} />
                <Group gap="sm">
                  <Skeleton height={30} width={80} />
                  <Skeleton height={30} width={80} />
                  <Skeleton height={30} width={80} />
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        ) : filteredSessions.length === 0 && !showTabs ? (
          <EmptyState
            title="No active sessions right now"
            description="Active sessions will appear here when an admin starts them. This page refreshes automatically every 30 seconds."
            icon={<IconCalendarEvent size={24} />}
          />
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {filteredSessions.map((s) => (
              <Paper
                key={s.session_id}
                p="lg"
                radius="md"
                withBorder
                style={{
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "scale(1.005)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "var(--mantine-shadow-sm)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "scale(1)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text fw={600} size="sm" mb={4}>
                      {s.session_name}
                    </Text>
                    {s.event_type && (
                      <Badge
                        size="xs"
                        color={EVENT_TYPE_COLORS[s.event_type] || "gray"}
                        variant="light"
                      >
                        {EVENT_TYPE_LABELS[s.event_type] || s.event_type}
                      </Badge>
                    )}
                  </div>
                  <Badge color="blue" size="sm" variant="light">
                    {s.checked_in_count ?? "\u2014"} / {s.total_registered ?? "\u2014"}
                  </Badge>
                </Group>

                <Group gap="xs" mb="md">
                  {s.venue && (
                    <Group gap={4}>
                      <IconMapPin size={14} style={{ opacity: 0.5 }} />
                      <Text size="xs" c="dimmed">{s.venue}</Text>
                    </Group>
                  )}
                  <Group gap={4}>
                    <IconClock size={14} style={{ opacity: 0.5 }} />
                    <Text size="xs" c="dimmed">
                      {formatTime(s.start_time)} \u2014 {formatTime(s.end_time)}
                    </Text>
                  </Group>
                </Group>

                <Group visibleFrom="sm" gap="sm">
                  <Button
                    size="sm"
                    leftSection={<IconScan size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/scanner/${s.session_id}`);
                    }}
                  >
                    Scanner
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    leftSection={<IconDeviceMobile size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/scanner/mobile/${s.session_id}`);
                    }}
                  >
                    Mobile
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    leftSection={<IconQrcode size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/scanner/qr-checkin/${s.session_id}`);
                    }}
                  >
                    QR
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    leftSection={<IconUserPlus size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      openOverride(s.session_id);
                    }}
                  >
                    Manual
                  </Button>
                </Group>
                <Group hiddenFrom="sm" gap={6} wrap="nowrap">
                  <Tooltip label="Face scanner">
                    <ActionIcon
                      variant="filled"
                      color="blue"
                      size="lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/scanner/${s.session_id}`);
                      }}
                    >
                      <IconScan size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Mobile scanner">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/scanner/mobile/${s.session_id}`);
                      }}
                    >
                      <IconDeviceMobile size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="QR check-in">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/scanner/qr-checkin/${s.session_id}`, {
                          state: { from: "dashboard" },
                        });
                      }}
                    >
                      <IconQrcode size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Manual override">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOverride(s.session_id);
                      }}
                    >
                      <IconUserPlus size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}

        <Group justify="space-between" mb="md" mt="xl">
          <Text size="lg" fw={600}>
            Recent Overrides
          </Text>
          {overrides.length > 0 && (
            <Badge size="sm" color="orange" variant="light">
              {overrides.length}
            </Badge>
          )}
        </Group>

        {loading ? (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {Array.from({ length: 2 }).map((_, i) => (
              <Paper key={i} p="md" radius="md" bg="var(--surface-1)">
                <Skeleton height={14} width="50%" mb={6} />
                <Skeleton height={12} width="70%" mb={10} />
                <Skeleton height={12} width="40%" />
              </Paper>
            ))}
          </SimpleGrid>
        ) : overrides.length === 0 ? (
          <EmptyState
            title="No manual overrides yet"
            description="Manual overrides you perform will appear here."
            icon={<IconLogin size={24} />}
          />
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {overrides.map((o) => (
              <Paper
                key={o.id}
                p="md"
                radius="md"
                withBorder
                style={{
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "scale(1.005)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "var(--mantine-shadow-sm)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "scale(1)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text fw={600} size="sm">
                      {o.attendee_name || "Unknown attendee"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {o.event_name && `${o.event_name} \u00B7 `}
                      {o.session_name}
                    </Text>
                    {o.reason && (
                      <Text size="xs" c="dimmed" fs="italic">
                        {o.reason}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed" mt={2}>
                      {timeAgo(o.timestamp)}
                    </Text>
                  </div>
                  <Badge color="orange" size="sm" variant="light">
                    Override
                  </Badge>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </Container>

      <MarshalOverride
        opened={marshalOpen}
        onClose={closeMarshal}
        sessionId={overrideSessionId || ""}
        onSuccess={() => execute()}
      />
    </Box>
  );
}
