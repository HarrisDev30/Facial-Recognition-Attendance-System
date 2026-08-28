import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  Text,
  Badge,
  Button,
  ActionIcon,
  Modal,
  Stack,
  Group,
  Box,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCamera,
  IconCameraOff,
  IconScan,
  IconRepeat,
  IconCheck,
  IconX,
  IconArrowLeft,
  IconUsers,
  IconHistory,
  IconSwitchHorizontal,
  IconQrcode,
  IconUser,
} from "@tabler/icons-react";
import { getSession } from "../../api/sessions";
import { getLiveStats, processFrame, qrCheckIn } from "../../api/scanner";
import { getAttendees, type AttendeeResponse } from "../../api/attendees";
import { sendHeartbeat } from "../../api/devices";
import { useAuthStore } from "../../store/authStore";
import { useCamera, useWebSocket } from "../../hooks";
import StudentSearchModal from "../../components/marshal/StudentSearchModal";
import VerificationBadge from "../../components/shared/VerificationBadge";
import { playSuccessFeedback, playFailedFeedback } from "../../utils/scannerFeedback";
import type { SessionResponse } from "../../types/session";
import type { FaceIdentification, FrameProcessResponse, LiveStats, WSMessage } from "../../types/scanner";
import { formatTime } from "../../utils/formatters";
import "./MobileScannerMode.css";

export default function MobileScannerMode() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Mode: "face" | "qr"
  const isInitialQr = location.pathname.includes("qr-checkin") || searchParams.get("mode") === "qr";
  const [scannerMode, setScannerMode] = useState<"face" | "qr">(isInitialQr ? "qr" : "face");

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [attendees, setAttendees] = useState<AttendeeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [identified, setIdentified] = useState<WSMessage[]>([]);
  const [latestVerified, setLatestVerified] = useState<{ name: string; time: string; method?: string } | null>(null);
  const [continuousMode, setContinuousMode] = useState(true);
  const scanningRef = useRef(false);
  const qrCooldownRef = useRef(false);
  const [showScanning, setShowScanning] = useState(false);
  const [lastResults, setLastResults] = useState<FaceIdentification[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Gate Multi-Sensory & Visual Strobe Feedback
  const [strobeState, setStrobeState] = useState<"success" | "failed" | null>(null);
  const [strobeMessage, setStrobeMessage] = useState<string>("");

  const triggerStrobe = useCallback((type: "success" | "failed", message: string) => {
    setStrobeState(type);
    setStrobeMessage(message);
    if (type === "success") {
      playSuccessFeedback();
    } else {
      playFailedFeedback();
    }
    setTimeout(() => {
      setStrobeState(null);
      setStrobeMessage("");
    }, 600);
  }, []);

  // Modals
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [recentModalOpen, setRecentModalOpen] = useState(false);

  useEffect(() => {
    getAttendees().then(setAttendees).catch(() => {});
  }, []);

  const { videoRef, cameraActive, error: cameraError, startCamera, stopCamera, captureFrame } = useCamera();

  useWebSocket(sessionId ?? "", {
    onMessage: (msg: WSMessage) => {
      if (msg.event === "attendee_identified") {
        setIdentified((prev) => [msg, ...prev].slice(0, 30));
        setLatestVerified({
          name: msg.attendee_name || "Student",
          time: new Date().toLocaleTimeString(),
          method: msg.verification_method || "face_recognition",
        });

        // Trigger Audio Chime + Haptic + Green Gate Strobe Flash
        triggerStrobe("success", msg.attendee_name || "VERIFIED");

        // Auto fade toast after 4s
        setTimeout(() => {
          setLatestVerified((curr) => (curr?.name === msg.attendee_name ? null : curr));
        }, 4000);

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
                ].slice(0, 15),
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

  // ─── Face Processing Loop ───
  const processFaceFrame = useCallback(async (sessId: string) => {
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
      const result: FrameProcessResponse = await processFrame(sessId, blob);
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
        setIdentified((prev) => [...wsMessages, ...prev].slice(0, 30));
        setLatestVerified({
          name: newCheckins[0].attendee_name || "Student",
          time: new Date().toLocaleTimeString(),
          method: "face_recognition",
        });

        // Trigger Audio Chime + Haptic + Green Gate Strobe Flash
        triggerStrobe("success", newCheckins[0].attendee_name || "VERIFIED");

        setTimeout(() => {
          setLatestVerified(null);
        }, 4000);

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
                ].slice(0, 15),
              }
            : prev,
        );
      }
      setLastResults(identifications);
    } catch {
      // Silently continue frame loop
    } finally {
      scanningRef.current = false;
      setShowScanning(false);
    }
  }, [captureFrame, triggerStrobe]);

  // ─── Real-Time QR Detection Loop ───
  const processQRFrame = useCallback(async (sessId: string) => {
    if (scanningRef.current || qrCooldownRef.current || !videoRef.current) return;
    scanningRef.current = true;
    setShowScanning(true);

    try {
      // 1. Check Native Browser BarcodeDetector (Chrome / Android / iOS 17+)
      if ("BarcodeDetector" in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue?.trim();
          if (rawValue) {
            qrCooldownRef.current = true;
            try {
              const res = await qrCheckIn(sessId, rawValue);
              if (res.success) {
                setLatestVerified({
                  name: res.attendee_name || "Student",
                  time: new Date().toLocaleTimeString(),
                  method: "qr_code",
                });
                triggerStrobe("success", res.attendee_name || "PASS");
                notifications.show({
                  title: "QR Pass Verified",
                  message: `Welcome, ${res.attendee_name || "Student"}!`,
                  color: "teal",
                  icon: <IconCheck size={16} />,
                });
              } else {
                triggerStrobe("failed", res.message || "RETRY PASS");
                notifications.show({
                  title: "QR Check-In",
                  message: res.message || "Pass verified",
                  color: "yellow",
                });
              }
            } catch {
              triggerStrobe("failed", "RETRY PASS");
            } finally {
              // 2.5s cooldown before scanning next QR code
              setTimeout(() => {
                qrCooldownRef.current = false;
              }, 2500);
            }
          }
        }
      }
    } catch {
      // Continue QR loop
    } finally {
      scanningRef.current = false;
      setShowScanning(false);
    }
  }, [videoRef, triggerStrobe]);

  // Active continuous loop for Face / QR modes
  useEffect(() => {
    if (!cameraActive || !continuousMode || !sessionId || !videoRef.current) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const loop = async () => {
      while (active) {
        if (scannerMode === "face") {
          await processFaceFrame(sessionId);
          await new Promise((resolve) => { timeoutId = setTimeout(resolve, 450); });
        } else {
          await processQRFrame(sessionId);
          await new Promise((resolve) => { timeoutId = setTimeout(resolve, 200); });
        }
      }
    };
    loop();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [cameraActive, continuousMode, scannerMode, sessionId, videoRef, processFaceFrame, processQRFrame]);

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

  const handleGoBack = () => {
    const isMarshal = useAuthStore.getState().user?.role === "marshal" || useAuthStore.getState().user?.is_marshal;
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isMarshal ? "/marshal/dashboard" : "/admin", { replace: true });
    }
  };

  return (
    <div className="mobile-scanner-viewport">
      {/* ─── 1. Edge-to-Edge Fullscreen Camera Feed ─── */}
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        autoPlay
        playsInline
        muted
        className="mobile-scanner-video-feed"
        style={{ display: cameraActive ? "block" : "none" }}
      />

      {/* Visual Gate Strobe Flash (Green Pass / Red Warning) */}
      <div
        className={`mobile-scanner-strobe-overlay ${strobeState === "success" ? "is-success" : strobeState === "failed" ? "is-failed" : ""}`}
      />

      {/* Big Gate Splash Badge (Readable from 3 feet away) */}
      {strobeState && (
        <div className={`mobile-scanner-gate-splash is-${strobeState}`}>
          <div className="gate-splash-badge">
            {strobeState === "success" ? <IconCheck size={24} /> : <IconX size={24} />}
            <span>{strobeState === "success" ? `PASS: ${strobeMessage}` : strobeMessage || "RE-ALIGN"}</span>
          </div>
        </div>
      )}

      {/* Atmospheric Top & Bottom Vignettes */}
      <div className="mobile-scanner-vignette-top" />
      <div className="mobile-scanner-vignette-bottom" />

      {/* Camera Off Placeholder Screen */}
      {!cameraActive && (
        <div className="mobile-scanner-offline-screen">
          {loading ? (
            <>
              <Loader color="teal" size="lg" />
              <Text fw={600} size="sm" c="#e5e7eb" mt="xs">
                Connecting to Station...
              </Text>
            </>
          ) : (
            <>
              <IconCameraOff size={52} color="#9ca3af" />
              <Text fw={700} size="lg" c="#ffffff">
                Camera is Off
              </Text>
              <Text size="xs" c="#9ca3af" maw={260}>
                Tap below to activate camera and start scanning students.
              </Text>
              <Button
                mt="xs"
                color="teal"
                radius="xl"
                size="md"
                leftSection={<IconCamera size={18} />}
                onClick={handleStartCamera}
              >
                Start Camera
              </Button>
            </>
          )}
        </div>
      )}

      {/* ─── 2. Top Floating Glass HUD ─── */}
      <div className="mobile-scanner-top-hud">
        <div className="mobile-scanner-top-row">
          {/* Back Button */}
          <ActionIcon
            className="mobile-scanner-hud-btn"
            onClick={handleGoBack}
            aria-label="Go Back"
          >
            <IconArrowLeft size={18} />
          </ActionIcon>

          {/* Full Session Name Title */}
          {session?.name && (
            <div className="mobile-scanner-session-pill">
              <span>{session.name}</span>
            </div>
          )}

          {/* Right Live Sync Telemetry Badge */}
          <div className="mobile-scanner-stats-pill">
            <span className="mobile-scanner-live-dot" />
            <span>{stats?.total_checked_in ?? 0} In</span>
          </div>
        </div>

        {/* Floating Quick Action Column: Flip Camera below Stats Pill */}
        <div className="mobile-scanner-floating-tools">
          <ActionIcon
            className="mobile-scanner-hud-btn"
            onClick={async () => {
              await stopCamera();
              await startCamera();
            }}
            aria-label="Flip Camera"
          >
            <IconSwitchHorizontal size={18} />
          </ActionIcon>
        </div>
      </div>

      {/* ─── 3. Verified Student Dropdown Toast Banner ─── */}
      {latestVerified && (
        <div className="mobile-scanner-verified-dropdown">
          <Group gap="xs" style={{ minWidth: 0 }}>
            <ActionIcon size="md" radius="xl" color="teal" variant="filled">
              <IconCheck size={18} />
            </ActionIcon>
            <Box style={{ minWidth: 0 }}>
              <div className="mobile-scanner-verified-name" style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {latestVerified.name}
              </div>
              <div className="mobile-scanner-verified-sub">
                Verified • {latestVerified.time}
              </div>
            </Box>
          </Group>
          <Badge size="sm" color="teal" variant="filled">
            {latestVerified.method === "qr_code" ? "QR Pass" : "Face Scan"}
          </Badge>
        </div>
      )}

      {/* ─── 4. Cyber Targeting Reticle (Face vs QR Pass Mode) ─── */}
      {cameraActive && (
        <div className={`mobile-scanner-reticle-container ${scannerMode === "face" ? "mode-face" : "mode-qr"}`}>
          <div className="mobile-scanner-target-frame">
            <span className="mobile-scanner-bracket top-left" />
            <span className="mobile-scanner-bracket top-right" />
            <span className="mobile-scanner-bracket bottom-left" />
            <span className="mobile-scanner-bracket bottom-right" />

            {/* Continuous Laser Line */}
            {continuousMode && <div className="mobile-scanner-laser" />}
          </div>

          <div className="mobile-scanner-reticle-status">
            {scannerMode === "qr"
              ? "Align Student QR Pass in Frame"
              : showScanning
              ? "Scanning Face..."
              : lastResults.length > 0
              ? `${lastResults.length} Face${lastResults.length > 1 ? "s" : ""} in Frame`
              : "Align Face in Frame"}
          </div>
        </div>
      )}

      {/* ─── 5. Floating Bottom Action Dock ─── */}
      <div className="mobile-scanner-bottom-dock">
        {/* Dual-Mode Lens Switcher Capsule (Positioned above dock for easy thumb reach) */}
        <div className="mobile-scanner-lens-switcher">
          <button
            type="button"
            className={`mobile-scanner-lens-tab ${scannerMode === "face" ? "is-active" : ""}`}
            onClick={() => setScannerMode("face")}
          >
            <IconUser size={14} />
            <span>Face Scan</span>
          </button>
          <button
            type="button"
            className={`mobile-scanner-lens-tab ${scannerMode === "qr" ? "is-active" : ""}`}
            onClick={() => setScannerMode("qr")}
          >
            <IconQrcode size={14} />
            <span>QR Pass</span>
          </button>
        </div>

        {/* Symmetrical 3-Slot Dock Bar */}
        <div className="mobile-scanner-dock-bar">
          {/* Action 1: Unified Search & Manual Check-In */}
          <button
            type="button"
            className="mobile-scanner-dock-btn"
            onClick={() => setStudentsModalOpen(true)}
            aria-label="Search and Manual Check-In"
          >
            <IconUsers size={22} />
            <span className="mobile-scanner-dock-label">Manual</span>
          </button>

          {/* Action 2: Center Giant Shutter / Continuous Scan Toggle */}
          <button
            type="button"
            className={`mobile-scanner-shutter-btn ${!continuousMode ? "paused" : ""}`}
            onClick={() => {
              if (!cameraActive) {
                handleStartCamera();
              } else {
                setContinuousMode((prev) => !prev);
              }
            }}
            aria-label="Toggle Continuous Scan"
          >
            {continuousMode ? <IconRepeat size={26} /> : <IconScan size={26} />}
          </button>

          {/* Action 3: Recent Check-Ins Modal (Centered Pop-Up) */}
          <button
            type="button"
            className="mobile-scanner-dock-btn"
            onClick={() => setRecentModalOpen(true)}
            aria-label="Recent Check-Ins History"
          >
            <IconHistory size={22} />
            <span className="mobile-scanner-dock-label">Recent</span>
          </button>
        </div>
      </div>

      {/* ─── 6. Centered Recent Check-Ins Modal (Zero Dock Obstruction) ─── */}
      <Modal
        opened={recentModalOpen}
        onClose={() => setRecentModalOpen(false)}
        zIndex={2000}
        radius="lg"
        centered
        title={
          <Group gap="xs">
            <IconHistory size={20} color="var(--brand-primary, #10b981)" />
            <Text fw={700} size="md">
              Recent Check-Ins ({identified.length})
            </Text>
          </Group>
        }
      >
        {identified.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            No students checked in yet during this session.
          </Text>
        ) : (
          <Stack gap="xs" style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {identified.map((item, idx) => (
              <div
                key={`${item.timestamp}-${idx}`}
                style={{
                  padding: "10px 14px",
                  background: "var(--surface-0)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <Text size="sm" fw={600} c="var(--text-primary)">
                    {item.attendee_name || "Student"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {item.timestamp ? formatTime(item.timestamp) : "Just now"}
                  </Text>
                </div>
                <VerificationBadge method={item.verification_method || "face_recognition"} size="sm" />
              </div>
            ))}
          </Stack>
        )}
      </Modal>

      {/* ─── 7. Unified Student Search & Direct Manual Check-In Modal ─── */}
      <StudentSearchModal
        opened={studentsModalOpen}
        onClose={() => setStudentsModalOpen(false)}
        sessionId={sessionId}
        attendees={attendees}
        onSuccess={() => {
          if (sessionId) {
            getLiveStats(sessionId).then(setStats).catch(() => {});
          }
        }}
      />
    </div>
  );
}
