import { useRef, useState, useEffect, useCallback } from "react";
import { previewFrame } from "../api/registration";
import type { FaceInfo, PreviewResult } from "../api/registration";
import { AppleFaceIDReticle } from "./AppleFaceIDReticle";
import { IconCheck, IconRotateClockwise, IconArrowLeft, IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import "./RegistrationCamera.css";

const PHASES = [
  { key: "frontal", label: "Straight Ahead", instruction: "Look directly into the circle" },
  { key: "left", label: "Turn Left", instruction: "Slowly rotate your head to your left" },
  { key: "right", label: "Turn Right", instruction: "Slowly rotate your head to your right" },
  { key: "tilt_up", label: "Tilt Up", instruction: "Gently tilt your chin upward" },
  { key: "tilt_down", label: "Tilt Down", instruction: "Gently tilt your chin downward" },
  { key: "random", label: "Natural Expression", instruction: "Relax with a comfortable natural expression" },
];

interface Props {
  onCapture: (dataUrl: string, angle: string) => Promise<void>;
  onBack?: () => void;
  onDone?: () => void;
  phases?: typeof PHASES;
}

function dataUrlToFile(dataUrl: string, filename = "frame.jpg"): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

function poseMatchesAngle(face: FaceInfo, angle: string): boolean {
  const yaw = face.pose[1];
  const absYaw = Math.abs(yaw);
  const pitch = face.pose[0];
  switch (angle) {
    case "frontal": return absYaw <= 15 && Math.abs(pitch) <= 15;
    case "left": return yaw > 12 && absYaw <= 55;
    case "right": return yaw < -12 && absYaw <= 55;
    case "tilt_up": return pitch > 6;
    case "tilt_down": return pitch < -6;
    case "random": return true;
    default: return false;
  }
}

function guidanceForPhase(r: PreviewResult | null, phaseKey: string): {
  hint: string;
  state: "ok" | "warn" | "error" | "neutral";
} {
  if (!r) return { hint: "Center your face in the circle", state: "neutral" };
  if (!r.face_detected) return { hint: "Position your face in the frame", state: "error" };
  if (r.face_count > 1) return { hint: "Multiple faces detected — only one allowed", state: "error" };
  const face = r.faces[0];
  if (!face) return { hint: "Center your face in the circle", state: "error" };

  const area = (face.face_width * face.face_height) / (face.img_width * face.img_height);
  if (area < 0.06) return { hint: "Move slightly closer", state: "warn" };
  if (area > 0.45) return { hint: "Move slightly further back", state: "warn" };

  if (!poseMatchesAngle(face, phaseKey)) {
    switch (phaseKey) {
      case "left": return { hint: "Turn your head to the left", state: "warn" };
      case "right": return { hint: "Turn your head to the right", state: "warn" };
      case "tilt_up": return { hint: "Tilt your head upward", state: "warn" };
      case "tilt_down": return { hint: "Tilt your head downward", state: "warn" };
      case "frontal": return { hint: "Look straight at the camera", state: "warn" };
      default: return { hint: "Hold steady...", state: "warn" };
    }
  }
  return { hint: "Perfect! Hold still...", state: "ok" };
}

export default function RegistrationCamera({ onCapture, onBack, onDone, phases }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const uploadingRef = useRef(false);
  const goodFramesRef = useRef(0);

  const activePhases = phases ?? PHASES;

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [flash, setFlash] = useState(false);
  const [capturedThumbnails, setCapturedThumbnails] = useState<Record<string, string>>({});
  const [completedKeys, setCompletedKeys] = useState<string[]>([]);

  const currentPhase = activePhases[currentPhaseIdx];
  const allDone = currentPhaseIdx >= activePhases.length;

  const face = preview?.faces?.[0] ?? null;
  const yaw = face?.pose?.[1] ?? 0;
  const pitch = face?.pose?.[0] ?? 0;
  const guidance = guidanceForPhase(preview, currentPhase?.key ?? "");
  const isGoodPose = guidance.state === "ok";

  const grabFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  const triggerCapture = useCallback(async (dataUrl: string, phaseKey: string) => {
    uploadingRef.current = true;
    setFlash(true);
    setTimeout(() => setFlash(false), 250);

    setCapturedThumbnails((prev) => ({ ...prev, [phaseKey]: dataUrl }));
    setCompletedKeys((prev) => (prev.includes(phaseKey) ? prev : [...prev, phaseKey]));

    try {
      await onCapture(dataUrl, phaseKey);
    } catch (e) {
      console.error("Capture upload failed", e);
    } finally {
      uploadingRef.current = false;
      goodFramesRef.current = 0;
      setCurrentPhaseIdx((prev) => prev + 1);
    }
  }, [onCapture]);

  useEffect(() => {
    if (!cameraReady || allDone) return;

    let isPolling = true;

    async function poll() {
      if (!isPolling || uploadingRef.current) return;

      const frame = grabFrame();
      if (frame) {
        try {
          const fileObj = dataUrlToFile(frame, "frame.jpg");
          const res = await previewFrame(fileObj);
          if (isPolling) {
            setPreview(res);
            const guide = guidanceForPhase(res, currentPhase?.key ?? "");

            if (guide.state === "ok") {
              goodFramesRef.current += 1;
              if (goodFramesRef.current >= 2 && !uploadingRef.current) {
                await triggerCapture(frame, currentPhase.key);
              }
            } else {
              goodFramesRef.current = 0;
            }
          }
        } catch {
          // ignore transient frame preview errors
        }
      }

      if (isPolling) {
        timerRef.current = setTimeout(poll, 200);
      }
    }

    poll();

    return () => {
      isPolling = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cameraReady, allDone, currentPhase, grabFrame, triggerCapture]);

  const handleRetakeAngle = (index: number) => {
    setCurrentPhaseIdx(index);
    const key = activePhases[index].key;
    setCompletedKeys((prev) => prev.filter((k) => k !== key));
    goodFramesRef.current = 0;
  };

  useEffect(() => {
    mountedRef.current = true;
    if (!streamRef.current) startCamera();
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function startCamera() {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch {
      setCameraError(true);
    }
  }

  if (cameraError) {
    return (
      <div className="faceid-root" style={{ justifyContent: "center", alignItems: "center", padding: "2rem" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <IconAlertCircle size={56} color="#ef4444" style={{ marginBottom: "1rem" }} />
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Camera Access Required</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            Please grant camera permissions in your browser settings to complete biometric facial registration.
          </p>
          <button className="faceid-done-btn" onClick={startCamera}>
            <IconRefresh size={16} style={{ marginRight: 6 }} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="faceid-root">
      {flash && <div className="faceid-flash" />}

      {/* Top Navbar */}
      <div className="faceid-topbar">
        {onBack ? (
          <button className="faceid-back-btn" onClick={onBack} title="Back">
            <IconArrowLeft size={20} />
          </button>
        ) : <div />}

        <div className="faceid-status-badge">
          <span>{allDone ? "All Poses Complete" : currentPhase?.label}</span>
        </div>

        <div className="faceid-counter">
          {Math.min(currentPhaseIdx + 1, activePhases.length)} / {activePhases.length}
        </div>
      </div>

      {/* Stage Viewport with Apple Face ID Circular Reticle */}
      <div className="faceid-stage">
        <div className="faceid-reticle-container">
          <AppleFaceIDReticle
            size={360}
            yaw={yaw}
            pitch={pitch}
            completedPhases={completedKeys}
            isGoodPose={isGoodPose}
          />

          <div className="faceid-circle-mask">
            <video
              ref={videoRef}
              playsInline
              muted
              className="faceid-video-feed"
            />
          </div>
        </div>

        {/* Guidance Instruction Pill */}
        <div className={`faceid-instruction-pill ${guidance.state}`}>
          <span>{guidance.hint}</span>
        </div>
      </div>

      {/* Interactive Bottom Tray of 6 Thumbnails & Retake Actions */}
      <div className="faceid-bottom-tray">
        <div className="faceid-tray-header">
          <span>Captured Biometric Angles</span>
          {allDone && (
            <button className="faceid-done-btn" onClick={onDone}>
              Complete Enrollment
            </button>
          )}
        </div>

        <div className="faceid-thumbnails-scroll">
          {activePhases.map((phase, idx) => {
            const isCompleted = completedKeys.includes(phase.key);
            const isCurrent = idx === currentPhaseIdx;
            const thumbUrl = capturedThumbnails[phase.key];

            return (
              <div
                key={phase.key}
                className={`faceid-thumb-card ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}`}
                onClick={() => handleRetakeAngle(idx)}
              >
                <div className="faceid-thumb-preview">
                  {thumbUrl ? (
                    <img src={thumbUrl} alt={phase.label} />
                  ) : (
                    <div className="faceid-thumb-placeholder">{idx + 1}</div>
                  )}

                  {isCompleted && (
                    <div className="faceid-thumb-check">
                      <IconCheck size={14} stroke={3} />
                    </div>
                  )}
                </div>

                <div className="faceid-thumb-info">
                  <span className="faceid-thumb-label">{phase.label}</span>
                  {isCompleted && (
                    <span className="faceid-thumb-retake">
                      <IconRotateClockwise size={11} /> Retake
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
