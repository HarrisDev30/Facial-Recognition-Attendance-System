import { useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Group,
  Button,
  Badge,
  Text,
  Menu,
  ActionIcon,
  Loader,
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
  IconArrowLeft,
  IconClock,
  IconDeviceCctv,
  IconCheck,
} from "@tabler/icons-react";
import * as eventsApi from "../../api/events";
import * as sessionsApi from "../../api/sessions";
import type { EventResponse } from "../../types/event";
import type { SessionResponse, SessionCreate } from "../../types/session";
import { useAsync, useFormSubmit } from "../../hooks";
import SessionFormModal from "../../components/forms/SessionFormModal";
import { notifications } from "@mantine/notifications";
import { getApiError } from "../../utils/error";
import { formatDate, formatTime } from "../../utils/formatters";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../../utils/constants";
import "./AdminEventSessionsPage.css";

export default function AdminEventSessionsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionResponse | null>(null);

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

  const activeSessions = useMemo(() => sessions.filter((s) => s.status === "active"), [sessions]);
  const completedSessions = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);
  const scheduledSessions = useMemo(
    () => sessions.filter((s) => s.status === "scheduled" || s.status === "pending"),
    [sessions]
  );

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
      notifications.show({ title: "Session activated", message: "Session is now active and verifying attendance.", color: "green" });
    } catch (err) {
      notifications.show({ title: "Failed to activate session", message: getApiError(err), color: "red" });
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!eventId) return;
    try {
      await sessionsApi.deactivateSession(id);
      reload();
      notifications.show({ title: "Session completed", message: "Session has been concluded.", color: "blue" });
    } catch (err) {
      notifications.show({ title: "Failed to conclude session", message: getApiError(err), color: "red" });
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

  const eventTypeLabel = event ? (EVENT_TYPE_LABELS[event.event_type] || event.event_type) : "EVENT";
  const eventTypeColor = event ? (EVENT_TYPE_COLORS[event.event_type] || "gray") : "gray";

  return (
    <div className="eventsessions-container">
      {/* ─── 1. Executive Split Header Card (Student Dashboard Parity) ─── */}
      <div className="eventsessions-header-card">
        {/* Left Column: Navigation, Eyebrow, Event Heading, Meta Tags, and Actions */}
        <div className="eventsessions-identity-col">
          <div>
            <button
              type="button"
              className="eventsessions-back-btn"
              onClick={() => navigate("/admin/events")}
            >
              <IconArrowLeft size={14} />
              <span>Back to Events</span>
            </button>

            <div className="eventsessions-title-group" style={{ marginTop: "12px" }}>
              <span className="eventsessions-eyebrow">Event Operations • Session Fleet</span>
              <h1 className="eventsessions-title" title={event?.name || "Event Sessions"}>
                {event?.name || "Event Sessions"}
              </h1>
              <div className="eventsessions-institution-name">
                {event && (
                  <>
                    <span>
                      {formatDate(event.start_date)} – {formatDate(event.end_date)}
                    </span>
                    {event.venue && <span>• {event.venue}</span>}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="eventsessions-credential-stack">
            {event && (
              <Badge size="sm" variant="light" color={eventTypeColor} radius="sm">
                {eventTypeLabel}
              </Badge>
            )}
            <span className="eventsessions-tag">
              FLEET: {sessions.length} SESSIONS
            </span>
            {activeSessions.length > 0 ? (
              <span className="eventsessions-type-pill" style={{ color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                <span className="eventsessions-pulse-beacon" style={{ marginRight: 4 }} />
                {activeSessions.length} Active Now
              </span>
            ) : (
              <span className="eventsessions-type-pill">
                <IconCheck size={12} style={{ marginRight: 4 }} />
                Standby
              </span>
            )}
          </div>

          <div className="eventsessions-cta-row">
            <Button
              className="eventsessions-btn-primary"
              leftSection={<IconPlus size={16} />}
              onClick={openCreate}
            >
              Create Session
            </Button>
            <Button
              className="eventsessions-btn-secondary"
              leftSection={<IconDeviceCctv size={16} />}
              onClick={() => navigate("/admin/scanner-devices")}
            >
              Scanner Fleet
            </Button>
          </div>
        </div>

        {/* Right Column: 3 Visual Telemetry Cards */}
        <div className="eventsessions-visual-frame">
          <div className="eventsessions-visual-slide">
            <span className="eventsessions-slide-category">Session Fleet</span>
            <div className="eventsessions-slide-big-metric">
              {sessions.length}
            </div>
            <span className="eventsessions-slide-subtext">
              {scheduledSessions.length} scheduled, {completedSessions.length} concluded
            </span>
          </div>

          <div className="eventsessions-visual-slide">
            <span className="eventsessions-slide-category">Active Verification</span>
            <div className="eventsessions-slide-big-metric" style={{ color: activeSessions.length > 0 ? "#10b981" : "var(--text-primary)" }}>
              {activeSessions.length > 0 ? `${activeSessions.length} LIVE` : "0 ACTIVE"}
            </div>
            <span className="eventsessions-slide-subtext">
              {activeSessions.length > 0 ? "Kiosks actively verifying attendees" : "No live sessions currently running"}
            </span>
          </div>

          <div className="eventsessions-visual-slide">
            <span className="eventsessions-slide-category">Event Runway</span>
            <div className="eventsessions-slide-big-metric" style={{ fontSize: "1.15rem", fontWeight: 700, paddingTop: 4 }}>
              {event ? formatDate(event.start_date) : "—"}
            </div>
            <span className="eventsessions-slide-subtext">
              {event?.venue ? `Venue: ${event.venue}` : "Campus Facility"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. Active Session Live Alert Banner (if any session is running) ─── */}
      {activeSessions.length > 0 && (
        <div className="eventsessions-live-banner">
          <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
            <span className="eventsessions-pulse-beacon" />
            <div style={{ minWidth: 0 }}>
              <Group gap={6} align="center">
                <Text fz="0.875rem" fw={700} c="var(--text-primary)" truncate>
                  Live Session Active: {activeSessions[0].name}
                </Text>
                <span className="eventsessions-live-badge">Live</span>
              </Group>
              <Text fz="0.75rem" c="var(--text-secondary)" truncate>
                {activeSessions[0].venue ?? "Campus Entrance"} • Kiosks and marshals actively checking in attendees
              </Text>
            </div>
          </Group>

          <Group gap={8} wrap="nowrap">
            <Button
              size="xs"
              variant="filled"
              color="teal"
              component={Link}
              to={`/admin/sessions/${activeSessions[0].id}/attendance`}
              state={{ eventId: event?.id || eventId, eventName: event?.name }}
              style={{ fontWeight: 600, borderRadius: 8 }}
            >
              View Attendance
            </Button>
            <Button
              size="xs"
              variant="default"
              component={Link}
              to={`/marshal/scanner/${activeSessions[0].id}`}
              style={{ fontWeight: 600, borderRadius: 8 }}
            >
              Scanner Kiosk
            </Button>
          </Group>
        </div>
      )}

      {/* ─── 3. Session Bento Grid ─── */}
      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      ) : sessions.length > 0 ? (
        <div className="sessions-bento-grid">
          {sessions.map((s) => {
            const isActive = s.status === "active";
            const isPending = s.status === "pending" || s.status === "scheduled";
            const isCompleted = s.status === "completed";

            return (
              <div
                key={s.id}
                className={`session-bento-card ${isActive ? "active-session" : ""}`}
              >
                <div>
                  <div className="session-card-header">
                    <span className={`session-status-pill ${s.status}`}>
                      {isActive && <span className="eventsessions-pulse-beacon" style={{ width: 6, height: 6 }} />}
                      {isActive ? "Active Now" : s.status.toUpperCase()}
                    </span>

                    <Menu position="bottom-end" shadow="md" withinPortal>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="sm" color="gray">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconPencil size={14} />}
                          onClick={() => openEdit(s)}
                        >
                          Edit Details
                        </Menu.Item>
                        {isActive && (
                          <Menu.Item
                            leftSection={<IconPlayerStop size={14} />}
                            color="orange"
                            onClick={() => handleDeactivate(s.id)}
                          >
                            Conclude Session
                          </Menu.Item>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </div>

                  <h3 className="session-card-title" style={{ marginTop: "12px" }}>
                    {s.name}
                  </h3>

                  <div className="session-metadata-wrap" style={{ marginTop: "10px" }}>
                    <div className="session-meta-item">
                      <IconCalendarEvent size={14} />
                      <span>{formatDate(s.start_time)}</span>
                    </div>
                    <div className="session-meta-item">
                      <IconClock size={14} />
                      <span>
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </span>
                    </div>
                    <div className="session-meta-item">
                      <IconMapPin size={14} />
                      <span>{s.venue || "Campus Venue / Unassigned"}</span>
                    </div>
                  </div>
                </div>

                <div className="session-card-actions">
                  <Button
                    size="xs"
                    className="session-action-primary"
                    leftSection={<IconClipboardCheck size={14} />}
                    component={Link}
                    to={`/admin/sessions/${s.id}/attendance`}
                    state={{ eventId: event?.id || eventId, eventName: event?.name }}
                  >
                    Attendance
                  </Button>

                  {isPending && (
                    <Button
                      size="xs"
                      variant="filled"
                      color="teal"
                      leftSection={<IconPlayerPlay size={14} />}
                      onClick={() => handleActivate(s.id)}
                      style={{ fontWeight: 600, borderRadius: 8 }}
                    >
                      Activate
                    </Button>
                  )}

                  {isActive && (
                    <Button
                      size="xs"
                      className="session-action-subtle"
                      leftSection={<IconDeviceCctv size={14} />}
                      component={Link}
                      to={`/marshal/scanner/${s.id}`}
                    >
                      Kiosk Mode
                    </Button>
                  )}

                  {isCompleted && (
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginLeft: "auto", fontFamily: "var(--font-mono, monospace)" }}>
                      Concluded
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Quick Create Session Tile */}
          <div className="create-session-tile" onClick={openCreate}>
            <div className="create-session-icon">
              <IconPlus size={22} />
            </div>
            <div>
              <Text fz="0.875rem" fw={600} c="var(--text-primary)">
                Add New Session
              </Text>
              <Text fz="0.75rem" c="var(--text-muted)">
                Schedule another time block or breakout
              </Text>
            </div>
          </div>
        </div>
      ) : (
        <div className="eventsessions-empty-state">
          <div className="create-session-icon" style={{ width: 52, height: 52 }}>
            <IconCalendarEvent size={26} />
          </div>
          <div>
            <Text fz="1rem" fw={600} c="var(--text-primary)">
              No sessions scheduled for this event
            </Text>
            <Text fz="0.8125rem" c="var(--text-secondary)" mt={2}>
              Create your first session block to begin checking in attendees via facial recognition or QR codes.
            </Text>
          </div>
          <Button
            className="eventsessions-btn-primary"
            leftSection={<IconPlus size={16} />}
            onClick={openCreate}
            mt="xs"
          >
            Create First Session
          </Button>
        </div>
      )}

      {/* Session Modal */}
      <SessionFormModal
        opened={opened}
        onClose={() => {
          setOpened(false);
          setEditingSession(null);
        }}
        onSubmit={editingSession ? updateSubmit : createSubmit}
        initial={editingSession}
        loading={editingSession ? updating : creating}
      />
    </div>
  );
}
