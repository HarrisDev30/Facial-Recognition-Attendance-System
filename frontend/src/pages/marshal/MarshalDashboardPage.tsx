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
  SimpleGrid,
  Skeleton,
  Stack,
  ThemeIcon,
  Modal,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
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
import MarshalOverride from "../../components/MarshalOverride";
import { RapidRosterTriageDrawer } from "../../components/marshal/RapidRosterTriageDrawer";
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

  // Role detection
  const isStudentMarshal = Boolean(
    user?.attendee_id ||
      (user?.assigned_org_ids && user.assigned_org_ids.length > 0 && user.role === "student") ||
      (user?.is_marshal && user.role === "student")
  );
  const firstName = user?.first_name || user?.email?.split("@")[0] || "Officer";

  // Data states
  const [attendees, setAttendees] = useState<AttendeeResponse[]>([]);
  const [triageDrawerOpen, setTriageDrawerOpen] = useState(false);
  const [preselectedAttendee, setPreselectedAttendee] = useState<AttendeeResponse | null>(null);
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
  const [marshalOpen, { open: openMarshal, close: closeMarshal }] = useDisclosure(false);

  const openOverride = (sessionId: string, attendee?: AttendeeResponse) => {
    setOverrideSessionId(sessionId);
    setPreselectedAttendee(attendee || null);
    openMarshal();
  };

  const handleTriageSelect = (att: AttendeeResponse) => {
    const defaultSession = sessions[0]?.session_id;
    if (defaultSession) {
      openOverride(defaultSession, att);
    } else {
      setPreselectedAttendee(att);
      openMarshal();
    }
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
      {/* ─── 1. Executive Split Header Card (Student Parity, Zero Gradient Bar) ─── */}
      <div className="marshal-header-card">
        <div className="marshal-avatar-col">
          <div className="marshal-avatar-box">
            <IconScan size={34} stroke={1.75} />
          </div>
        </div>

        <div className="marshal-identity-col">
          <div>
            <h1 className="marshal-greeting-title">
              {greeting(firstName)}
            </h1>
            <span className="marshal-institution-subtext">
              {institution?.name || "Campus Command"} • Gate Biometrics & Verification Console
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
                Staff Field Marshal
              </span>
            )}

            {isOnline ? (
              <span className="marshal-status-pill online">
                <IconWifi size={13} />
                Gate Online
              </span>
            ) : (
              <span className="marshal-status-pill offline">
                <IconWifiOff size={13} />
                Offline Mode Active
              </span>
            )}

            <span className="marshal-chip-tag">
              ID: {user?.id?.slice(0, 8) || "MARSHAL"}
            </span>
          </div>

          <Group gap="xs" mt={4}>
            <Button
              className="marshal-action-btn-secondary"
              size="sm"
              leftSection={<IconUsers size={16} />}
              onClick={() => setTriageDrawerOpen(true)}
            >
              Roster Triage
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
            {pendingQueueCount > 0 && (
              <Button
                size="sm"
                color="orange"
                variant="filled"
                loading={syncing}
                leftSection={<IconCloudUpload size={14} />}
                onClick={handleManualSync}
              >
                Sync {pendingQueueCount} Offline
              </Button>
            )}
          </Group>
        </div>
      </div>

      {/* ─── 2. Metric Bento Grid (Student Parity) ─── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
        <div className="marshal-metric-card">
          <div className="marshal-metric-label">
            <span>Verified Today</span>
            <IconUserCheck size={16} style={{ opacity: 0.6 }} />
          </div>
          <div className="marshal-metric-value" style={{ color: "var(--brand-primary, #10b981)" }}>
            {shiftStats?.total_verified_today ?? 0}
          </div>
          <div className="marshal-metric-subtext">Total verified attendees</div>
        </div>

        <div className="marshal-metric-card">
          <div className="marshal-metric-label">
            <span>Facial Match</span>
            <IconScan size={16} style={{ opacity: 0.6 }} />
          </div>
          <div className="marshal-metric-value" style={{ color: "#3b82f6" }}>
            {shiftStats?.face_count ?? 0}
          </div>
          <div className="marshal-metric-subtext">Instant biometric scans</div>
        </div>

        <div className="marshal-metric-card">
          <div className="marshal-metric-label">
            <span>QR Passes</span>
            <IconQrcode size={16} style={{ opacity: 0.6 }} />
          </div>
          <div className="marshal-metric-value" style={{ color: "#06b6d4" }}>
            {shiftStats?.qr_count ?? 0}
          </div>
          <div className="marshal-metric-subtext">Dynamic encrypted tokens</div>
        </div>

        <div className="marshal-metric-card">
          <div className="marshal-metric-label">
            <span>Manual Overrides</span>
            <IconShieldCheck size={16} style={{ opacity: 0.6 }} />
          </div>
          <div className="marshal-metric-value" style={{ color: "#f59e0b" }}>
            {shiftStats?.override_count ?? 0}
          </div>
          <div className="marshal-metric-subtext">Triage exceptions</div>
        </div>
      </SimpleGrid>

      {/* ─── 3. Main 2-Column Responsive Bento Layout ─── */}
      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing="lg">
        {/* Left Column (8 cols): Active Gate Stations & Upcoming Launchers */}
        <Box style={{ gridColumn: "span 8" }}>
          {/* Active Gate Check-In Stations Card */}
          <div className="marshal-section-card">
            <div className="marshal-section-header">
              <h2 className="marshal-section-title">
                <span className="marshal-live-beacon" />
                Active Gate Check-In Stations
              </h2>
              <Badge color="teal" variant="light" size="sm">
                {sessions.length} Live
              </Badge>
            </div>

            {loading && !data ? (
              <Stack gap="md">
                <Skeleton height={120} radius="md" />
                <Skeleton height={120} radius="md" />
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
                <Text fw={600} size="sm">No Active Gate Sessions Right Now</Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Choose an upcoming event below to launch check-in on demand, or test your station hardware.
                </Text>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.session_id} className="marshal-station-item">
                  <Group justify="space-between" mb="xs">
                    <div>
                      <Text fw={700} size="md" c="var(--text-primary)">
                        {session.session_name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {session.event_name}
                      </Text>
                    </div>
                    <Badge color="teal" variant="light">
                      Live Station
                    </Badge>
                  </Group>

                  <Group gap="md" my="sm">
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

                  <Group justify="space-between" mt="md" wrap="wrap" gap="xs">
                    <Group gap="xs">
                      <Button
                        className="marshal-action-btn-primary"
                        size="xs"
                        leftSection={<IconScan size={14} />}
                        onClick={() => navigate(`/marshal/scanner/${session.session_id}`)}
                      >
                        Kiosk Scanner
                      </Button>
                      <Button
                        className="marshal-action-btn-secondary"
                        size="xs"
                        leftSection={<IconDeviceMobile size={14} />}
                        onClick={() => navigate(`/marshal/scanner/mobile/${session.session_id}`)}
                      >
                        Mobile Triage
                      </Button>
                      <Button
                        className="marshal-action-btn-secondary"
                        size="xs"
                        leftSection={<IconQrcode size={14} />}
                        onClick={() => navigate(`/marshal/scanner/qr/${session.session_id}`)}
                      >
                        QR Pass
                      </Button>
                      <Button
                        className="marshal-action-btn-secondary"
                        size="xs"
                        leftSection={<IconShieldCheck size={14} />}
                        onClick={() => openOverride(session.session_id)}
                      >
                        Quick Override
                      </Button>
                    </Group>

                    <Button
                      className="marshal-action-btn-secondary"
                      size="xs"
                      loading={actionLoadingId === session.session_id}
                      onClick={() => handleExtendSession(session.session_id)}
                    >
                      +15m
                    </Button>
                  </Group>
                </div>
              ))
            )}
          </div>

          {/* Upcoming Department Events & Sessions Card */}
          <div className="marshal-section-card">
            <div className="marshal-section-header">
              <h2 className="marshal-section-title">
                <IconCalendarEvent size={18} color="var(--brand-primary, #10b981)" />
                Upcoming Department Events & Sessions
              </h2>
              <Badge color="blue" variant="light" size="sm">
                {upcomingEvents.length} Scheduled
              </Badge>
            </div>

            {upcomingEvents.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="lg">
                No upcoming events found for your department scope today.
              </Text>
            ) : (
              <Stack gap="sm">
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} className="marshal-station-item">
                    <Group justify="space-between" mb="xs">
                      <div>
                        <Text fw={600} size="sm">
                          {ev.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {ev.organization_name} • {ev.venue || "Campus Main Venue"}
                        </Text>
                      </div>
                      <Badge size="xs" variant="outline" color="blue">
                        {ev.event_type || "Event"}
                      </Badge>
                    </Group>

                    {ev.sessions && ev.sessions.length > 0 ? (
                      <Stack gap={6} mt="xs">
                        {ev.sessions.map((sess) => (
                          <div
                            key={sess.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              background: "var(--surface-1)",
                              borderRadius: "8px",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <Group gap="xs">
                              <Text size="xs" fw={500}>
                                {sess.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                ({formatTime(sess.start_time)} - {formatTime(sess.end_time)})
                              </Text>
                              <Badge
                                size="xs"
                                color={sess.status === "active" ? "teal" : "gray"}
                                variant="light"
                              >
                                {sess.status}
                              </Badge>
                            </Group>

                            {sess.status === "active" ? (
                              <Button
                                className="marshal-action-btn-primary"
                                size="compact-xs"
                                leftSection={<IconScan size={12} />}
                                onClick={() => navigate(`/marshal/scanner/${sess.id}`)}
                              >
                                Open Station
                              </Button>
                            ) : (
                              <Button
                                className="marshal-action-btn-secondary"
                                size="compact-xs"
                                loading={actionLoadingId === sess.id}
                                leftSection={<IconPlayerPlay size={12} />}
                                onClick={() => handleStartSession(sess.id)}
                              >
                                Start Station Now
                              </Button>
                            )}
                          </div>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="xs" c="dimmed">
                        No individual attendance sessions configured yet.
                      </Text>
                    )}
                  </div>
                ))}
              </Stack>
            )}
          </div>
        </Box>

        {/* Right Column (4 cols): Station Hardware Hub & Shift Ledger */}
        <Box style={{ gridColumn: "span 4" }}>
          {/* Station Hardware & Network Hub */}
          <div className="marshal-section-card">
            <div className="marshal-section-header">
              <h2 className="marshal-section-title">
                <IconShieldCheck size={18} color="var(--brand-primary, #10b981)" />
                Station Hardware Hub
              </h2>
            </div>

            <div className="marshal-hardware-row">
              <div>
                <Text size="xs" fw={600}>Biometric Camera</Text>
                <Text size="10px" c="dimmed">Sensor readiness & focus</Text>
              </div>
              <Button
                className="marshal-action-btn-secondary"
                size="compact-xs"
                leftSection={<IconCamera size={12} />}
                onClick={testCamera}
              >
                Test Sensor
              </Button>
            </div>

            <div className="marshal-hardware-row">
              <div>
                <Text size="xs" fw={600}>Gate Network</Text>
                <Text size="10px" c="dimmed">
                  {isOnline ? "Low-latency connection" : "Offline buffer active"}
                </Text>
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

            <div className="marshal-hardware-row">
              <div>
                <Text size="xs" fw={600}>Offline Influx Buffer</Text>
                <Text size="10px" c="dimmed">
                  {pendingQueueCount === 0 ? "All scans synced" : `${pendingQueueCount} buffered scans`}
                </Text>
              </div>
              <Badge size="sm" color={pendingQueueCount > 0 ? "orange" : "gray"} variant="light">
                {pendingQueueCount} queued
              </Badge>
            </div>
          </div>

          {/* Recent Shift Overrides & Activity */}
          <div className="marshal-section-card">
            <div className="marshal-section-header">
              <h2 className="marshal-section-title">
                <IconHistory size={18} color="var(--brand-primary, #10b981)" />
                Shift Overrides Log
              </h2>
              <Badge size="xs" variant="light" color="yellow">
                {overrides.length} Logged
              </Badge>
            </div>

            {overrides.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                No manual overrides logged during this shift.
              </Text>
            ) : (
              <Stack gap="xs">
                {overrides.slice(0, 5).map((ov) => (
                  <div
                    key={ov.id}
                    style={{
                      padding: "10px 12px",
                      background: "var(--surface-0)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <Group justify="space-between" mb={2}>
                      <Text size="xs" fw={600}>
                        {ov.attendee_name || "Student"}
                      </Text>
                      <Badge size="xs" color="yellow" variant="light">
                        {ov.reason || "Override"}
                      </Badge>
                    </Group>
                    <Text size="10px" c="dimmed">
                      {ov.timestamp ? new Date(ov.timestamp).toLocaleTimeString() : "Recent"} • {ov.session_name || "Gate Session"}
                    </Text>
                  </div>
                ))}
              </Stack>
            )}
          </div>
        </Box>
      </SimpleGrid>

      {/* Rapid Roster Triage Drawer */}
      <RapidRosterTriageDrawer
        opened={triageDrawerOpen}
        onClose={() => setTriageDrawerOpen(false)}
        attendees={attendees}
        onSelectAttendee={handleTriageSelect}
      />

      {/* Manual Override Modal */}
      {overrideSessionId && (
        <MarshalOverride
          sessionId={overrideSessionId}
          opened={marshalOpen}
          onClose={closeMarshal}
          onSuccess={() => {
            closeMarshal();
            execute();
          }}
          preselectedAttendee={preselectedAttendee}
        />
      )}

      {/* Camera Readiness Diagnostic Modal */}
      <Modal
        opened={cameraModalOpen}
        onClose={closeCameraTest}
        title="Biometric Camera Sensor Test"
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
                Initializing Video Feed...
              </Badge>
            )}
            {cameraStatus === "success" && (
              <Badge color="teal" variant="light" leftSection={<IconCheck size={12} />}>
                Camera & Lens Operational
              </Badge>
            )}
            {cameraStatus === "failed" && (
              <Badge color="red" variant="light">
                Camera Access Denied or Missing
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
