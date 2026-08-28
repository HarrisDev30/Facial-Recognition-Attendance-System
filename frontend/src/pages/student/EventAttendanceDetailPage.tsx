import { useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Container,
  Text,
  Group,
  Badge,
  Box,
  Progress,
  Skeleton,
  Button,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconClock,
  IconMapPin,
  IconCheck,
  IconShieldCheck,
  IconQrcode,
  IconUserCheck,
  IconChevronLeft,
} from "@tabler/icons-react";
import { getAllEvents } from "../../api/events";
import { getMyEventAttendance } from "../../api/attendees";
import type { UpcomingEvent } from "../../types/event";
import { useAsync } from "../../hooks";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../../utils/constants";
import { formatDate, formatTime, formatDateTime, formatConfidence } from "../../utils/formatters";
import "./EventAttendanceDetailPage.css";

const EVENT_GRADIENTS: Record<string, string> = {
  intramurals: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
  seminar: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
  workshop: "linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)",
  conference: "linear-gradient(135deg, #581c87 0%, #9333ea 100%)",
  campus_activity: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
  assembly: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)",
};

const VERIFICATION_ICONS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
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
  const isFullyCleared = totalSessions > 0 && checkedCount >= totalSessions;
  const hasLiveSession = sessions.some((s) => s.status === "active");

  const accentColor = event ? EVENT_TYPE_COLORS[event.event_type] || "blue" : "blue";
  const eventTypeLabel = event
    ? EVENT_TYPE_LABELS[event.event_type] || event.event_type
    : "";

  const bannerBg = event?.photo_url
    ? `url(${event.photo_url}) center / cover no-repeat`
    : event
    ? (EVENT_GRADIENTS[event.event_type] ?? "linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)")
    : "var(--surface-2)";

  // Parse date for Apple Calendar Badge
  const eventDate = event ? new Date(event.date) : new Date();
  const monthStr = isNaN(eventDate.getTime())
    ? "EVT"
    : eventDate.toLocaleString("default", { month: "short" });
  const dayNum = isNaN(eventDate.getTime())
    ? "01"
    : String(eventDate.getDate()).padStart(2, "0");

  return (
    <Container
      fluid
      pt={0}
      pb={{ base: "6.5rem", sm: "4xl" }}
      px={0}
      style={{ maxWidth: 1440 }}
    >
      {/* ─── Top Navigation Bar ─── */}
      <div className="event-detail-topbar">
        <Button
          variant="default"
          size="xs"
          component={Link}
          to="/student/events"
          leftSection={<IconChevronLeft size={14} />}
          style={{
            borderRadius: "6px",
            height: "32px",
            fontSize: "13px",
            fontWeight: 500,
            borderColor: "var(--border-subtle)",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
          }}
        >
          All Events
        </Button>
      </div>

      {loading && (
        <Box>
          <Skeleton height={200} radius="md" mb="md" />
          <Skeleton height={90} radius="md" mb="md" />
          <Skeleton height={140} radius="md" />
        </Box>
      )}

      {!loading && event && (
        <>
          {/* ─── Editorial Campus Event Hero ─── */}
          <div className="event-hero-card">
            <div
              className="event-hero-banner"
              style={{ "--hero-banner-bg": bannerBg } as React.CSSProperties}
            >
              <div className="event-calendar-badge">
                <span className="event-cal-month">{monthStr}</span>
                <span className="event-cal-day">{dayNum}</span>
              </div>

              <Group gap="xs">
                <Badge
                  color={accentColor}
                  variant="filled"
                  size="sm"
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
                  {eventTypeLabel}
                </Badge>

                {hasLiveSession && (
                  <Badge
                    color="red"
                    variant="filled"
                    size="sm"
                    leftSection={<span className="live-indicator-dot" />}
                    styles={{ root: { fontWeight: 700, borderRadius: "4px" } }}
                  >
                    Live now
                  </Badge>
                )}
              </Group>
            </div>

            <div className="event-hero-content">
              <Text className="event-hero-title">{event.name}</Text>

              {event.description && (
                <Text className="event-hero-desc">{event.description}</Text>
              )}

              <div className="event-hero-chips">
                <div className="event-hero-chip">
                  <IconCalendarEvent size={14} />
                  <span>{formatDate(event.date)}</span>
                </div>

                {event.venue && (
                  <div className="event-hero-chip">
                    <IconMapPin size={14} />
                    <span>{event.venue}</span>
                  </div>
                )}

                <div className="event-hero-chip">
                  <IconClock size={14} />
                  <span>
                    {event.sessions_count} Session{event.sessions_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Attendance Progress Card ─── */}
          <div
            className={`clearance-status-card ${
              isFullyCleared ? "is-cleared" : hasLiveSession ? "is-live" : ""
            }`}
          >
            <div className="clearance-status-header">
              <div className="clearance-status-titles">
                <Text fz="0.9375rem" fw={700} c="var(--text-primary)" lts="-0.01em">
                  {isFullyCleared
                    ? "✓ Event Completed"
                    : hasLiveSession
                    ? "Session in progress"
                    : "Attendance Progress"}
                </Text>
                <Text fz="0.775rem" c="var(--text-secondary)">
                  {isFullyCleared
                    ? "You have attended all sessions for this event."
                    : hasLiveSession
                    ? "Check-in is currently open for this event."
                    : `Attend all ${totalSessions} sessions to complete this event.`}
                </Text>
              </div>

              <Badge
                size="sm"
                variant="light"
                color={isFullyCleared ? "teal" : hasLiveSession ? "red" : "blue"}
                className="clearance-status-badge"
              >
                {checkedCount} of {totalSessions} Sessions ({progressPercent}%)
              </Badge>
            </div>

            {/* Edge-to-Edge Fluid Progress Bar */}
            <div className="clearance-progress-wrap">
              <Progress
                value={progressPercent}
                size="md"
                color={isFullyCleared ? "teal" : hasLiveSession ? "red" : "blue"}
                radius="xl"
                animated={hasLiveSession}
              />
            </div>
          </div>

          {/* ─── Sessions Stream ─── */}
          <div>
            <div className="timeline-section-title">Sessions & attendance</div>

            {sessions.length === 0 ? (
              <Box py="xl" ta="center">
                <Text fz="0.85rem" c="var(--text-secondary)">
                  No sessions have been scheduled for this event yet.
                </Text>
              </Box>
            ) : (
              <div className="timeline-stream">
                {sessions.map((session) => {
                  const isAttended = Boolean(session.verified_at);
                  const isActive = session.status === "active";
                  const meta = session.verification_method
                    ? (VERIFICATION_ICONS[session.verification_method] ?? {
                        label: "Verified",
                        icon: <IconCheck size={14} />,
                        color: "teal",
                      })
                    : null;

                  return (
                    <div
                      key={session.session_id}
                      className={`timeline-node-card ${isActive ? "is-active" : ""} ${
                        isAttended ? "is-attended" : ""
                      }`}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                        <div>
                          <Text className="timeline-session-title">
                            {session.session_name}
                          </Text>

                          <div className="timeline-session-meta">
                            <Group gap={4} align="center">
                              <IconClock size={13} />
                              <span>
                                {formatTime(session.start_time)} – {formatTime(session.end_time)}
                              </span>
                            </Group>

                            {session.venue && (
                              <Group gap={4} align="center">
                                <IconMapPin size={13} />
                                <span>{session.venue}</span>
                              </Group>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isAttended ? (
                          <Badge size="xs" color="teal" variant="light" styles={{ root: { fontWeight: 600, flexShrink: 0 } }}>
                            ✓ Attended
                          </Badge>
                        ) : isActive ? (
                          <Badge size="xs" color="red" variant="filled" styles={{ root: { fontWeight: 700, flexShrink: 0 } }}>
                            Live Now
                          </Badge>
                        ) : (
                          <Badge size="xs" color="gray" variant="light" styles={{ root: { fontWeight: 500, flexShrink: 0 } }}>
                            Upcoming
                          </Badge>
                        )}
                      </Group>

                      {/* Verified Check-In Receipt */}
                      {isAttended && session.verified_at && (
                        <div className="timeline-receipt-box">
                          <Group gap={6} align="center">
                            {meta?.icon}
                            <Text fz="0.75rem" fw={600} c="var(--text-primary)">
                              {meta?.label ?? "Verified Check-In"}
                            </Text>
                            {session.confidence_score != null && (
                              <Badge size="xs" variant="outline" color="teal">
                                {formatConfidence(session.confidence_score)} Match
                              </Badge>
                            )}
                          </Group>

                          <Text fz="0.725rem" c="var(--text-secondary)">
                            Recorded: {formatDateTime(session.verified_at)}
                          </Text>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !event && (
        <Box py="xl" ta="center">
          <IconCalendarEvent size={48} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
          <Text mt="md" c="var(--text-secondary)">
            Event not found or has been moved.
          </Text>
        </Box>
      )}
    </Container>
  );
}
