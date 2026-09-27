import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  Group,
  Badge,
  Button,
  Alert,
  Box,
  Grid,
  SimpleGrid,
  Skeleton,
  Stack,
  ThemeIcon,
  Modal,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconDeviceMobile,
  IconQrcode,
  IconCalendarEvent,
  IconClock,
  IconMapPin,
  IconRefresh,
  IconScan,
  IconUserCheck,
  IconShieldCheck,
  IconCloudUpload,
  IconWifi,
  IconWifiOff,
  IconUsers,
  IconPlayerPlay,
  IconCamera,
  IconCheck,
  IconSchool,
  IconHistory,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import { useInstitutionTheme } from "../../theme/InstitutionThemeProvider";
import { useAsync } from "../../hooks";
import client from "../../api/client";
import {
  getActiveSessions,
  getMyOverrides,
  getMarshalUpcomingEvents,
  activateSession,
  extendSession,
  type MarshalUpcomingEvent,
  type MarshalOverride as MarshalOverrideType,
} from "../../api/marshal";
import { getAttendees, type AttendeeResponse } from "../../api/attendees";
import StudentSearchModal from "../../components/marshal/StudentSearchModal";
import { formatTime, greeting } from "../../utils/formatters";
import {
  initOfflineSyncWatcher,
  getPendingQueueCount,
  flushOfflineQueue,
} from "../../utils/offlineQueue";
import "./MarshalDashboardPage.css";

interface ShiftStats {
  total_verified_today: number;
  face_count: number;
  qr_count: number;
  override_count: number;
  active_sessions_count: number;
}

export default function MarshalDashboardPage() {
  const { user } = useAuthStore();
  const { institution } = useInstitutionTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Role detection
  const isStudentMarshal = Boolean(
    user?.attendee_id ||
      (user?.assigned_org_ids && user.assigned_org_ids.length > 0 && user.role === "student") ||
      (user?.is_marshal && user.role === "student"),
  );
  const firstName = user?.first_name || user?.email?.split("@")[0] || "Officer";

  // Data states
  const [attendees, setAttendees] = useState<AttendeeResponse[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<MarshalUpcomingEvent[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Shift Stats & Offline Sync
  const [shiftStats, setShiftStats] = useState<ShiftStats | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState(getPendingQueueCount());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  // Camera readiness modal
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const videoTestRef = useRef<HTMLVideoElement | null>(null);

  const { data, loading, error, execute } = useAsync(async () => {
    const [sessions, overrides, statsRes, atts, upEvents] = await Promise.all([
      getActiveSessions(),
      getMyOverrides().catch(() => [] as MarshalOverrideType[]),
      client.get<ShiftStats>("/api/marshal/stats/shift").then((r) => r.data).catch(() => null),
      getAttendees().catch(() => [] as AttendeeResponse[]),
      getMarshalUpcomingEvents().catch(() => [] as MarshalUpcomingEvent[]),
    ]);
    if (statsRes) setShiftStats(statsRes);
    setAttendees(atts);
    setUpcomingEvents(upEvents);
    return { sessions, overrides };
  }, true);

  useEffect(() => {
    const cleanup = initOfflineSyncWatcher((count, online) => {
      setPendingQueueCount(count);
      setIsOnline(online);
    });
    return cleanup;
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await flushOfflineQueue();
      setPendingQueueCount(res.remaining);
      execute();
    } finally {
      setSyncing(false);
    }
  };

  const sessions = data?.sessions ?? [];
  const overrides = data?.overrides ?? [];

  const [overrideSessionId, setOverrideSessionId] = useState<string | null>(null);

  const openOverride = (sessionId: string) => {
    setOverrideSessionId(sessionId);
    setSearchModalOpen(true);
  };

  const handleStartSession = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    try {
      await activateSession(sessionId);
      notifications.show({
        title: "Station Opened",
        message: "Attendance session is now active and ready for check-ins!",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      execute();
    } catch {
      notifications.show({
        title: "Could not activate session",
        message: "Please ensure you have permissions for this department event.",
        color: "red",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExtendSession = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    try {
      await extendSession(sessionId, 15);
      notifications.show({
        title: "Session Extended",
        message: "Added +15 minutes to session check-in window.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      execute();
    } catch {
      notifications.show({
        title: "Could not extend session",
        message: "Error extending time.",
        color: "red",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const testCamera = async () => {
    setCameraModalOpen(true);
    setCameraStatus("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
      });
      if (videoTestRef.current) {
        videoTestRef.current.srcObject = stream;
        await videoTestRef.current.play();
      }
      setCameraStatus("success");
    } catch {
      setCameraStatus("failed");
    }
  };

  const closeCameraTest = () => {
    if (videoTestRef.current && videoTestRef.current.srcObject) {
      const stream = videoTestRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoTestRef.current.srcObject = null;
    }
    setCameraModalOpen(false);
  };

  return (
    <Container fluid pt={0} pb={{ base: "6.5rem", sm: "4xl" }} px={0} style={{ maxWidth: 1440 }}>
      {/* ─── 1. Executive Split Header Card with Integrated Camera & Network Pod ─── */}
      <div className="marshal-header-card">
        {/* Left Column: Officer Identity & Controls */}
        <div className="marshal-identity-col">
          <div>
            <h1 className="marshal-greeting-title">
              {greeting(firstName)}
            </h1>
            <span className="marshal-institution-subtext">
              {institution?.name || "Campus Portal"} • Check-In Station
            </span>
          </div>

          <div className="marshal-credential-stack">
            {isStudentMarshal ? (
              <span className="marshal-status-pill badge-student">
                <IconSchool size={13} />
                Student Marshal
              </span>
            ) : (
              <span className="marshal-status-pill badge-staff">
                <IconShieldCheck size={13} />
                Field Marshal
              </span>
            )}

            <span className="marshal-chip-tag">
              ID: {user?.id?.slice(0, 8) || "MARSHAL"}
            </span>
          </div>

          <Group gap="xs" mt={4} wrap="wrap">
            <Button
              className="marshal-action-btn-secondary"
              size="sm"
              leftSection={<IconUsers size={16} />}
              onClick={() => {
                setOverrideSessionId(null);
                setSearchModalOpen(true);
              }}
            >
              {sessions.length > 0 ? "Search & Check In" : "Student Directory"}
            </Button>
            <Button
              className="marshal-action-btn-secondary"
              size="sm"
              leftSection={<IconRefresh size={16} />}
              onClick={() => execute()}
              loading={loading}
            >
              Refresh
            </Button>
          </Group>
        </div>

        {/* Right Column: Integrated Camera & Network Telemetry Pod */}
        <div className="marshal-telemetry-pod">
          {/* Camera Readiness */}
          <div className="marshal-telemetry-row">
            <div className="marshal-telemetry-info">
              <div className="marshal-telemetry-icon-box">
                <IconCamera size={16} />
              </div>
              <div>
                <Text size="xs" fw={600} c="var(--text-primary)">
                  Camera Sensor
                </Text>
                <Text size="10px" c="dimmed">
                  Biometric readiness
                </Text>
              </div>
            </div>
            <Button
              size="compact-xs"
              variant="light"
              color="teal"
              leftSection={<IconCamera size={12} />}
              onClick={testCamera}
            >
              Test Camera
            </Button>
          </div>

          <div className="marshal-telemetry-divider" />

          {/* Network Connection */}
          <div className="marshal-telemetry-row">
            <div className="marshal-telemetry-info">
              <div className="marshal-telemetry-icon-box">
                {isOnline ? <IconWifi size={16} /> : <IconWifiOff size={16} />}
              </div>
              <div>
                <Text size="xs" fw={600} c="var(--text-primary)">
                  Connection
                </Text>
                <Text size="10px" c="dimmed">
                  {isOnline ? "Live sync active" : "Offline mode active"}
                </Text>
              </div>
            </div>
            {isOnline ? (
              <Badge size="sm" color="teal" variant="light">
                Online
              </Badge>
            ) : (
              <Badge size="sm" color="red" variant="filled">
                Offline
              </Badge>
            )}
          </div>

          <div className="marshal-telemetry-divider" />

          {/* Saved Offline Scans */}
          <div className="marshal-telemetry-row">
            <div className="marshal-telemetry-info">
              <div className="marshal-telemetry-icon-box">
                <IconCloudUpload size={16} />
              </div>
              <div>
                <Text size="xs" fw={600} c="var(--text-primary)">
                  Saved Scans
                </Text>
                <Text size="10px" c="dimmed">
                  {pendingQueueCount === 0 ? "All scans synced" : `${pendingQueueCount} buffered`}
                </Text>
              </div>
            </div>
            {pendingQueueCount > 0 ? (
              <Button
                size="compact-xs"
                color="orange"
                variant="filled"
                loading={syncing}
                onClick={handleManualSync}
              >
                Sync {pendingQueueCount}
              </Button>
            ) : (
              <Badge size="sm" color="gray" variant="light">
                0 queued
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. Metric Bento Grid (Clean & Direct) ─── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
        <div className="marshal-metric-card">
          <div className="marshal-metric-label">
            <span>Total Checked In</span>
            <IconUserCheck size={16} style={{ opacity: 0.6 }} />
          </div>
          <div className="marshal-metric-value" style={{ color: "var(--brand-primary, #10b981)" }}>
            {shiftStats?.total_verified_today ?? 0}
          </div>
          <div className="marshal-metric-subtext">Verified attendees today</div>
        </div>

        <div className="marshal-metric-card">
          <div className="marshal-metric-label">
            <span>Face Scans</span>
            <IconScan size={16} style={{ opacity: 0.6 }} />
          </div>
          <div className="marshal-metric-value" style={{ color: "#3b82f6" }}>
            {shiftStats?.face_count ?? 0}
          </div>
          <div className="marshal-metric-subtext">Biometric camera scans</div>
        </div>

        <div className="marshal-metric-card">
          <div className="marshal-metric-label">
            <span>QR Codes</span>
            <IconQrcode size={16} style={{ opacity: 0.6 }} />
          </div>
          <div className="marshal-metric-value" style={{ color: "#06b6d4" }}>
            {shiftStats?.qr_count ?? 0}
          </div>
          <div className="marshal-metric-subtext">Digital pass scans</div>
        </div>

        <div className="marshal-metric-card">
          <div className="marshal-metric-label">
            <span>Manual Check-Ins</span>
            <IconShieldCheck size={16} style={{ opacity: 0.6 }} />
          </div>
          <div className="marshal-metric-value" style={{ color: "#f59e0b" }}>
            {shiftStats?.override_count ?? 0}
          </div>
          <div className="marshal-metric-subtext">Manual roster lookups</div>
        </div>
      </SimpleGrid>

      {/* ─── 3. Main Responsive Layout (Grid with Full-Width Mobile Support) ─── */}
      <Grid gutter="lg">
        {/* Left Column: Active Check-In Stations & Upcoming Events */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          {/* Active Check-In Stations Card */}
          <div className="marshal-section-card">
            <div className="marshal-section-header">
              <h2 className="marshal-section-title">
                <span className="marshal-live-beacon" />
                Active Check-In Stations
              </h2>
              <Badge color="teal" variant="light" size="sm">
                {sessions.length} Live
              </Badge>
            </div>

            {loading && !data ? (
              <Stack gap="md">
                <Skeleton height={140} radius="md" />
                <Skeleton height={140} radius="md" />
              </Stack>
            ) : error ? (
              <Alert color="red" title="Error Loading Stations">
                Could not fetch active attendance sessions.
              </Alert>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <ThemeIcon size={48} radius="xl" color="gray" variant="light" mx="auto" mb="sm">
                  <IconCalendarEvent size={24} />
                </ThemeIcon>
                <Text fw={600} size="sm">No Live Stations Right Now</Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Choose an upcoming event below to start check-in, or test your camera.
                </Text>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.session_id} className="marshal-station-item">
                  {/* Station Info Header */}
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text fw={700} size="md" c="var(--text-primary)">
                        {session.session_name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {session.event_name}
                      </Text>
                    </div>
                    <Badge color="teal" variant="light" size="sm">
                      Live Gate
                    </Badge>
                  </Group>

                  {/* Telemetry Row */}
                  <Group gap="md">
                    {session.venue && (
                      <Group gap={4}>
                        <IconMapPin size={14} style={{ opacity: 0.6 }} />
                        <Text size="xs" c="dimmed">
                          {session.venue}
                        </Text>
                      </Group>
                    )}
                    <Group gap={4}>
                      <IconClock size={14} style={{ opacity: 0.6 }} />
                      <Text size="xs" c="dimmed">
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </Text>
                    </Group>
                    <Group gap={4}>
                      <IconUserCheck size={14} style={{ opacity: 0.6 }} />
                      <Text size="xs" c="teal" fw={600}>
                        {session.checked_in_count || 0} Checked In
                      </Text>
                    </Group>
                  </Group>

                  {/* Hero Action: Kiosk for Desktop/Laptop vs Mobile Scanner for Phone */}
                  {!isMobile ? (
                    <Button
                      className="marshal-hero-btn"
                      leftSection={<IconScan size={18} />}
                      onClick={() => navigate(`/marshal/scanner/${session.session_id}`)}
                    >
                      Launch Station Kiosk (Laptop)
                    </Button>
                  ) : (
                    <Button
                      className="marshal-hero-btn"
                      leftSection={<IconDeviceMobile size={18} />}
                      onClick={() => navigate(`/marshal/scanner/mobile/${session.session_id}`)}
                    >
                      Launch Mobile Scanner
                    </Button>
                  )}

                  {/* Secondary Actions Matrix */}
                  <div className="marshal-secondary-grid">
                    {!isMobile && (
                      <Button
                        className="marshal-sub-action-btn"
                        leftSection={<IconDeviceMobile size={14} />}
                        onClick={() => navigate(`/marshal/scanner/mobile/${session.session_id}`)}
                      >
                        Phone Scan
                      </Button>
                    )}

                    <Button
                      className="marshal-sub-action-btn"
                      leftSection={<IconQrcode size={14} />}
                      onClick={() => navigate(`/marshal/scanner/mobile/${session.session_id}?mode=qr`)}
                    >
                      QR Pass
                    </Button>

                    <Button
                      className="marshal-sub-action-btn"
                      leftSection={<IconShieldCheck size={14} />}
                      onClick={() => openOverride(session.session_id)}
                    >
                      Manual
                    </Button>

                    <Button
                      className="marshal-sub-action-btn"
                      loading={actionLoadingId === session.session_id}
                      onClick={() => handleExtendSession(session.session_id)}
                    >
                      +15m Extend
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Upcoming Department Events & Sessions Card */}
          <div className="marshal-section-card">
            <div className="marshal-section-header">
              <h2 className="marshal-section-title">
                <IconCalendarEvent size={18} color="var(--brand-primary, #10b981)" />
                Upcoming Events & Sessions
              </h2>
              <Badge color="blue" variant="light" size="sm">
                {upcomingEvents.length} Scheduled
              </Badge>
            </div>

            {upcomingEvents.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="lg">
                No upcoming events found for your department today.
              </Text>
            ) : (
              <Stack gap="md">
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} className="marshal-event-card">
                    {/* Event Cover Image / Gradient Header */}
                    <div
                      className="marshal-event-banner"
                      style={{
                        background: ev.photo_url
                          ? `url(${ev.photo_url}) center / cover no-repeat`
                          : "linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)",
                      }}
                    >
                      <div className="marshal-event-banner-scrim" />
                      <div className="marshal-event-banner-content">
                        <div>
                          <h3 className="marshal-event-title">{ev.name}</h3>
                          <div className="marshal-event-meta-row">
                            <span className="marshal-event-meta-item">
                              <IconSchool size={14} />
                              {ev.organization_name}
                            </span>
                            <span className="marshal-event-meta-item">
                              <IconMapPin size={14} />
                              {ev.venue || "Campus Main Venue"}
                            </span>
                          </div>
                        </div>
                        <Badge size="sm" variant="filled" color="dark">
                          {ev.event_type || "Event"}
                        </Badge>
                      </div>
                    </div>

                    {/* Sessions Body */}
                    <div className="marshal-event-body">
                      {ev.sessions && ev.sessions.length > 0 ? (
                        <div className="marshal-sessions-stack">
                          {ev.sessions.map((sess) => (
                            <div key={sess.id} className="marshal-session-row">
                              <div className="marshal-session-info">
                                <div className="marshal-session-title-row">
                                  <span className="marshal-session-name">{sess.name}</span>
                                  <Badge
                                    size="xs"
                                    color={sess.status === "active" ? "teal" : "gray"}
                                    variant="light"
                                  >
                                    {sess.status === "active" ? "Active Gate" : "Scheduled"}
                                  </Badge>
                                </div>
                                <div className="marshal-session-meta-row">
                                  <span className="marshal-session-time">
                                    <IconClock size={12} />
                                    {formatTime(sess.start_time)} – {formatTime(sess.end_time)}
                                  </span>
                                  {sess.venue && (
                                    <span className="marshal-session-venue">
                                      <IconMapPin size={12} />
                                      {sess.venue}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="marshal-session-action">
                                {sess.status === "active" ? (
                                  <Button
                                    className="marshal-action-btn-primary"
                                    size="xs"
                                    leftSection={isMobile ? <IconDeviceMobile size={14} /> : <IconScan size={14} />}
                                    onClick={() =>
                                      navigate(
                                        isMobile
                                          ? `/marshal/scanner/mobile/${sess.id}`
                                          : `/marshal/scanner/${sess.id}`
                                      )
                                    }
                                  >
                                    {isMobile ? "Mobile Scanner" : "Station Kiosk"}
                                  </Button>
                                ) : (
                                  <Button
                                    className="marshal-action-btn-secondary"
                                    size="xs"
                                    loading={actionLoadingId === sess.id}
                                    leftSection={<IconPlayerPlay size={14} />}
                                    onClick={() => handleStartSession(sess.id)}
                                  >
                                    Start Session
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Text size="xs" c="dimmed">
                          No sessions scheduled yet for this event.
                        </Text>
                      )}
                    </div>
                  </div>
                ))}
              </Stack>
            )}
          </div>
        </Grid.Col>

        {/* Right Column: Shift Activity Log (Full width on mobile, 4-col on desktop) */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
          {/* Recent Manual Check-Ins Activity */}
          <div className="marshal-section-card">
            <div className="marshal-section-header">
              <h2 className="marshal-section-title">
                <IconHistory size={18} color="var(--brand-primary, #10b981)" />
                Recent Manual Check-Ins
              </h2>
              <Badge size="xs" variant="light" color="yellow">
                {overrides.length} Logged
              </Badge>
            </div>

            {overrides.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                No manual check-ins logged during this shift.
              </Text>
            ) : (
              <Stack gap="xs">
                {overrides.slice(0, 8).map((ov) => (
                  <div key={ov.id} className="marshal-override-item">
                    <div className="marshal-override-header">
                      <span className="marshal-override-name">
                        {ov.attendee_name || "Student"}
                      </span>
                      <Badge size="xs" color="yellow" variant="light">
                        {ov.reason || "Manual Override"}
                      </Badge>
                    </div>
                    <div className="marshal-override-meta">
                      <span>{ov.session_name || "Station Gate"}</span>
                      <span>
                        {ov.timestamp
                          ? new Date(ov.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Just now"}
                      </span>
                    </div>
                  </div>
                ))}
              </Stack>
            )}
          </div>
        </Grid.Col>
      </Grid>

      {/* Unified Student Search & Direct Manual Check-In Modal */}
      <StudentSearchModal
        opened={searchModalOpen}
        onClose={() => {
          setSearchModalOpen(false);
          setOverrideSessionId(null);
        }}
        sessionId={overrideSessionId}
        activeSessions={sessions}
        attendees={attendees}
        onSuccess={() => {
          execute();
        }}
      />

      {/* Camera Test Modal */}
      <Modal
        opened={cameraModalOpen}
        onClose={closeCameraTest}
        title="Camera Test"
        centered
        radius="lg"
      >
        <Box ta="center">
          <video
            ref={videoTestRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "220px",
              borderRadius: "12px",
              background: "#000",
              objectFit: "cover",
            }}
          />
          <Group justify="center" mt="md">
            {cameraStatus === "testing" && (
              <Badge color="yellow" variant="light">
                Testing video feed...
              </Badge>
            )}
            {cameraStatus === "success" && (
              <Badge color="teal" variant="light" leftSection={<IconCheck size={12} />}>
                Camera is working
              </Badge>
            )}
            {cameraStatus === "failed" && (
              <Badge color="red" variant="light">
                Camera access denied or unavailable
              </Badge>
            )}
          </Group>
          <Button fullWidth mt="lg" className="marshal-action-btn-secondary" onClick={closeCameraTest}>
            Close Test
          </Button>
        </Box>
      </Modal>
    </Container>
  );
}
