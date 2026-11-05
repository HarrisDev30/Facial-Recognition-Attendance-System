import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Text,
  Badge,
  Button,
  LoadingOverlay,
  Alert,
  Stack,
  ActionIcon,
  Select,
  Tooltip,
  Collapse,
  Group,
  ThemeIcon,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconPlayerPlay,
  IconPlayerStop,
  IconWifi,
  IconWifiOff,
  IconAlertCircle,
  IconTrash,
  IconCamera,
  IconCameraOff,
  IconVideo,
  IconUsers,
  IconRefresh,
  IconRepeat,
  IconCheck,
  IconDeviceMobile,
} from "@tabler/icons-react";
import { getSession, activateSession, deactivateSession } from "../../api/sessions";
import { getLiveStats, processFrame } from "../../api/scanner";
import { getAttendees, type AttendeeResponse } from "../../api/attendees";
import { useCamera } from "../../hooks/useCamera";
import { useCameraDevices } from "../../hooks/useCameraDevices";
import { useWebSocket } from "../../hooks";
import StudentSearchModal from "../../components/marshal/StudentSearchModal";
import VerificationBadge from "../../components/shared/VerificationBadge";
import { playSuccessFeedback } from "../../utils/scannerFeedback";
import type { SessionResponse } from "../../types/session";
import type { FrameProcessResponse, LiveStats, WSMessage } from "../../types/scanner";
import { useAuthStore } from "../../store/authStore";
import { formatTime } from "../../utils/formatters";
import { getApiError } from "../../utils/error";
import "./ScannerDisplay.css";

export default function ScannerDisplay() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [attendees, setAttendees] = useState<AttendeeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [identified, setIdentified] = useState<WSMessage[]>([]);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [errorLogOpen, { toggle: toggleErrorLog }] = useDisclosure(false);
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [isMatchPulse, setIsMatchPulse] = useState(false);
  const [latestVerified, setLatestVerified] = useState<{
    name: string;
    time: string;
    method?: string;
  } | null>(null);
  const [alreadyCheckedInNotice, setAlreadyCheckedInNotice] = useState<{
    name: string;
    time: string;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanningRef = useRef(false);
  const alreadyCheckedInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifiedIdsRef = useRef<Set<string>>(new Set());

  // ─── Camera Devices & External USB Camera Selection ───
  const { devices, refresh: refreshDevices } = useCameraDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem("scanner_selected_device_id") || "";
  });

  // Select first device if nothing stored
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      const firstId = devices[0].deviceId;
      setSelectedDeviceId(firstId);
      localStorage.setItem("scanner_selected_device_id", firstId);
    }
  }, [devices, selectedDeviceId]);

  const {
    videoRef,
    cameraActive,
    error: cameraError,
    startCamera,
    stopCamera,
    captureBlob,
  } = useCamera({ deviceId: selectedDeviceId || undefined });

  // Handle switching cameras dynamically
  const handleDeviceChange = async (newDeviceId: string | null) => {
    if (!newDeviceId) return;
    setSelectedDeviceId(newDeviceId);
    localStorage.setItem("scanner_selected_device_id", newDeviceId);
    if (cameraActive) {
      await startCamera(newDeviceId);
    }
  };

  const handleAttendeeVerified = useCallback(
    (name: string, method: string = "face_recognition", timestamp?: string, attendeeId?: string) => {
      const key = attendeeId || name;
      if (verifiedIdsRef.current.has(key)) {
        return;
      }
      verifiedIdsRef.current.add(key);
      if (name) verifiedIdsRef.current.add(name);
      if (attendeeId) verifiedIdsRef.current.add(attendeeId);

      const timeStr = timestamp ? formatTime(timestamp) : new Date().toLocaleTimeString();
      setLatestVerified({ name, time: timeStr, method });
      setIsMatchPulse(true);
      playSuccessFeedback();

      setTimeout(() => {
        setIsMatchPulse(false);
      }, 600);

      setTimeout(() => {
        setLatestVerified((curr) => (curr?.name === name ? null : curr));
      }, 4000);

      setIdentified((prev) => {
        const isDuplicate = prev.some(
          (item) =>
            (attendeeId && item.attendee_id === attendeeId) ||
            (!attendeeId && item.attendee_name === name) ||
            item.attendee_name === name,
        );
        if (isDuplicate) return prev;
        return [
          {
            event: "attendee_identified",
            attendee_id: attendeeId,
            attendee_name: name,
            timestamp: timestamp || new Date().toISOString(),
            verification_method: method,
          },
          ...prev,
        ].slice(0, 40);
      });

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
                attendee_name: name,
                timestamp: timestamp || new Date().toISOString(),
                method,
              },
              ...prev.recent_check_ins.filter((rc) => rc.attendee_name !== name),
            ].slice(0, 15),
          }
          : prev,
      );
    },
    [],
  );

  // ─── WebSocket Live Stream ───
  const {
    connectionStatus: wsStatus,
    fps,
    errorLog,
    pushError,
    clearErrors,
  } = useWebSocket(sessionId ?? "", {
    onMessage: (msg: WSMessage) => {
      if (msg.event === "attendee_identified") {
        handleAttendeeVerified(
          msg.attendee_name || "Student",
          msg.verification_method || "face_recognition",
          msg.timestamp,
          msg.attendee_id,
        );
      }
    },
  });

  // ─── Initial Session Data & Attendees ───
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const [s, st, atts] = await Promise.all([
          getSession(sessionId),
          getLiveStats(sessionId),
          getAttendees().catch(() => []),
        ]);
        setSession(s);
        setStats(st);
        setAttendees(atts);
        if (st?.recent_check_ins) {
          st.recent_check_ins.forEach((rc) => {
            if (rc.attendee_name) {
              verifiedIdsRef.current.add(rc.attendee_name);
            }
          });
        }

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
      if (alreadyCheckedInTimerRef.current) clearTimeout(alreadyCheckedInTimerRef.current);
    };
  }, [sessionId]);

  // ─── Continuous Optical Scanning Frame Loop ───
  useEffect(() => {
    if (!continuousMode || !cameraActive || !sessionId) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    scanIntervalRef.current = setInterval(async () => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      try {
        const blob = await captureBlob("image/jpeg", 0.85);
        if (!blob) return;

        const res: FrameProcessResponse = await processFrame(sessionId, blob);

        // Option B: Ephemeral badge for already checked in students
        const alreadyIn = (res.identifications || []).find(
          (fi) => fi.already_checked_in && fi.attendee_name,
        );
        if (alreadyIn && alreadyIn.attendee_name) {
          const timeStr = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          setAlreadyCheckedInNotice({
            name: alreadyIn.attendee_name,
            time: timeStr,
          });
          if (alreadyCheckedInTimerRef.current) {
            clearTimeout(alreadyCheckedInTimerRef.current);
          }
          alreadyCheckedInTimerRef.current = setTimeout(() => {
            setAlreadyCheckedInNotice(null);
          }, 2500);
        }

        const matched = (res.identifications || []).filter(
          (fi) => fi.attendee_name && !fi.already_checked_in,
        );

        if (matched.length > 0) {
          matched.forEach((fi) => {
            handleAttendeeVerified(
              fi.attendee_name || "Student",
              "face_recognition",
              new Date().toISOString(),
              fi.attendee_id,
            );
          });
        }
      } catch {
        // Silently skip failed frames to prevent loop disruption
      } finally {
        scanningRef.current = false;
      }
    }, 800);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [continuousMode, cameraActive, sessionId, captureBlob, handleAttendeeVerified]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
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

  const isMobileScreen = useMediaQuery("(max-width: 768px)");

  if (loading) return <LoadingOverlay visible />;

  if (!session) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 600, margin: "0 auto" }}>
        <Alert color="red">{error || "Session not found"}</Alert>
        <Button
          mt="md"
          variant="default"
          onClick={() => {
            const target =
              useAuthStore.getState().user?.role === "marshal"
                ? "/marshal/dashboard"
                : "/admin";
            navigate(target);
          }}
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  if (isMobileScreen) {
    return (
      <div className="kiosk-mobile-guard">
        <ThemeIcon size={64} radius="xl" color="teal" variant="light">
          <IconDeviceMobile size={32} />
        </ThemeIcon>
        <div style={{ maxWidth: 360 }}>
          <h2 className="kiosk-guard-title">Workstation Kiosk Mode</h2>
          <p className="kiosk-guard-desc">
            Station Kiosk Mode is designed for laptops and large station displays. For scanning on your phone or mobile device, please switch to Mobile Scanner Mode.
          </p>
        </div>
        <Stack gap="xs" style={{ width: "100%", maxWidth: 300 }}>
          <Button
            size="md"
            radius="md"
            color="teal"
            leftSection={<IconDeviceMobile size={18} />}
            onClick={() => navigate(`/marshal/scanner/mobile/${sessionId}`)}
          >
            Switch to Mobile Scanner
          </Button>
          <Button
            size="sm"
            radius="md"
            variant="subtle"
            color="gray"
            onClick={() => {
              const target =
                useAuthStore.getState().user?.role === "marshal"
                  ? "/marshal/dashboard"
                  : "/admin";
              navigate(target);
            }}
          >
            Return to Dashboard
          </Button>
        </Stack>
      </div>
    );
  }

  const cameraDeviceOptions = devices.map((d) => ({
    value: d.deviceId,
    label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
  }));

  return (
    <div className={`kiosk-viewport ${fullscreen ? "is-fullscreen" : ""}`}>
      {/* ─── 1. Header Navigation & Live HUD ─── */}
      <header className="kiosk-header">
        <div className="kiosk-header-left">
          <ActionIcon
            className="kiosk-back-btn"
            variant="subtle"
            color="gray"
            size="lg"
            onClick={() => {
              const target =
                useAuthStore.getState().user?.role === "marshal"
                  ? "/marshal/dashboard"
                  : "/admin";
              navigate(target);
            }}
            title="Return to Dashboard"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>

          <div>
            <h1 className="kiosk-title">
              {session.name}
              {session.status === "active" ? (
                <Badge color="teal" size="sm" variant="light">
                  Active
                </Badge>
              ) : session.status === "completed" ? (
                <Badge color="gray" size="sm" variant="outline">
                  Completed
                </Badge>
              ) : (
                <Badge color="yellow" size="sm" variant="light">
                  Pending
                </Badge>
              )}
            </h1>
          </div>
        </div>

        <div className="kiosk-header-right">
          <span className="kiosk-timer-badge">
            Elapsed: {elapsed}
          </span>

          <Group gap={8}>
            {wsStatus === "connected" ? (
              <IconWifi size={18} color="var(--kiosk-brand, #10b981)" />
            ) : wsStatus === "connecting" ? (
              <IconWifi size={18} color="#f59e0b" />
            ) : (
              <IconWifiOff size={18} color="#ef4444" />
            )}
            <span className="kiosk-fps-pill">
              {wsStatus === "connected" ? `${fps || 60} FPS` : "Offline"}
            </span>
          </Group>

          <ActionIcon
            variant="default"
            size="lg"
            radius="md"
            onClick={toggleFullscreen}
            title={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {fullscreen ? <IconArrowsMinimize size={18} /> : <IconArrowsMaximize size={18} />}
          </ActionIcon>
        </div>
      </header>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {cameraError && (
        <Alert color="orange" title="Camera Notice">
          {cameraError}
        </Alert>
      )}

      {/* ─── 2. Main Dual-Panel Viewport ─── */}
      <div className="kiosk-grid">
        {/* Left Hero: Optical Viewfinder */}
        <div className={`kiosk-camera-card ${isMatchPulse ? "has-match" : ""}`}>
          <div className="kiosk-viewfinder-frame">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="kiosk-video"
              style={{ display: cameraActive ? "block" : "none" }}
            />

            {!cameraActive && (
              <div className="kiosk-camera-placeholder">
                <IconCameraOff size={48} stroke={1.5} />
                <div>
                  <Text fw={600} size="md" c="var(--kiosk-text)">
                    Camera feed is inactive
                  </Text>
                  <Text size="xs" c="var(--kiosk-text-dimmed)" mt={4}>
                    Select your preferred video input device below and start scanning.
                  </Text>
                </div>
                <Button
                  size="sm"
                  variant="filled"
                  color="teal"
                  leftSection={<IconCamera size={16} />}
                  onClick={() => startCamera(selectedDeviceId)}
                >
                  Start Video Stream
                </Button>
              </div>
            )}

            {/* Viewfinder Reticle Corners */}
            {cameraActive && (
              <>
                <div className="kiosk-reticle-corner kiosk-reticle-tl" />
                <div className="kiosk-reticle-corner kiosk-reticle-tr" />
                <div className="kiosk-reticle-corner kiosk-reticle-bl" />
                <div className="kiosk-reticle-corner kiosk-reticle-br" />
              </>
            )}

            {/* Option B: Ephemeral Already Checked In Pill */}
            {alreadyCheckedInNotice && (
              <div className="kiosk-already-checked-in-pill">
                ⚡ {alreadyCheckedInNotice.name} — Already Checked In
              </div>
            )}

            {/* Instant Verified Pop-Up Banner */}
            {latestVerified && (
              <div className="kiosk-match-overlay">
                <Group gap="sm">
                  <Badge color="teal" variant="filled" size="lg" circle>
                    <IconCheck size={16} />
                  </Badge>
                  <div>
                    <div className="kiosk-match-name">{latestVerified.name}</div>
                    <div className="kiosk-match-meta">
                      Verified at {latestVerified.time}
                    </div>
                  </div>
                </Group>
                <VerificationBadge method={latestVerified.method || "face_recognition"} size="sm" />
              </div>
            )}
          </div>

          {/* Camera Controls & External USB Camera Selector */}
          <div className="kiosk-camera-controls">
            <Select
              className="kiosk-device-select"
              size="sm"
              radius="md"
              leftSection={<IconVideo size={16} />}
              leftSectionPointerEvents="none"
              placeholder="Select camera device"
              data={cameraDeviceOptions}
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              comboboxProps={{ withinPortal: true, zIndex: 1000 }}
              rightSection={
                <Tooltip label="Refresh device list">
                  <ActionIcon variant="subtle" size="sm" onClick={refreshDevices} aria-label="Refresh camera list">
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Tooltip>
              }
            />

            <Group gap="xs">
              <Button
                size="sm"
                radius="md"
                variant={continuousMode ? "light" : "default"}
                color={continuousMode ? "teal" : "gray"}
                leftSection={<IconRepeat size={16} />}
                onClick={() => setContinuousMode((v) => !v)}
                disabled={!cameraActive}
              >
                Auto-Scan {continuousMode ? "On" : "Off"}
              </Button>

              {cameraActive ? (
                <Button
                  size="sm"
                  radius="md"
                  variant="light"
                  color="red"
                  leftSection={<IconCameraOff size={16} />}
                  onClick={stopCamera}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  radius="md"
                  variant="filled"
                  color="teal"
                  leftSection={<IconCamera size={16} />}
                  onClick={() => startCamera(selectedDeviceId)}
                >
                  Start
                </Button>
              )}
            </Group>
          </div>
        </div>

        {/* Right Sidebar: Telemetry & Live Stream Feed */}
        <div className="kiosk-sidebar-card">
          {/* Key Metrics */}
          {stats && (
            <div className="kiosk-metrics-row">
              <div className="kiosk-metric-card">
                <div className="kiosk-metric-value">{stats.total_checked_in}</div>
                <div className="kiosk-metric-label">Checked In</div>
              </div>
              <div className="kiosk-metric-card">
                <div className="kiosk-metric-value">{stats.total_registered}</div>
                <div className="kiosk-metric-label">Registered</div>
              </div>
              <div className="kiosk-metric-card">
                <div
                  className="kiosk-metric-value"
                  style={{
                    color:
                      stats.check_in_rate >= 75
                        ? "var(--kiosk-brand, #10b981)"
                        : "#f97316",
                  }}
                >
                  {stats.check_in_rate}%
                </div>
                <div className="kiosk-metric-label">Clearance</div>
              </div>
            </div>
          )}

          {/* Real-Time Live Feed */}
          <div className="kiosk-feed-wrap">
            <div className="kiosk-feed-header">
              <span className="kiosk-feed-title">Recent Activity</span>
              <Badge size="xs" variant="light" color="gray">
                {identified.length} Total
              </Badge>
            </div>

            <div className="kiosk-feed-list">
              {identified.length === 0 ? (
                <Text size="sm" c="var(--kiosk-text-dimmed)" ta="center" py="xl">
                  Waiting for attendee check-ins...
                </Text>
              ) : (
                identified.slice(0, fullscreen ? 15 : 8).map((item, idx) => {
                  const initial = item.attendee_name?.[0]?.toUpperCase() || "S";
                  return (
                    <div
                      key={`${item.attendee_id || item.attendee_name || item.timestamp}-${idx}`}
                      className={`kiosk-feed-item ${idx === 0 ? "is-first" : ""}`}
                    >
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                        <div className="kiosk-feed-avatar">{initial}</div>
                        <div style={{ minWidth: 0 }}>
                          <Text className="kiosk-feed-student-name" truncate>
                            {item.attendee_name}
                          </Text>
                          <Text className="kiosk-feed-time">
                            {item.timestamp ? formatTime(item.timestamp) : "Just now"}
                          </Text>
                        </div>
                      </Group>
                      <VerificationBadge
                        method={item.verification_method || "face_recognition"}
                        size="sm"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. Bottom Operations & Manual Check-In Bar ─── */}
      <footer className="kiosk-actions-bar">
        <Group gap="xs">
          <Button
            className="kiosk-manual-btn"
            size="sm"
            variant="filled"
            color="dark"
            leftSection={<IconUsers size={16} />}
            onClick={() => setStudentsModalOpen(true)}
          >
            Search & Manual Check-In
          </Button>

          <Button
            className={`kiosk-diagnostics-btn ${errorLogOpen ? "is-active" : ""}`}
            size="sm"
            radius="md"
            variant="default"
            leftSection={
              <IconAlertCircle
                size={16}
                color={errorLog.length > 0 ? "#ef4444" : "var(--text-muted, #71717a)"}
              />
            }
            onClick={toggleErrorLog}
          >
            Diagnostics {errorLog.length > 0 ? `(${errorLog.length})` : ""}
          </Button>
        </Group>

        {isAdmin && (
          <Group gap="xs">
            {session.status === "pending" && (
              <Button
                size="sm"
                radius="md"
                color="teal"
                leftSection={<IconPlayerPlay size={16} />}
                onClick={handleActivateSession}
              >
                Activate Session
              </Button>
            )}
            {session.status === "active" && (
              <Button
                size="sm"
                radius="md"
                color="red"
                variant="light"
                leftSection={<IconPlayerStop size={16} />}
                onClick={handleDeactivateSession}
              >
                End Session
              </Button>
            )}
          </Group>
        )}
      </footer>

      {/* ─── 4. Diagnostic Error Log Drawer ─── */}
      <div className="kiosk-log-card">
        <Group justify="space-between" mb={errorLogOpen ? "xs" : 0}>
          <Group
            gap="xs"
            style={{ cursor: "pointer" }}
            onClick={toggleErrorLog}
          >
            <IconAlertCircle size={16} color="var(--text-muted, #71717a)" />
            <Text size="xs" fw={600} c="var(--text-secondary, #a1a1aa)">
              Diagnostics & Incident Logs
            </Text>
            {errorLog.length > 0 && (
              <Badge size="xs" color="red" variant="filled">
                {errorLog.length}
              </Badge>
            )}
          </Group>
          {errorLog.length > 0 && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={12} />}
              onClick={clearErrors}
            >
              Clear
            </Button>
          )}
        </Group>

        <Collapse in={errorLogOpen}>
          {errorLog.length === 0 ? (
            <Text size="xs" c="var(--text-muted, #71717a)" py={4}>
              No errors recorded. All station systems nominal.
            </Text>
          ) : (
            <div className="kiosk-log-list">
              <Stack gap={4}>
                {errorLog.map((entry, idx) => (
                  <Text key={idx} size="11px" c="var(--text-muted, #71717a)" ff="monospace">
                    {entry}
                  </Text>
                ))}
              </Stack>
            </div>
          )}
        </Collapse>
      </div>

      {/* ─── 5. Unified Student Search & Direct Manual Check-In Modal ─── */}
      <StudentSearchModal
        opened={studentsModalOpen}
        onClose={() => setStudentsModalOpen(false)}
        sessionId={sessionId}
        attendees={attendees}
        onSuccess={() => {
          if (sessionId) {
            getLiveStats(sessionId).then(setStats).catch(() => { });
          }
        }}
      />
    </div>
  );
}
