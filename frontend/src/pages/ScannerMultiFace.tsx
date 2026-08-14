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
  SimpleGrid,
  Skeleton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconCamera,
  IconCameraOff,
  IconWifi,
  IconWifiOff,
  IconUserPlus,
  IconQrcode,
} from "@tabler/icons-react";
import { getSession } from "../api/sessions";
import { getLiveStats, processFrame } from "../api/scanner";
import { useAuthStore } from "../store/authStore";
import { useCamera, useWebSocket } from "../hooks";
import MarshalOverride from "../components/MarshalOverride";
import VerificationBadge from "../components/shared/VerificationBadge";
import type { SessionResponse } from "../types/session";
import type { FaceIdentification, FrameProcessResponse, LiveStats, WSMessage } from "../types/scanner";
import { formatTime } from "../utils/formatters";
import { getApiError } from "../utils/error";

const BOX_COLORS = {
  match: "#22c55e",
  noMatch: "#ef4444",
  alreadyIn: "#eab308",
  unknown: "#6b7280",
};

function getFaceColor(fi: FaceIdentification): string {
  if (fi.attendee_name && !fi.already_checked_in) return BOX_COLORS.match;
  if (fi.already_checked_in) return BOX_COLORS.alreadyIn;
  if (fi.message.includes("match") || fi.message.includes("No match")) return BOX_COLORS.noMatch;
  return BOX_COLORS.unknown;
}

function getFaceLabel(fi: FaceIdentification): string {
  if (fi.attendee_name && !fi.already_checked_in) return fi.attendee_name;
  if (fi.already_checked_in) return `${fi.attendee_name} (already in)`;
  if (fi.message.includes("Poor face angle")) return "Turn to face camera";
  return fi.attendee_name || "Unknown";
}

export default function ScannerMultiFace() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identified, setIdentified] = useState<WSMessage[]>([]);
  const [lastResults, setLastResults] = useState<FaceIdentification[]>([]);
  const [marshalOpen, { open: openMarshal, close: closeMarshal }] = useDisclosure(false);
  const [cameraStarted, setCameraStarted] = useState(false);

  const { videoRef, cameraActive, startCamera, stopCamera, captureFrame } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanningRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    connectionStatus: wsStatus,
    fps,
    errorLog,
  } = useWebSocket(sessionId ?? "", {
    onMessage: (msg: WSMessage) => {
      if (msg.event === "attendee_identified") {
        setIdentified((prev) => [msg, ...prev].slice(0, 30));
        setStats((prev) =>
          prev
            ? {
                ...prev,
                total_checked_in: prev.total_checked_in + 1,
                check_in_rate:
                  prev.total_registered > 0
                    ? Math.round(((prev.total_checked_in + 1) / prev.total_registered) * 100 * 10) / 10
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
      } catch (err) {
        setError(getApiError(err) || "Failed to load scanner data");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleStartCamera = async () => {
    setCameraStarted(true);
    await startCamera();
  };

  const processNextFrame = useCallback(async () => {
    if (scanningRef.current || !sessionId) return;
    scanningRef.current = true;
    try {
      const dataUrl = captureFrame();
      if (!dataUrl) {
        scanningRef.current = false;
        return;
      }
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const result: FrameProcessResponse = await processFrame(sessionId, blob);
      setLastResults(result.identifications || []);

      const newCheckins = (result.identifications || []).filter(
        (fi) => fi.attendee_name && !fi.already_checked_in,
      );
      if (newCheckins.length > 0) {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                total_checked_in: prev.total_checked_in + newCheckins.length,
                check_in_rate:
                  prev.total_registered > 0
                    ? Math.round(((prev.total_checked_in + newCheckins.length) / prev.total_registered) * 100 * 10) / 10
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
    } catch {
      /* silent — frame processing errors are transient */
    } finally {
      scanningRef.current = false;
    }
  }, [captureFrame, sessionId]);

  useEffect(() => {
    if (!cameraActive || !sessionId) return;
    let active = true;
    const loop = async () => {
      while (active) {
        await processNextFrame();
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    };
    loop();
    return () => { active = false; };
  }, [cameraActive, sessionId, processNextFrame]);

  const drawBoxes = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || lastResults.length === 0) return;

    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const fi of lastResults) {
      if (!fi.bbox || fi.bbox.length !== 4) continue;
      const [x1, y1, x2, y2] = fi.bbox;
      const color = getFaceColor(fi);
      const label = getFaceLabel(fi);

      const dx = x1 * scaleX;
      const dy = y1 * scaleY;
      const dw = (x2 - x1) * scaleX;
      const dh = (y2 - y1) * scaleY;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(dx, dy, dw, dh);

      const conf = fi.confidence_score ? `${Math.round(fi.confidence_score * 100)}%` : "";
      const boxLabel = `#${fi.index + 1} ${label}`;

      ctx.fillStyle = color;
      const text = conf ? `${boxLabel} ${conf}` : boxLabel;
      const metrics = ctx.measureText(text);
      const textH = 20;
      ctx.fillRect(dx, dy - textH, metrics.width + 10, textH);

      ctx.fillStyle = "#000";
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText(text, dx + 5, dy - 5);
    }
  }, [lastResults, videoRef]);

  useEffect(() => {
    drawBoxes();
  }, [drawBoxes]);

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <Skeleton height={32} width="40%" mb="md" />
        <Skeleton height="60vh" radius="md" />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: "24px" }}>
        <Alert color="red">{error || "Session not found"}</Alert>
        <Button mt="md" variant="default" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", minHeight: "100vh" }}>
      {/* Header */}
      <Paper p="md" radius="md" mb="md">
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" onClick={() => navigate(-1)}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={4}>{session.name}</Title>
              <Group gap="xs" mt={2}>
                {session.status === "active" ? (
                  <Badge color="green" size="sm" leftSection={<span className="pulse-dot" />}>Active</Badge>
                ) : (
                  <Badge color="yellow" size="sm">{session.status}</Badge>
                )}
                <Text size="xs" c="dimmed">·</Text>
                {wsStatus === "connected" ? (
                  <IconWifi size={14} color="green" />
                ) : (
                  <IconWifiOff size={14} color="red" />
                )}
                <Text size="xs" c="dimmed">{fps} FPS</Text>
              </Group>
            </div>
          </Group>
        </Group>
      </Paper>

      {errorLog.length > 0 && (
        <Alert color="orange" mb="md" withCloseButton onClose={() => {}}>
          {errorLog[errorLog.length - 1]}
        </Alert>
      )}

      {error && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main area: camera + stats side by side */}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        {/* Camera panel */}
        <Paper
          p={0}
          radius="md"
          ref={containerRef}
          style={{
            gridColumn: "1 / span 2",
            position: "relative",
            aspectRatio: "16 / 9",
            background: "#000",
            overflow: "hidden",
            minHeight: 300,
          }}
        >
          {cameraActive ? (
            <>
              <video
                ref={videoRef as React.RefObject<HTMLVideoElement>}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <canvas
                ref={canvasRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
              />
              {lastResults.length === 0 && (
                <Text
                  c="dimmed"
                  size="sm"
                  style={{
                    position: "absolute",
                    bottom: 16,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.6)",
                    padding: "4px 12px",
                    borderRadius: 4,
                  }}
                >
                  Waiting for faces...
                </Text>
              )}
            </>
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <IconCameraOff size={48} color="#666" />
              <Text c="dimmed" size="sm">Camera is off</Text>
              <Button
                size="sm"
                leftSection={<IconCamera size={14} />}
                onClick={handleStartCamera}
                loading={cameraStarted && !cameraActive}
              >
                Start Camera
              </Button>
            </div>
          )}
        </Paper>

        {/* Stats panel */}
        <Paper p="md" radius="md">
          <Stack gap="md">
            {/* Live stats */}
            <Text fw={600} size="sm">Live Stats</Text>

            <SimpleGrid cols={2} spacing="xs">
              <Paper p="xs" bg="rgba(34, 197, 94, 0.06)">
                <Text size="xs" c="dimmed">Checked In</Text>
                <Text size="xl" fw={700} c="#22c55e">
                  {stats?.total_checked_in ?? "\u2014"}
                </Text>
              </Paper>
              <Paper p="xs" bg="rgba(59, 130, 246, 0.06)">
                <Text size="xs" c="dimmed">Registered</Text>
                <Text size="xl" fw={700} c="#3b82f6">
                  {stats?.total_registered ?? "\u2014"}
                </Text>
              </Paper>
            </SimpleGrid>

            <Paper p="xs" bg="rgba(168, 85, 247, 0.06)">
              <Text size="xs" c="dimmed">Check-in Rate</Text>
              <Text
                size="xl"
                fw={700}
                c={stats && stats.check_in_rate >= 75 ? "#22c55e" : "#fb923c"}
              >
                {stats ? `${stats.check_in_rate}%` : "\u2014"}
              </Text>
            </Paper>

            <Paper p="xs" bg="rgba(107, 114, 128, 0.06)">
              <Text size="xs" c="dimmed">Faces in Frame</Text>
              <Text size="xl" fw={700} c="#6b7280">
                {lastResults.length}
              </Text>
            </Paper>

            {/* Detections */}
            {lastResults.length > 0 && (
              <>
                <Text fw={600} size="sm" mt="sm">Detections</Text>
                <Stack gap={4}>
                  {lastResults.map((fi) => {
                    const color = getFaceColor(fi);
                    const label = getFaceLabel(fi);
                    const conf = fi.confidence_score
                      ? `${Math.round(fi.confidence_score * 100)}%`
                      : "";
                    return (
                      <Paper key={fi.index} p="xs" radius="sm" withBorder>
                        <Group gap="xs" justify="space-between" wrap="nowrap">
                          <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: color,
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <Text size="sm" fw={500} truncate>
                                #{fi.index + 1} {label}
                              </Text>
                              <Text size="xs" c="dimmed">{fi.message}</Text>
                            </div>
                          </Group>
                          {conf && (
                            <Badge size="sm" color={color === BOX_COLORS.match ? "green" : "gray"} variant="light">
                              {conf}
                            </Badge>
                          )}
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </>
            )}

            {/* Recent Identifications */}
            <Text fw={600} size="sm">Recent Identifications</Text>
            {identified.length === 0 ? (
              <Text c="dimmed" size="xs" ta="center" py="md">
                Waiting for students...
              </Text>
            ) : (
              <Stack gap={4}>
                {identified.slice(0, 8).map((item, idx) => (
                  <Paper key={`${item.timestamp}-${idx}`} p="xs" radius="sm" withBorder>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>{item.attendee_name}</Text>
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
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* Bottom controls bar */}
      <Paper p="md" radius="md" mt="md">
        <Group justify="space-between">
          <Group gap="sm">
            <Button
              size="sm"
              leftSection={<IconUserPlus size={16} />}
              onClick={openMarshal}
            >
              Manual Override
            </Button>
            <Button
              size="sm"
              variant="default"
              leftSection={<IconQrcode size={16} />}
              onClick={() => navigate(`/scanner/qr-checkin/${sessionId}`)}
            >
              ID Entry
            </Button>
          </Group>

          {isAdmin && session.status === "active" && (
            <Button
              size="sm"
              color="red"
              variant="default"
              onClick={() => navigate(-1)}
            >
              End Session
            </Button>
          )}
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
