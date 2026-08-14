import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  Group,
  Badge,
  Button,
  Alert,
  SimpleGrid,
  Paper,
  Box,
  Center,
  SegmentedControl,
  Select,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconCalendarEvent,
  IconMapPin,
} from "@tabler/icons-react";
import { getAllEvents } from "../api/events";
import type { UpcomingEvent } from "../types/event";
import PageHeader from "../components/layout/PageHeader";
import EmptyState from "../components/EmptyState";
import { useAsync } from "../hooks";
import { EVENT_TYPE_COLORS } from "../utils/constants";
import { formatDate } from "../utils/formatters";

const formatEventType = (type: string) => type.replace(/_/g, " ");

type EventFilter = "all" | "active" | "upcoming" | "past";

export default function UpcomingEventsPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventFilter>("all");

  const { data: events, loading } = useAsync(
    async () => {
      const res = await getAllEvents(1, 100);
      return res.items as UpcomingEvent[];
    },
    true,
  );

  const list = events ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    switch (filter) {
      case "active":
        return list.filter((e) => e.active_sessions_count > 0);
      case "upcoming":
        return list.filter(
          (e) => e.active_sessions_count === 0 && e.date >= today,
        );
      case "past":
        return list.filter(
          (e) => e.active_sessions_count === 0 && e.date < today,
        );
      default:
        return list;
    }
  }, [list, filter, today]);

  const counts = useMemo(
    () => ({
      all: list.length,
      active: list.filter((e) => e.active_sessions_count > 0).length,
      upcoming: list.filter(
        (e) => e.active_sessions_count === 0 && e.date >= today,
      ).length,
      past: list.filter(
        (e) => e.active_sessions_count === 0 && e.date < today,
      ).length,
    }),
    [list, today],
  );

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader title="Events" />

      {error && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {list.length > 0 && (
        <>
          {isMobile ? (
            <Select
              size="sm"
              mb="lg"
              data={[
                { value: "all", label: `All events (${counts.all})` },
                { value: "active", label: `Active now (${counts.active})` },
                { value: "upcoming", label: `Upcoming (${counts.upcoming})` },
                { value: "past", label: `Past (${counts.past})` },
              ]}
              value={filter}
              onChange={(v) => setFilter((v ?? "all") as EventFilter)}
            />
          ) : (
            <SegmentedControl
              size="sm"
              mb="lg"
              data={[
                { label: `All (${counts.all})`, value: "all" },
                { label: `Active (${counts.active})`, value: "active" },
                { label: `Upcoming (${counts.upcoming})`, value: "upcoming" },
                { label: `Past (${counts.past})`, value: "past" },
              ]}
              value={filter}
              onChange={(v) => setFilter(v as EventFilter)}
            />
          )}
        </>
      )}

      {filtered.length === 0 && !loading ? (
        <EmptyState
          title={filter === "all" ? "No events" : `No ${filter} events`}
          description="Check back later."
          icon={<IconCalendarEvent size={24} />}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {filtered.map((ev) => {
            const accentColor = EVENT_TYPE_COLORS[ev.event_type] || "gray";

            return (
              <Paper
                key={ev.id}
                p={0}
                radius="md"
                  onClick={() => navigate(`/student/events/${ev.id}`)}
                onMouseEnter={() => setHoveredCard(ev.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  transform:
                    hoveredCard === ev.id
                      ? "translateY(-4px) scale(1.01)"
                      : undefined,
                  boxShadow:
                    hoveredCard === ev.id
                      ? "0px 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4)"
                      : undefined,
                }}
              >
                <Box
                  style={{
                    position: "relative",
                    aspectRatio: "16 / 9",
                    background: ev.photo_url
                      ? `url(${ev.photo_url}) center / cover no-repeat`
                      : `linear-gradient(135deg, var(--mantine-color-${accentColor}-9) 0%, var(--mantine-color-${accentColor}-7) 100%)`,
                  }}
                >
                  {!ev.photo_url && (
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
                    {formatEventType(ev.event_type)}
                  </Badge>
                  {ev.active_sessions_count > 0 && (
                    <Badge
                      color="green"
                      variant="filled"
                      style={{ position: "absolute", top: 12, right: 12 }}
                      leftSection={<span className="pulse-dot" />}
                    >
                      {ev.active_sessions_count} active
                    </Badge>
                  )}
                </Box>

                <Box p="md">
                  <Text fw={600} size="sm" truncate="end" mb={4}>
                    {ev.name}
                  </Text>

                  {ev.description && (
                    <Text size="xs" c="dimmed" lineClamp={2} mb={6}>
                      {ev.description}
                    </Text>
                  )}

                  <Group gap="xs" mt={4}>
                    <IconMapPin size={14} style={{ opacity: 0.5 }} />
                    <Text size="xs" c="dimmed">
                      {ev.venue || "No venue"}
                    </Text>
                  </Group>

                  <Group gap="xs" mt={2}>
                    <IconCalendarEvent size={14} style={{ opacity: 0.5 }} />
                    <Text size="xs" c="dimmed">
                      {formatDate(ev.date)}
                    </Text>
                  </Group>

                  <Text size="xs" c="dimmed" mt={2}>
                    {ev.sessions_count} session
                    {ev.sessions_count !== 1 ? "s" : ""}
                  </Text>

                  <Button
                    variant={ev.active_sessions_count > 0 ? "filled" : "subtle"}
                    color={ev.active_sessions_count > 0 ? "green" : undefined}
                    size="xs"
                    fullWidth
                    mt="md"
                    leftSection={ev.active_sessions_count > 0 ? <span className="pulse-dot" /> : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/student/events/${ev.id}`);
                    }}
                    >
                      {ev.active_sessions_count > 0
                        ? "View Active Sessions"
                        : "View Sessions"}
                    </Button>
                </Box>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
    </Container>
  );
}
