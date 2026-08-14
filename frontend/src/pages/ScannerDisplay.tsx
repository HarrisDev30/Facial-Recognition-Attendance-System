import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Title,
  Text,
  Paper,
  Group,
  Badge,
  Button,
  LoadingOverlay,
  Alert,
  Stack,
  ActionIcon,
  SimpleGrid,
  Collapse,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconPlayerPlay,
  IconPlayerStop,
  IconUserPlus,
  IconQrcode,
  IconWifi,
  IconWifiOff,
  IconAlertCircle,
  IconTrash,
} from "@tabler/icons-react";
import { getSession, activateSession, deactivateSession } from "../api/sessions";
import { getLiveStats } from "../api/scanner";
import { useWebSocket } from "../hooks";
import MarshalOverride from "../components/MarshalOverride";
import VerificationBadge from "../components/shared/VerificationBadge";
import type { SessionResponse } from "../types/session";
import type { LiveStats, WSMessage } from "../types/scanner";
import { useAuthStore } from "../store/authStore";
import { formatTime } from "../utils/formatters";
import { getApiError } from "../utils/error";

export default function ScannerDisplay() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [identified, setIdentified] = useState<WSMessage[]>([]);
  const [marshalOpen, { open: openMarshal, close: closeMarshal }] = useDisclosure(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [errorLogOpen, { toggle: toggleErrorLog }] = useDisclosure(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    connectionStatus: wsStatus,
    fps,
    errorLog,
    pushError,
    clearErrors,
  } = useWebSocket(sessionId ?? "", {
    onMessage: (msg: WSMessage) => {
      if (msg.event === "attendee_identified") {
        setIdentified((prev) => [msg, ...prev].slice(0, 50));
        setStats((prev) =>
          prev
            ? {
                ...prev,
                total_checked_in: prev.total_checked_in + 1,
                check_in_rate:
                  prev.total_registered > 0
                    ? Math.round(
                        ((prev.total_checked_in + 1) / prev.total_registered) * 100 * 10,
                      ) / 10
                    : 0,
                recent_check_ins: [
                  {
                    attendee_name: msg.attendee_name || "",
                    timestamp: msg.timestamp || new Date().toISOString(),
                    method: msg.verification_method || "face_recognition",
                  },
                  ...prev.recent_check_ins,
                ].slice(0, 10),
              }
            : prev,
        );
      }
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const [s, st] = await Promise.all([
          getSession(sessionId),
          getLiveStats(sessionId),
        ]);
        setSession(s);
        setStats(st);
        if (s.activated_at) {
          const started = new Date(s.activated_at).getTime();
          timerRef.current = setInterval(() => {
            const diff = Date.now() - started;
            const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
            const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
            const s_sec = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
            setElapsed(`${h}:${m}:${s_sec}`);
          }, 1000);
        }
      } catch (err) {
        setError(getApiError(err) || "Failed to load session");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId]);



  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const handleActivateSession = async () => {
    if (!sessionId) return;
    try {
      const updated = await activateSession(sessionId);
      setSession(updated);
      if (updated.activated_at) {
        const started = new Date(updated.activated_at).getTime();
        timerRef.current = setInterval(() => {
          const diff = Date.now() - started;
          const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
          const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
          const s_sec = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
          setElapsed(`${h}:${m}:${s_sec}`);
        }, 1000);
      }
    } catch (err) {
      const msg = getApiError(err) || "Failed to activate session";
      setError(msg);
      pushError(msg);
    }
  };

  const handleDeactivateSession = async () => {
    if (!sessionId) return;
    try {
      const updated = await deactivateSession(sessionId);
      setSession(updated);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) {
      const msg = getApiError(err) || "Failed to deactivate session";
      setError(msg);
      pushError(msg);
    }
  };

  if (loading) return <LoadingOverlay visible />;

  if (!session) {
    return (
      <div style={{ padding: "32px 24px" }}>
        <Alert color="red">{error || "Session not found"}</Alert>
        <Button
          mt="md"
          onClick={() => {
            const target = useAuthStore.getState().user?.role === "marshal"
              ? "/marshal/dashboard"
              : "/admin";
            navigate(target);
          }}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: fullscreen ? "8px 16px 80px" : "24px 16px 80px",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <Paper p="md" radius="md" mb="md">
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="subtle"
              onClick={() => {
                const target = useAuthStore.getState().user?.role === "marshal"
                  ? "/marshal/dashboard"
                  : "/admin";
                navigate(target);
              }}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={fullscreen ? 3 : 2}>
                {session.name}
              </Title>
              <Text size="sm" c="dimmed">
                {session.status === "active" ? (
                  <Badge color="green" size="sm">Active</Badge>
                ) : session.status === "completed" ? (
                  <Badge color="gray" size="sm">Completed</Badge>
                ) : (
                  <Badge color="yellow" size="sm">Pending</Badge>
                )}
                {" \u00B7 "}Elapsed: {elapsed}
              </Text>
            </div>
          </Group>

          <Group>
            <Group gap="xs">
              {/* Connection status */}
              {wsStatus === "connected" ? (
                <IconWifi size={20} color="green" />
              ) : wsStatus === "connecting" ? (
                <IconWifi size={20} color="orange" />
              ) : (
                <IconWifiOff size={20} color="red" />
              )}
              <Text size="xs" c="dimmed">
                {wsStatus === "connected" ? "WebSocket" : "Offline"}
              </Text>
              {wsStatus === "connected" && (
                <Badge size="sm" variant="light" color="gray">
                  {fps} FPS
                </Badge>
              )}
            </Group>

            <ActionIcon onClick={toggleFullscreen}>
              {fullscreen ? (
                <IconArrowsMinimize size={18} />
              ) : (
                <IconArrowsMaximize size={18} />
              )}
            </ActionIcon>
          </Group>
        </Group>

        {/* Stats row */}
        {stats && (
          <SimpleGrid cols={{ base: 2, md: 5 }} mt="md">
            <Paper p="sm">
              <Text size="xs" c="dimmed">Checked In</Text>
              <Text size={fullscreen ? "xl" : "lg"} fw={700}>
                {stats.total_checked_in}
              </Text>
            </Paper>
            <Paper p="sm">
              <Text size="xs" c="dimmed">Registered</Text>
              <Text size={fullscreen ? "xl" : "lg"} fw={700}>
                {stats.total_registered}
              </Text>
            </Paper>
            <Paper p="sm">
              <Text size="xs" c="dimmed">Check-in Rate</Text>
              <Text
                size={fullscreen ? "xl" : "lg"}
                fw={700}
                c={stats.check_in_rate >= 75 ? "teal" : "orange"}
              >
                {stats.check_in_rate}%
              </Text>
            </Paper>
            <Paper p="sm">
              <Text size="xs" c="dimmed">Threshold</Text>
              <Text size={fullscreen ? "xl" : "lg"} fw={700}>
                {Math.round(session.confidence_threshold * 100)}%
              </Text>
            </Paper>
            <Paper p="sm">
              <Text size="xs" c="dimmed">Camera</Text>
              <Group gap="xs" mt={4}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: wsStatus === "connected" ? "var(--mantine-color-green-6)" : "var(--mantine-color-red-6)",
                  }}
                />
                <Text size={fullscreen ? "xl" : "lg"} fw={700}>
                  {wsStatus === "connected" ? "Connected" : "Disconnected"}
                </Text>
              </Group>
            </Paper>
          </SimpleGrid>
        )}
      </Paper>

      {error && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main area: identified students */}
      <Paper p="md" radius="md" mb="md" style={{ minHeight: 300 }}>
        <Title order={4} mb="md">Recent Identifications</Title>
        {identified.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size={fullscreen ? "lg" : "md"}>
            Waiting for students...
          </Text>
        ) : (
          <Stack>
            {identified.slice(0, fullscreen ? 10 : 5).map((item, idx) => (
              <Paper
                key={`${item.timestamp}-${idx}`}
                p={fullscreen ? "lg" : "md"}
                radius="md"
                style={{
                  animation: idx === 0 ? "fadeIn 0.5s ease-in" : undefined,
                  borderLeft: idx === 0 ? "4px solid var(--mantine-color-teal-6)" : undefined,
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text
                      size={fullscreen ? "48px" : "24px"}
                      fw={700}
                      style={{ lineHeight: 1.2 }}
                    >
                      {item.attendee_name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {item.timestamp
                        ? formatTime(item.timestamp)
                        : "Just now"}
                    </Text>
                  </div>
                  <VerificationBadge method={item.verification_method || "face_recognition"} size="lg" />
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Bottom controls */}
      <Paper p="md" radius="md">
        <Group justify="space-between">
          <Group>
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={openMarshal}
            >
              Manual Override
            </Button>
            <Button
              leftSection={<IconQrcode size={16} />}
              onClick={() => navigate(`/scanner/qr-checkin/${sessionId}`)}
            >
              QR Check-in
            </Button>
          </Group>

          {isAdmin && (
            <Group>
              {session.status === "pending" && (
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  color="green"
                  onClick={handleActivateSession}
                >
                  Activate Session
                </Button>
              )}
              {session.status === "active" && (
                <>
                  <Button
                    leftSection={<IconPlayerStop size={16} />}
                    color="red"
                    onClick={handleDeactivateSession}
                  >
                    End Session
                  </Button>
                </>
              )}
            </Group>
          )}
        </Group>
      </Paper>

      <Paper p="md" radius="md" mt="md">
        <Group justify="space-between" mb={errorLogOpen ? "sm" : 0}>
          <Group
            gap="xs"
            style={{ cursor: "pointer" }}
            onClick={toggleErrorLog}
          >
            <IconAlertCircle size={18} />
            <Text fw={500}>Error Log</Text>
            {errorLog.length > 0 && (
              <Badge size="sm" color="red" variant="light">
                {errorLog.length}
              </Badge>
            )}
          </Group>
          {errorLog.length > 0 && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={clearErrors}
            >
              Clear
            </Button>
          )}
        </Group>
        <Collapse in={errorLogOpen}>
          {errorLog.length === 0 ? (
            <Text size="sm" c="dimmed" py="xs">
              No errors recorded.
            </Text>
          ) : (
            <Stack gap="xs">
              {errorLog.map((entry, idx) => (
                <Text key={idx} size="xs" c="dimmed" ff="monospace">
                  {entry}
                </Text>
              ))}
            </Stack>
          )}
        </Collapse>
      </Paper>

      <MarshalOverride
        opened={marshalOpen}
        onClose={closeMarshal}
        sessionId={sessionId || ""}
      />

    </div>
  );
}
