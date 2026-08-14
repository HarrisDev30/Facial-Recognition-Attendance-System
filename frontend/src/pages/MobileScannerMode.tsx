import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Title,
  Text,
  Paper,
  Group,
  Badge,
  Button,
  Alert,
  Stack,
  ActionIcon,
  Loader,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCamera,
  IconCameraOff,
  IconScan,
  IconRepeat,
  IconCheck,
  IconWifi,
  IconWifiOff,
  IconArrowLeft,
  IconUserPlus,
  IconQrcode,
} from "@tabler/icons-react";
import { getSession } from "../api/sessions";
import { getLiveStats, processFrame } from "../api/scanner";
import { sendHeartbeat } from "../api/devices";
import { useAuthStore } from "../store/authStore";
import { useCamera, useWebSocket } from "../hooks";
import MarshalOverride from "../components/MarshalOverride";
import VerificationBadge from "../components/shared/VerificationBadge";
import type { SessionResponse } from "../types/session";
import type { FaceIdentification, FrameProcessResponse, LiveStats, WSMessage } from "../types/scanner";
import { formatTime } from "../utils/formatters";

export default function MobileScannerMode() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identified, setIdentified] = useState<WSMessage[]>([]);
  const [continuousMode, setContinuousMode] = useState(true);
  const scanningRef = useRef(false);
  const [showScanning, setShowScanning] = useState(false);
  const [lastResults, setLastResults] = useState<FaceIdentification[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [marshalOpen, { open: openMarshal, close: closeMarshal }] = useDisclosure(false);

  const { videoRef, cameraActive, error: cameraError, startCamera, stopCamera, captureFrame } = useCamera();

  const { connectionStatus: wsStatus } = useWebSocket(sessionId ?? "", {
    onMessage: (msg: WSMessage) => {
      if (msg.event === "attendee_identified") {
        setIdentified((prev) => [msg, ...prev].slice(0, 20));
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
    let id = sessionStorage.getItem("scanner_device_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("scanner_device_id", id);
    }
    setDeviceId(id);
  }, []);

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
      } catch {
        setError("Failed to load scanner data");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    if (cameraError) {
      setError(cameraError);
    }
  }, [cameraError]);

  const handleStartCamera = async () => {
    await startCamera();
  };

  const processNextFrame = useCallback(async (sessionId: string) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setShowScanning(true);
    try {
      const dataUrl = captureFrame();
      if (!dataUrl) {
        scanningRef.current = false;
        setShowScanning(false);
        return;
      }
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const result: FrameProcessResponse = await processFrame(sessionId, blob);
      const identifications = result.identifications || [];

      const newCheckins = identifications.filter(
        (fi) => fi.attendee_name && !fi.already_checked_in,
      );
      if (newCheckins.length > 0) {
        const wsMessages: WSMessage[] = newCheckins.map((fi) => ({
          event: "attendee_identified",
          attendee_name: fi.attendee_name,
          timestamp: new Date().toISOString(),
          verification_method: "face_recognition",
        }));
        setIdentified((prev) => [...wsMessages, ...prev].slice(0, 20));
        setStats((prev) =>
          prev
            ? {
                ...prev,
                total_checked_in: prev.total_checked_in + newCheckins.length,
                check_in_rate:
                  prev.total_registered > 0
                    ? Math.round(
                        ((prev.total_checked_in + newCheckins.length) / prev.total_registered) *
                          100 *
                          10,
                      ) / 10
                    : 0,
                recent_check_ins: [
                  ...newCheckins.map((fi) => ({
                    attendee_name: fi.attendee_name || "",
                    timestamp: new Date().toISOString(),
                    method: "face_recognition" as const,
                  })),
                  ...prev.recent_check_ins,
                ].slice(0, 10),
              }
            : prev,
        );
      }
      setLastResults(identifications);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Frame processing failed";
      setError(detail);
    } finally {
      scanningRef.current = false;
      setShowScanning(false);
    }
  }, [captureFrame]);

  useEffect(() => {
    if (!cameraActive || !continuousMode || !sessionId || !videoRef.current) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    const loop = async () => {
      while (active) {
        await processNextFrame(sessionId);
        await new Promise((resolve) => { timeoutId = setTimeout(resolve, 500); });
      }
    };
    loop();
    return () => { active = false; clearTimeout(timeoutId); };
  }, [cameraActive, continuousMode, sessionId, videoRef, processNextFrame]);

  useEffect(() => {
    if (!deviceId) return;
    const interval = setInterval(async () => {
      try {
        await sendHeartbeat(deviceId);
      } catch {
        /* ignore heartbeat errors */
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [deviceId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (loading) {
    return (
      <div style={{ padding: "16px 12px", minHeight: "100vh" }}>
        <Loader size="sm" />
        <Text size="sm" c="dimmed" mt="xs">Loading scanner...</Text>
      </div>
    );
  }

  const statusIcon = (fi: FaceIdentification) => {
    if (fi.attendee_name && !fi.already_checked_in) return { icon: IconCheck, color: "teal", label: "Checked in" };
    if (fi.already_checked_in) return { icon: IconCheck, color: "yellow", label: "Already in" };
    return { icon: IconScan, color: "gray", label: "No match" };
  };

  return (
    <div style={{ padding: "16px 12px 80px", minHeight: "100vh" }}>
      {/* Header */}
      <Paper p="sm" radius="md" mb="sm">
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/marshal/dashboard", { replace: true });
              }
            }}>
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Title order={5}>{session?.name || "Mobile Scanner"}</Title>
          </Group>
          <Group gap="xs">
            {wsStatus === "connected" ? (
              <IconWifi size={16} color="green" />
            ) : wsStatus === "connecting" ? (
              <IconWifi size={16} color="orange" />
            ) : (
              <IconWifiOff size={16} color="red" />
            )}
            {session?.status === "active" ? (
              <Badge color="green" size="sm">Active</Badge>
            ) : session?.status === "completed" ? (
              <Badge color="gray" size="sm">Completed</Badge>
            ) : (
              <Badge color="yellow" size="sm">{session?.status || "Loading"}</Badge>
            )}
          </Group>
        </Group>

        {stats && (
          <Group mt="xs" gap="xs" grow>
            <Paper p="xs">
              <Text size="xs" c="dimmed">Checked In</Text>
              <Text size="md" fw={700}>{stats.total_checked_in}</Text>
            </Paper>
            <Paper p="xs">
              <Text size="xs" c="dimmed">Registered</Text>
              <Text size="md" fw={700}>{stats.total_registered}</Text>
            </Paper>
            <Paper p="xs">
              <Text size="xs" c="dimmed">Rate</Text>
              <Text size="md" fw={700} c={stats.check_in_rate >= 75 ? "teal" : "orange"}>
                {stats.check_in_rate}%
              </Text>
            </Paper>
          </Group>
        )}
      </Paper>

      {error && (
        <Alert color="red" mb="sm" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Camera Preview */}
      <Paper
        radius="md"
        mb="sm"
        style={{
          position: "relative",
          width: "100%",
          height: "50vh",
          background: "#000",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: cameraActive ? "block" : "none",
          }}
        />
        {!cameraActive && (
          <Stack justify="center" align="center" style={{ width: "100%", height: "100%" }}>
            <IconCameraOff size={48} color="#666" />
            <Text c="dimmed" size="sm">Camera is off</Text>
            <Button size="xs" leftSection={<IconCamera size={14} />} onClick={handleStartCamera}>
              Start Camera
            </Button>
          </Stack>
        )}
        {/* Scanning indicator bar */}
        {cameraActive && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: showScanning
                ? "linear-gradient(90deg, transparent, #228be6, transparent)"
                : "rgba(255,255,255,0.15)",
              opacity: showScanning ? 1 : 0.4,
              transition: "opacity 0.2s",
            }}
          />
        )}
        {/* Face count badge */}
        {lastResults.length > 0 && (
          <Badge
            size="sm"
            color="gray"
            style={{ position: "absolute", top: 8, right: 8 }}
          >
            {lastResults.length} face{lastResults.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </Paper>

      {/* Batch results — one row per face in the frame */}
      {lastResults.length > 0 && (
        <Paper p="sm" radius="md" mb="sm">
          <Group justify="space-between" mb={4}>
            <Text size="xs" fw={600} c="dimmed">Frame Detections</Text>
            <Badge size="sm" color="gray">{lastResults.length}</Badge>
          </Group>
          <Stack gap={4}>
            {lastResults.map((fi) => {
              const s = statusIcon(fi);
              return (
                <Group key={`${fi.attendee_id || "unknown"}-${fi.index}`} justify="space-between">
                  <Group gap="xs">
                    <s.icon size={14} color={`var(--mantine-color-${s.color}-6)`} />
                    <div>
                      <Text size="sm" fw={600}>{fi.attendee_name || `Person ${fi.index + 1}`}</Text>
                      <Text size="xs" c="dimmed">{s.label}</Text>
                    </div>
                  </Group>
                  {fi.confidence_score != null && (
                    <Badge color={fi.already_checked_in ? "yellow" : "teal"} size="sm">
                      {Math.round(fi.confidence_score * 100)}%
                    </Badge>
                  )}
                </Group>
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* Scanning status when idle */}
      {cameraActive && lastResults.length === 0 && (
        <Text c="dimmed" ta="center" size="sm" mb="sm">
          {showScanning ? "Scanning..." : "Waiting..."}
        </Text>
      )}

      {/* Recent Identifications */}
      <Paper p="sm" radius="md" mb="md">
        <Group justify="space-between" mb="xs">
          <Title order={6}>Recent Identifications</Title>
          <Badge size="sm" color="gray">{identified.length}</Badge>
        </Group>
        {identified.length === 0 ? (
          <Text c="dimmed" ta="center" py="md" size="sm">
            Waiting for students...
          </Text>
        ) : (
          <Stack gap="xs">
            {identified.slice(0, 10).map((item, idx) => (
              <Paper
                key={`${item.timestamp}-${idx}`}
                p="xs"
                radius="sm"
                style={{
                  animation: idx === 0 ? "fadeIn 0.5s ease-in" : undefined,
                  borderLeft: idx === 0 ? "3px solid var(--mantine-color-teal-6)" : undefined,
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={600}>{item.attendee_name}</Text>
                    <Text size="xs" c="dimmed">
                      {item.timestamp ? formatTime(item.timestamp) : "Just now"}
                    </Text>
                  </div>
                  <VerificationBadge method={item.verification_method || "face_recognition"} size="sm" />
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Fixed Bottom Controls Bar */}
      <Paper
        p="sm"
        radius={0}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          borderBottom: "none",
        }}
      >
        <Group justify="space-around">
          <ActionIcon
            size="lg"
            color={cameraActive ? "red" : "blue"}
            onClick={cameraActive ? stopCamera : handleStartCamera}
          >
            {cameraActive ? <IconCameraOff size={20} /> : <IconCamera size={20} />}
          </ActionIcon>
          <ActionIcon
            size="lg"
            color={continuousMode ? "teal" : "gray"}
            onClick={() => setContinuousMode((v) => !v)}
            disabled={!cameraActive}
          >
            {continuousMode ? <IconRepeat size={20} /> : <IconScan size={20} />}
          </ActionIcon>
          <ActionIcon size="lg" onClick={openMarshal}>
            <IconUserPlus size={20} />
          </ActionIcon>
          <ActionIcon
            size="lg"
            onClick={() => navigate(`/scanner/qr-checkin/${sessionId}`)}
          >
            <IconQrcode size={20} />
          </ActionIcon>
          <ActionIcon size="lg" onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              const target = useAuthStore.getState().user?.role === "marshal"
                ? "/marshal/dashboard"
                : "/admin";
              navigate(target, { replace: true });
            }
          }}>
            <IconArrowLeft size={20} />
          </ActionIcon>
        </Group>
      </Paper>

      <MarshalOverride
        opened={marshalOpen}
        onClose={closeMarshal}
        sessionId={sessionId || ""}
      />

    </div>
  );
}
