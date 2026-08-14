import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Container,
  Group,
  Button,
  Badge,
  Text,
  Box,
  SimpleGrid,
  Paper,
  Menu,
  UnstyledButton,
} from "@mantine/core";
import {
  IconPlus,
  IconPlayerPlay,
  IconPlayerStop,
  IconClipboardCheck,
  IconPencil,
  IconCalendarEvent,
  IconMapPin,
  IconDotsVertical,
} from "@tabler/icons-react";
import * as eventsApi from "../api/events";
import * as sessionsApi from "../api/sessions";
import type { EventResponse } from "../types/event";
import type { SessionResponse, SessionCreate } from "../types/session";
import { useAsync, useFormSubmit } from "../hooks";
import StatusBadge from "../components/shared/StatusBadge";
import SessionFormModal from "../components/forms/SessionFormModal";
import PageHeader from "../components/layout/PageHeader";
import EmptyState from "../components/EmptyState";
import { notifications } from "@mantine/notifications";
import { getApiError } from "../utils/error";
import { formatDate, formatTime } from "../utils/formatters";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../utils/constants";

const STATUS_META: Record<string, { accent: string; label: string }> = {
  active: { accent: "var(--mantine-color-teal-4)", label: "Active" },
  pending: { accent: "var(--mantine-color-gray-5)", label: "Pending" },
  scheduled: { accent: "var(--mantine-color-gray-5)", label: "Scheduled" },
  completed: { accent: "var(--mantine-color-gray-6)", label: "Completed" },
  cancelled: { accent: "var(--mantine-color-red-4)", label: "Cancelled" },
};

function getStatusMeta(status: string) {
  return STATUS_META[status] ?? { accent: "var(--mantine-color-gray-5)", label: status };
}

export default function AdminEventSessionsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [opened, setOpened] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionResponse | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return { event: null as EventResponse | null, sessions: [] as SessionResponse[] };
    const [ev, sess] = await Promise.all([
      eventsApi.getEvent(eventId),
      sessionsApi.getSessions(eventId),
    ]);
    return { event: ev, sessions: sess };
  }, [eventId]);

  const { data, loading, execute: reload } = useAsync(loadData, true);

  const event = data?.event ?? null;
  const sessions = data?.sessions ?? [];

  const { submit: createSubmit, submitting: creating } = useFormSubmit(
    (sessData: SessionCreate) => {
      if (!eventId) return Promise.reject(new Error("No event"));
      return sessionsApi.createSession(eventId, sessData);
    },
    {
      onSuccess: () => {
        setOpened(false);
        reload();
      },
      successMessage: "Session created.",
    },
  );

  const { submit: updateSubmit, submitting: updating } = useFormSubmit(
    (sessData: SessionCreate) => {
      if (!editingSession) return Promise.reject(new Error("No session"));
      return sessionsApi.updateSession(editingSession.id, sessData);
    },
    {
      onSuccess: () => {
        setOpened(false);
        setEditingSession(null);
        reload();
      },
      successMessage: "Session updated.",
    },
  );

  const handleActivate = async (id: string) => {
    if (!eventId) return;
    try {
      await sessionsApi.activateSession(id);
      reload();
      notifications.show({ title: "Session activated", message: "Session is now active.", color: "green" });
    } catch (err) {
      notifications.show({ title: "Failed to activate session", message: getApiError(err), color: "red" });
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!eventId) return;
    try {
      await sessionsApi.deactivateSession(id);
      reload();
      notifications.show({ title: "Session deactivated", message: "Session has been completed.", color: "green" });
    } catch (err) {
      notifications.show({ title: "Failed to deactivate session", message: getApiError(err), color: "red" });
    }
  };

  const openCreate = () => {
    setEditingSession(null);
    setOpened(true);
  };

  const openEdit = (session: SessionResponse) => {
    setEditingSession(session);
    setOpened(true);
  };

  const eventTypeLabel = event ? (EVENT_TYPE_LABELS[event.event_type] || event.event_type) : "";
  const eventTypeColor = event ? (EVENT_TYPE_COLORS[event.event_type] || "gray") : "gray";

  return (
    <Container size="xl" pt={0} pb="4xl">
      <PageHeader
        title={event?.name ?? "Sessions"}
        subtitle={
          event
            ? `${formatDate(event.start_date)} \u2013 ${formatDate(event.end_date)}${event.venue ? ` \u00b7 ${event.venue}` : ""}`
            : undefined
        }
        breadcrumbs={[
          { label: "Events", to: "/admin/events" },
          { label: event?.name ?? "Sessions" },
        ]}
      >
        <Group gap="sm">
          {event && (
            <Badge size="lg" variant="light" color={eventTypeColor}>
              {eventTypeLabel}
            </Badge>
          )}
          <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
            Create Session
          </Button>
        </Group>
      </PageHeader>

      {loading || sessions.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {sessions.map((s) => {
            const meta = getStatusMeta(s.status);
            const isActive = s.status === "active";
            const isPending = s.status === "pending" || s.status === "scheduled";

            return (
              <Paper
                key={s.id}
                p="md"
                radius="md"
                onMouseEnter={() => setHoveredCard(s.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderLeft: `3px solid ${meta.accent}`,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  transform: hoveredCard === s.id ? "translateY(-4px) scale(1.01)" : undefined,
                  boxShadow: hoveredCard === s.id
                    ? "0px 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4)"
                    : undefined,
                }}
              >
                <Group justify="space-between" align="flex-start" mb="sm">
                  <StatusBadge status={s.status} />
                  <Menu position="bottom-end" shadow="md" withinPortal>
                    <Menu.Target>
                      <UnstyledButton
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: 4,
                          borderRadius: 4,
                          color: "var(--text-secondary)",
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      >
                        <IconDotsVertical size={18} />
                      </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconPencil size={14} />}
                        onClick={() => openEdit(s)}
                      >
                        Edit
                      </Menu.Item>
                      {isActive && (
                        <Menu.Item
                          leftSection={<IconPlayerStop size={14} />}
                          color="orange"
                          onClick={() => handleDeactivate(s.id)}
                        >
                          Deactivate
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
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

                {s.activated_at && formatDate(s.activated_at) !== formatDate(s.start_time) && (
                  <Text size="xs" c="dimmed" mt={4}>
                    Activated {formatDate(s.activated_at)}
                  </Text>
                )}
                {s.deactivated_at && formatDate(s.deactivated_at) !== formatDate(s.start_time) && (
                  <Text size="xs" c="dimmed" mt={2}>
                    Ended {formatDate(s.deactivated_at)}
                  </Text>
                )}

                <Group mt="md" gap="xs">
                  {isPending && (
                    <Button
                      size="xs"
                      variant="filled"
                      color="green"
                      leftSection={<IconPlayerPlay size={14} />}
                      onClick={(e) => { e.stopPropagation(); handleActivate(s.id); }}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconClipboardCheck size={14} />}
                    component={Link}
                    to={`/admin/sessions/${s.id}/attendance`}
                  >
                    Attendance
                  </Button>
                </Group>
              </Paper>
            );
          })}

          <Paper
            p="xl"
            radius="md"
            onMouseEnter={() => setHoveredCard("create")}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              border: "1px dashed rgba(255,255,255,0.15)",
              cursor: "pointer",
              transition: "border-color 0.15s ease, background-color 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 180,
              borderColor: hoveredCard === "create" ? "rgba(255,255,255,0.35)" : undefined,
              backgroundColor: hoveredCard === "create" ? "rgba(255,255,255,0.03)" : undefined,
            }}
            onClick={openCreate}
          >
            <Box ta="center">
              <IconPlus size={40} style={{ opacity: 0.3 }} />
              <Text size="sm" c="dimmed" mt="md">
                Create Session
              </Text>
            </Box>
          </Paper>
        </SimpleGrid>
      ) : (
        <EmptyState
          title="No sessions yet"
          description="Create your first session for this event."
          icon={<IconCalendarEvent size={24} />}
          action={<Button variant="default" onClick={openCreate}>Create Session</Button>}
        />
      )}

      <SessionFormModal
        opened={opened}
        onClose={() => { setOpened(false); setEditingSession(null); }}
        onSubmit={editingSession ? updateSubmit : createSubmit}
        initial={editingSession}
        loading={editingSession ? updating : creating}
      />
    </Container>
  );
}
