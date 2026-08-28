import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  Badge,
  Alert,
  SimpleGrid,
  Box,
  Skeleton,
  Group,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconMapPin,
  IconClock,
  IconChevronRight,
  IconAlertCircle,
  IconCalendar,
} from "@tabler/icons-react";
import { getAllEvents } from "../../api/events";
import type { UpcomingEvent } from "../../types/event";
import EmptyState from "../../components/EmptyState";
import { useAsync } from "../../hooks";
import { EVENT_TYPE_COLORS } from "../../utils/constants";
import { formatDate } from "../../utils/formatters";
import "./UpcomingEventsPage.css";

const EVENT_GRADIENTS: Record<string, string> = {
  intramurals: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
  seminar: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
  workshop: "linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)",
  conference: "linear-gradient(135deg, #581c87 0%, #9333ea 100%)",
  campus_activity: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
  assembly: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)",
};

const formatEventType = (type: string) => type.replace(/_/g, " ");

type EventFilter = "all" | "active" | "upcoming" | "past";

export default function UpcomingEventsPage() {
  const navigate = useNavigate();
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
    <Container
      fluid
      pt={0}
      pb={{ base: "6.5rem", sm: "4xl" }}
      px={0}
      style={{ maxWidth: 1440 }}
    >
      {/* ─── 1. Header ─── */}
      <div className="events-directory-header">
        <div className="events-header-text">
          <Group gap={8} align="center">
            <IconCalendar size={20} style={{ color: "var(--brand-primary)" }} />
            <Text fz={{ base: "1.25rem", sm: "1.5rem" }} fw={600} c="var(--text-primary)" lh={1.2} lts="-0.02em">
              Events
            </Text>
          </Group>
          <Text fz="0.8125rem" c="var(--text-secondary)" mt={4}>
            Browse scheduled campus events and session times.
          </Text>
        </div>

        {/* Directory Counts Pod */}
        <div className="events-telemetry-pod">
          <div className="events-pod-metric">
            <span className="pod-metric-val">{counts.all}</span>
            <span className="pod-metric-lbl">Total Events</span>
          </div>
          <div className="events-pod-divider" />
          <div className="events-pod-metric">
            <span className={`pod-metric-val ${counts.active > 0 ? "is-live" : ""}`}>
              {counts.active}
            </span>
            <span className="pod-metric-lbl">Active Now</span>
          </div>
        </div>
      </div>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* ─── 2. Filter Bar ─── */}
      {list.length > 0 && (
        <div className="events-filter-track">
          <button
            type="button"
            className={`events-filter-chip ${filter === "all" ? "is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            className={`events-filter-chip ${filter === "active" ? "is-active" : ""}`}
            onClick={() => setFilter("active")}
          >
            {counts.active > 0 && <span className="events-chip-dot" />}
            Active ({counts.active})
          </button>
          <button
            type="button"
            className={`events-filter-chip ${filter === "upcoming" ? "is-active" : ""}`}
            onClick={() => setFilter("upcoming")}
          >
            Upcoming ({counts.upcoming})
          </button>
          <button
            type="button"
            className={`events-filter-chip ${filter === "past" ? "is-active" : ""}`}
            onClick={() => setFilter("past")}
          >
            Past ({counts.past})
          </button>
        </div>
      )}

      {/* ─── 3. Event Cards Grid ─── */}
      {loading && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          <Skeleton height={260} radius="md" />
          <Skeleton height={260} radius="md" />
          <Skeleton height={260} radius="md" />
        </SimpleGrid>
      )}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No campus events" : `No ${filter} events found`}
          description="Check back later or browse other categories."
          icon={<IconCalendarEvent size={28} />}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {filtered.map((ev) => {
            const accentColor = EVENT_TYPE_COLORS[ev.event_type] || "blue";
            const bannerBg = ev.photo_url
              ? `url(${ev.photo_url}) center / cover no-repeat`
              : (EVENT_GRADIENTS[ev.event_type] ?? "linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)");

            // Parse date for Apple Calendar Badge
            const eventDate = new Date(ev.date);
            const monthStr = isNaN(eventDate.getTime())
              ? "EVT"
              : eventDate.toLocaleString("default", { month: "short" });
            const dayNum = isNaN(eventDate.getTime())
              ? "01"
              : String(eventDate.getDate()).padStart(2, "0");

            return (
              <div
                key={ev.id}
                className="event-grid-card"
                onClick={() => navigate(`/student/events/${ev.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate(`/student/events/${ev.id}`);
                  }
                }}
              >
                {/* Header Banner with Apple Calendar Badge & Status Pills */}
                <div
                  className="event-card-header"
                  style={{ "--card-banner-bg": bannerBg } as React.CSSProperties}
                >
                  <div className="event-calendar-badge">
                    <span className="event-cal-month">{monthStr}</span>
                    <span className="event-cal-day">{dayNum}</span>
                  </div>

                  <Box style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Badge
                      color={accentColor}
                      variant="filled"
                      size="xs"
                      styles={{
                        root: {
                          backdropFilter: "blur(8px)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          borderRadius: "4px",
                        },
                      }}
                    >
                      {formatEventType(ev.event_type)}
                    </Badge>

                    {ev.active_sessions_count > 0 && (
                      <Badge
                        color="red"
                        variant="filled"
                        size="xs"
                        leftSection={<span className="live-indicator-dot" />}
                        styles={{ root: { fontWeight: 700, borderRadius: "4px" } }}
                      >
                        LIVE
                      </Badge>
                    )}
                  </Box>
                </div>

                {/* Card Content & Metadata Cluster */}
                <div className="event-card-body">
                  <div>
                    <Text className="event-card-title" lineClamp={2}>
                      {ev.name}
                    </Text>

                    {ev.description && (
                      <Text className="event-card-desc" lineClamp={2}>
                        {ev.description}
                      </Text>
                    )}
                  </div>

                  {/* Metadata Cluster */}
                  <div className="event-meta-cluster">
                    <div className="event-meta-row">
                      <IconMapPin size={13} />
                      <Text fz="0.75rem" c="var(--text-secondary)" lineClamp={1}>
                        {ev.venue || "Campus Venue TBD"}
                      </Text>
                    </div>

                    <div className="event-meta-row">
                      <IconClock size={13} />
                      <Text fz="0.75rem" c="var(--text-secondary)" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatDate(ev.date)} • {ev.sessions_count} Session{ev.sessions_count !== 1 ? "s" : ""}
                      </Text>
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="event-card-footer">
                    <span>View details</span>
                    <div className="event-footer-arrow-box">
                      <IconChevronRight size={14} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </SimpleGrid>
      )}
    </Container>
  );
}
