import { useRef, useState, useEffect, useCallback } from "react";
import { AppleFaceIDReticle } from "./AppleFaceIDReticle";
import { getFaceLandmarker, estimateFaceOrientation } from "../utils/faceLandmarker";
import type { FaceOrientation } from "../utils/faceLandmarker";
import {
  IconCheck,
  IconRotateClockwise,
  IconArrowLeft,
  IconAlertCircle,
  IconRefresh,
  IconArrowRight,
  IconArrowUp,
  IconArrowDown,
} from "@tabler/icons-react";
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

function poseMatchesAngle(orientation: FaceOrientation, angle: string): boolean {
  const yaw = orientation.yaw;
  const absYaw = Math.abs(yaw);
  const pitch = orientation.pitch;
  switch (angle) {
    case "frontal": return absYaw <= 12 && Math.abs(pitch) <= 12;
    case "left": return yaw > 14 && absYaw <= 55;
    case "right": return yaw < -14 && absYaw <= 55;
    case "tilt_up": return pitch > 8;
    case "tilt_down": return pitch < -8;
    case "random": return true;
    default: return false;
  }
}

function guidanceForOrientation(orientation: FaceOrientation, phaseKey: string): {
  hint: string;
  state: "ok" | "warn" | "error" | "neutral";
  icon?: "left" | "right" | "up" | "down" | "check" | "none";
} {
  if (!orientation.detected) {
    return { hint: "Position your face inside the circle", state: "neutral", icon: "none" };
  }
  if (orientation.faceCount > 1) {
    return { hint: "Only one face allowed in frame", state: "error", icon: "none" };
  }

  if (orientation.faceCoverage < 0.05) {
    return { hint: "Move slightly closer to the camera", state: "warn", icon: "none" };
  }
  if (orientation.faceCoverage > 0.48) {
    return { hint: "Move slightly back from the camera", state: "warn", icon: "none" };
  }

  if (!poseMatchesAngle(orientation, phaseKey)) {
    switch (phaseKey) {
      case "left": return { hint: "Turn your head slowly to the left", state: "warn", icon: "left" };
      case "right": return { hint: "Turn your head slowly to the right", state: "warn", icon: "right" };
      case "tilt_up": return { hint: "Tilt your chin upward", state: "warn", icon: "up" };
      case "tilt_down": return { hint: "Tilt your chin downward", state: "warn", icon: "down" };
      case "frontal": return { hint: "Look straight at the camera", state: "warn", icon: "none" };
      default: return { hint: "Hold steady...", state: "warn", icon: "none" };
    }
  }
  return { hint: "Perfect! Hold still...", state: "ok", icon: "check" };
}

export default function RegistrationCamera({ onCapture, onBack, onDone, phases }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);
  const uploadingRef = useRef(false);
  const goodFramesRef = useRef(0);

  const activePhases = phases ?? PHASES;

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [flash, setFlash] = useState(false);
  const [capturedThumbnails, setCapturedThumbnails] = useState<Record<string, string>>({});
  const [completedKeys, setCompletedKeys] = useState<string[]>([]);
  const [reticleSize, setReticleSize] = useState(340);

  const [orientation, setOrientation] = useState<FaceOrientation>({
    detected: false,
    faceCount: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    faceCoverage: 0,
  });

  // Responsive reticle sizing
  useEffect(() => {
    function updateSize() {
      const w = window.innerWidth;
      if (w <= 480) {
        setReticleSize(280);
      } else if (w <= 640) {
        setReticleSize(310);
      } else {
        setReticleSize(340);
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const currentPhase = activePhases[currentPhaseIdx];
  const allDone = currentPhaseIdx >= activePhases.length;

  const guidance = guidanceForOrientation(orientation, currentPhase?.key ?? "");
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

  // Initialize MediaPipe FaceLandmarker
  useEffect(() => {
    let active = true;
    getFaceLandmarker()
      .then((lm) => {
        if (active) landmarkerRef.current = lm;
      })
      .catch((err) => {
        console.warn("MediaPipe initialization warning (fallback active):", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // 60 FPS Real-Time Client-Side Tracking Loop
  useEffect(() => {
    if (!cameraReady || allDone) return;

    let isRunning = true;

    function trackLoop(timestamp: number) {
      if (!isRunning) return;

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && video.readyState >= 2 && landmarker && !uploadingRef.current) {
        const est = estimateFaceOrientation(landmarker, video, timestamp);
        setOrientation(est);

        const currentGuide = guidanceForOrientation(est, currentPhase?.key ?? "");
        if (currentGuide.state === "ok") {
          goodFramesRef.current += 1;
          // After holding good pose for 15 frames (~250ms at 60fps), trigger capture
          if (goodFramesRef.current >= 15 && !uploadingRef.current) {
            const frame = grabFrame();
            if (frame) {
              triggerCapture(frame, currentPhase.key);
            }
          }
        } else {
          goodFramesRef.current = 0;
        }
      }

      if (isRunning && !uploadingRef.current) {
        animFrameRef.current = requestAnimationFrame(trackLoop);
      }
    }

    animFrameRef.current = requestAnimationFrame(trackLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraReady, allDone, currentPhase, grabFrame, triggerCapture]);

  const handleRetakeAngle = (index: number) => {
    setCurrentPhaseIdx(index);
    const key = activePhases[index].key;
    setCompletedKeys((prev) => prev.filter((k) => k !== key));
    goodFramesRef.current = 0;
  };

  useEffect(() => {
    if (!streamRef.current) startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <IconAlertCircle size={52} color="#ff453a" style={{ marginBottom: "1rem" }} />
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem", color: "#ffffff" }}>
            Camera Access Required
          </h2>
          <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.9rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            Please allow camera access in your browser settings to set up Face ID.
          </p>
          <button className="faceid-apple-btn-primary" onClick={startCamera} style={{ width: "100%" }}>
            <IconRefresh size={18} style={{ marginRight: 8 }} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="faceid-root">
      {flash && <div className="faceid-flash" />}

      {/* Apple Top Navigation Bar */}
      <div className="faceid-topbar">
        {onBack ? (
          <button className="faceid-back-btn" onClick={onBack} title="Exit Camera" type="button">
            <IconArrowLeft size={18} />
          </button>
        ) : <div />}

        <div className="faceid-status-badge">
          <span>{allDone ? "All Angles Captured" : `${currentPhase?.label}`}</span>
        </div>

        <div className="faceid-counter">
          {Math.min(currentPhaseIdx + 1, activePhases.length)} / {activePhases.length}
        </div>
      </div>

      {/* Stage Viewport with 60 FPS Apple Face ID Circular Reticle */}
      <div className="faceid-stage">
        <div className="faceid-reticle-container">
          <AppleFaceIDReticle
            size={reticleSize}
            yaw={orientation.yaw}
            pitch={orientation.pitch}
            completedPhases={completedKeys}
            currentPhase={currentPhase?.key}
            isGoodPose={isGoodPose}
            hasFace={orientation.detected}
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

        {/* Dynamic Island Floating Guidance Pill */}
        <div className={`faceid-instruction-pill ${guidance.state}`}>
          {guidance.icon === "left" && <IconArrowLeft size={16} />}
          {guidance.icon === "right" && <IconArrowRight size={16} />}
          {guidance.icon === "up" && <IconArrowUp size={16} />}
          {guidance.icon === "down" && <IconArrowDown size={16} />}
          {guidance.icon === "check" && <IconCheck size={16} stroke={3} />}
          <span>{guidance.hint}</span>
        </div>
      </div>

      {/* Interactive Bottom Tray of 6 Thumbnails & Completion Action */}
      <div className="faceid-bottom-tray">
        <div className="faceid-tray-header">
          <span>Face Angles ({completedKeys.length}/6)</span>
          {allDone && (
            <button className="faceid-done-btn" onClick={onDone} type="button">
              Review Captures →
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
                role="button"
                tabIndex={0}
              >
                <div className="faceid-thumb-preview">
                  {thumbUrl ? (
                    <img src={thumbUrl} alt={phase.label} />
                  ) : (
                    <div className="faceid-thumb-placeholder">{idx + 1}</div>
                  )}

                  {isCompleted && (
                    <div className="faceid-thumb-check">
                      <IconCheck size={12} stroke={3} />
                    </div>
                  )}
                </div>

                <div className="faceid-thumb-info">
                  <span className="faceid-thumb-label">{phase.label}</span>
                  {isCompleted && (
                    <span className="faceid-thumb-retake">
                      <IconRotateClockwise size={10} /> Retake
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
