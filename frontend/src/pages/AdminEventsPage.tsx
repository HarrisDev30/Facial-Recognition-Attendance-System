import { useEffect, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Container,
  Group,
  Button,
  Badge,
  Text,
  Box,
  Center,
  SimpleGrid,
  Paper,
  Pagination,
} from "@mantine/core";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconCalendarEvent,
  IconMapPin,
  IconPhoto,
} from "@tabler/icons-react";
import * as eventsApi from "../api/events";
import { getSessions } from "../api/sessions";
import type { EventResponse, EventCreate, EventUpdate } from "../types/event";
import { useFormSubmit } from "../hooks";
import { usePagination } from "../hooks";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "../utils/constants";
import StatusBadge from "../components/shared/StatusBadge";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import EventFormModal from "../components/forms/EventFormModal";
import PageHeader from "../components/layout/PageHeader";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/formatters";

const PAGE_SIZE = 12;

export default function AdminEventsPage() {
  const [editingEvent, setEditingEvent] = useState<EventResponse | null>(null);
  const [opened, setOpened] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { page, setPage, total } = usePagination(1, PAGE_SIZE);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, [page]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * PAGE_SIZE;
      const res = await eventsApi.getEvents(skip, PAGE_SIZE);
      setEvents(res.items);

      const counts: Record<string, number> = {};
      await Promise.all(
        res.items.map(async (event) => {
          try {
            const sessions = await getSessions(event.id);
            counts[event.id] = sessions.length;
          } catch {
            counts[event.id] = 0;
          }
        }),
      );
      setSessionCounts(counts);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const { submit: createSubmit, submitting: creating } = useFormSubmit(
    (data: EventCreate) => eventsApi.createEvent(data),
    {
      onSuccess: (result) => {
        const createdEvent = result as EventResponse;
        setOpened(false);
        setLastCreatedId(createdEvent.id);
        loadEvents();
      },
      successMessage: "Event created.",
    },
  );

  useEffect(() => {
    if (lastCreatedId && photoBlob) {
      eventsApi.uploadEventPhoto(lastCreatedId, photoBlob).then(() => {
        setPhotoBlob(null);
        setLastCreatedId(null);
        loadEvents();
      });
    }
  }, [lastCreatedId, photoBlob]);

  const { submit: updateSubmit, submitting: updating } = useFormSubmit(
    (data: EventCreate) => {
      if (!editingEvent) return Promise.reject(new Error("No event to edit"));
      return eventsApi.updateEvent(editingEvent.id, data as EventUpdate);
    },
    {
      onSuccess: async () => {
        if (editingEvent) {
          if (photoRemoved) {
            await eventsApi.deleteEventPhoto(editingEvent.id).catch(() => {});
            setPhotoRemoved(false);
          } else if (photoBlob) {
            await eventsApi.uploadEventPhoto(editingEvent.id, photoBlob);
            setPhotoBlob(null);
          }
        }
        setEditingEvent(null);
        setOpened(false);
        loadEvents();
      },
      successMessage: "Event saved.",
    },
  );

  const { submit: deleteSubmit, submitting: deleting } = useFormSubmit(
    (id: string) => eventsApi.deleteEvent(id),
    {
      onSuccess: () => {
        setDeleteId(null);
        loadEvents();
      },
      successMessage: "The event has been removed.",
      errorMessage: "Failed to delete event.",
    },
  );

  const submitting = creating || updating || deleting;

  const openEdit = (event: EventResponse) => {
    setEditingEvent(event);
    setOpened(true);
  };

  const openCreate = () => {
    setEditingEvent(null);
    setPhotoBlob(null);
    setPhotoRemoved(false);
    setOpened(true);
  };

  const handleClose = () => {
    setEditingEvent(null);
    setPhotoBlob(null);
    setPhotoRemoved(false);
    setOpened(false);
  };

  const renderCard = (event: EventResponse) => {
    const accentColor =
      EVENT_TYPE_COLORS[event.event_type] || "gray";
    const typeLabel =
      EVENT_TYPE_LABELS[event.event_type] || event.event_type;

    return (
      <Paper
        key={event.id}
        p={0}
        radius="md"
        onClick={() => navigate(`/admin/events/${event.id}/sessions`)}
        onMouseEnter={() => setHoveredCard(event.id)}
        onMouseLeave={() => setHoveredCard(null)}
        style={{
          overflow: "hidden",
          cursor: "pointer",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          transform: hoveredCard === event.id ? "translateY(-4px) scale(1.01)" : undefined,
          boxShadow: hoveredCard === event.id
            ? "0px 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4)"
            : undefined,
        }}
      >
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
                  style={{ opacity: 0.25, color: "#fff" }}
                />
              </Center>
            )}
            <Badge
            color={accentColor}
            variant="filled"
            style={{ position: "absolute", top: 12, left: 12 }}
          >
            {typeLabel}
          </Badge>
        </Box>

        <Box p="md">
          <Text
            component={Link}
            to={`/admin/events/${event.id}/sessions`}
            fw={600}
            size="sm"
            truncate="end"
            td="underline"
          >
            {event.name}
          </Text>

          <Group gap="xs" mt={6}>
            <IconMapPin size={14} style={{ opacity: 0.5 }} />
            <Text size="xs" c="dimmed">
              {event.venue || "No venue"}
            </Text>
          </Group>

          <Group gap="xs" mt={2}>
            <IconCalendarEvent size={14} style={{ opacity: 0.5 }} />
            <Text size="xs" c="dimmed">
              {formatDate(event.start_date)} – {formatDate(event.end_date)}
            </Text>
          </Group>

          <Text size="xs" c="dimmed" mt={2}>
            {sessionCounts[event.id] ?? "—"} session
            {(sessionCounts[event.id] ?? 0) !== 1 ? "s" : ""}
          </Text>

          <Group justify="space-between" align="center" mt="md">
            <StatusBadge status={event.status} />
            <Group gap="xs" wrap="nowrap">
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconPencil size={14} />}
                onClick={(e: MouseEvent) => { e.stopPropagation(); openEdit(event); }}
              >
                Edit
              </Button>
              <Button
                variant="subtle"
                size="xs"
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={(e: MouseEvent) => { e.stopPropagation(); setDeleteId(event.id); }}
              >
                Delete
              </Button>
            </Group>
          </Group>
        </Box>
      </Paper>
    );
  };

  return (
    <Container size="xl" pt={0} pb="4xl">
      <PageHeader title="Events">
        <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
          Create Event
        </Button>
      </PageHeader>

      {loading || events.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {events.map(renderCard)}

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
              minHeight: 200,
              borderColor: hoveredCard === "create" ? "rgba(255,255,255,0.35)" : undefined,
              backgroundColor: hoveredCard === "create" ? "rgba(255,255,255,0.03)" : undefined,
            }}
            onClick={openCreate}
          >
            <Box ta="center">
              <IconPlus size={40} style={{ opacity: 0.3 }} />
              <Text size="sm" c="dimmed" mt="md">
                Create Event
              </Text>
            </Box>
          </Paper>
        </SimpleGrid>
      ) : (
        <EmptyState
          title="No events yet"
          description="Create your first event to get started."
          icon={<IconPhoto size={24} />}
          action={
            <Button variant="default" onClick={openCreate}>
              Create Event
            </Button>
          }
        />
      )}

      {total > PAGE_SIZE && (
        <Group justify="center" mt="xl">
          <Pagination
            value={page}
            onChange={setPage}
            total={Math.ceil(total / PAGE_SIZE)}
          />
        </Group>
      )}

      <EventFormModal
        opened={opened}
        onClose={handleClose}
        onSubmit={editingEvent ? updateSubmit : createSubmit}
        initial={editingEvent}
        loading={submitting}
        photoBlob={photoBlob}
        onPhotoChange={setPhotoBlob}
        onRemovePhoto={() => setPhotoRemoved(true)}
      />

      <ConfirmDialog
        opened={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteSubmit(deleteId)}
        title="Delete event"
        message="Delete this event? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />
    </Container>
  );
}
