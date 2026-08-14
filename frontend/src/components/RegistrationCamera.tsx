import { useRef, useState, useEffect } from "react";
import { previewFrame } from "../api/registration";
import type { FaceInfo, PreviewResult } from "../api/registration";
import "./RegistrationCamera.css";

const PHASES = [
  { key: "frontal", label: "Straight ahead", instruction: "Look straight at the camera" },
  { key: "left", label: "Turn left", instruction: "Slowly turn your head to the left" },
  { key: "right", label: "Turn right", instruction: "Slowly turn your head to the right" },
  { key: "tilt_up", label: "Tilt up", instruction: "Tilt your head up" },
  { key: "tilt_down", label: "Tilt down", instruction: "Tilt your head down" },
  { key: "random", label: "Natural", instruction: "Relax — natural expression" },
];

interface Props {
  onCapture: (dataUrl: string, angle: string) => Promise<void>;
  onBack?: () => void;
  onDone?: () => void;
  phases?: typeof PHASES;
}

function poseMatchesAngle(face: FaceInfo, angle: string): boolean {
  const yaw = face.pose[1];
  const absYaw = Math.abs(yaw);
  const pitch = face.pose[0];
  switch (angle) {
    case "frontal": return absYaw <= 20;
    case "left": return yaw > 15 && absYaw <= 60;
    case "right": return yaw < -15 && absYaw <= 60;
    case "tilt_up": return pitch > 5;
    case "tilt_down": return pitch < -5;
    case "random": return true;
    default: return false;
  }
}

function guidanceForPhase(r: PreviewResult | null, phaseKey: string): {
  hint: string;
  state: "ok" | "warn" | "error" | "neutral";
} {
  if (!r) return { hint: "Position your face in the circle", state: "neutral" };
  if (!r.face_detected) return { hint: "No face detected — center your face", state: "error" };
  if (r.face_count > 1) return { hint: "Only one person should be visible", state: "error" };
  const face = r.faces[0];
  if (!face) return { hint: "Center your face in the circle", state: "error" };
  const area = (face.face_width * face.face_height) / (face.img_width * face.img_height);
  if (area < 0.08) return { hint: "Move closer to the camera", state: "warn" };
  if (area > 0.40) return { hint: "Move back slightly", state: "warn" };

  if (!poseMatchesAngle(face, phaseKey)) {
    switch (phaseKey) {
      case "left": return { hint: "Turn your head to the left", state: "warn" };
      case "right": return { hint: "Turn your head to the right", state: "warn" };
      case "tilt_up": return { hint: "Tilt your head up", state: "warn" };
      case "tilt_down": return { hint: "Tilt your head down", state: "warn" };
      case "frontal": return { hint: "Look straight at the camera", state: "warn" };
      default: return { hint: "Hold still…", state: "warn" };
    }
  }
  return { hint: "Hold still…", state: "ok" };
}

export default function RegistrationCamera({ onCapture, onBack, onDone, phases }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const uploadingRef = useRef(false);
  const goodFramesRef = useRef(0);
  const lastFrameRef = useRef<string | null>(null);

  const activePhases = phases ?? PHASES;

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [step, setStep] = useState<"starting" | "previewing" | "uploading" | "done">("starting");
  const [flash, setFlash] = useState(false);
  const [justCaptured, setJustCaptured] = useState(false);

  const currentPhase = activePhases[currentPhaseIdx];
  const allDone = currentPhaseIdx >= activePhases.length;

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
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
      });
      if (!streamRef.current && videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          setCameraError(true);
          return;
        }
        setCameraReady(true);
        setStep("previewing");
      } else if (streamRef.current) {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setCameraError(true);
    }
  }

  useEffect(() => {
    if (!cameraReady || step !== "previewing") return;
    let active = true;

    const tick = async () => {
      if (!active) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) { scheduleNext(); return; }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) { scheduleNext(); return; }
      try { ctx.drawImage(video, 0, 0); } catch { scheduleNext(); return; }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "p.jpg", { type: "image/jpeg" });
        const result = await previewFrame(file);
        if (!active) return;

        setPreview(result);
        const f = result.face_detected && result.faces.length > 0 ? result.faces[0] : null;

        if (f && result.face_count === 1 && result.quality_pass && poseMatchesAngle(f, currentPhase.key)) {
          goodFramesRef.current++;
          if (goodFramesRef.current >= 2 && !uploadingRef.current) {
            lastFrameRef.current = dataUrl;
            await captureAndUpload();
            if (active) scheduleNext();
            return;
          }
        } else {
          goodFramesRef.current = 0;
        }
      } catch { /* skip frame */ }

      if (active) scheduleNext();
    };

    const scheduleNext = () => {
      timerRef.current = setTimeout(tick, 500);
    };

    tick();
    return () => { active = false; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [cameraReady, step, currentPhaseIdx]);

  async function captureAndUpload() {
    if (uploadingRef.current || !mountedRef.current) return;
    uploadingRef.current = true;
    setStep("uploading");

    const dataUrl = lastFrameRef.current;
    if (dataUrl && mountedRef.current) {
      try {
        await onCapture(dataUrl, currentPhase.key);
      } catch {
        if (!mountedRef.current) return;
        goodFramesRef.current = 0;
        uploadingRef.current = false;
        setStep("previewing");
        return;
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 450);
    }

    if (!mountedRef.current) return;
    goodFramesRef.current = 0;
    const nextIdx = currentPhaseIdx + 1;
    if (nextIdx >= activePhases.length) {
      setCurrentPhaseIdx(nextIdx);
      setStep("done");
      onDone?.();
    } else {
      setCurrentPhaseIdx(nextIdx);
      setStep("previewing");
    }
    uploadingRef.current = false;
  }

  useEffect(() => {
    if (currentPhaseIdx > 0 && currentPhaseIdx < activePhases.length) {
      goodFramesRef.current = 0;
      setJustCaptured(true);
      const t = setTimeout(() => setJustCaptured(false), 700);
      return () => clearTimeout(t);
    }
  }, [currentPhaseIdx]);

  const guidance = guidanceForPhase(preview, currentPhase?.key ?? "frontal");
  const showCheckmark = justCaptured || (step === "uploading" && !allDone);

  return (
    <div className="faceid-root">
      <div className="faceid-topbar">
        <button
          className="faceid-back"
          onClick={() => onBack?.()}
          aria-label="Back"
          type="button"
        >
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 2L3 10L11 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="faceid-phase-label">
          {currentPhase?.label ?? "Complete"}
        </div>

        <div className="faceid-dots">
          {activePhases.map((ph, idx) => {
            const isDone = idx < currentPhaseIdx;
            const isCurrent = idx === currentPhaseIdx && !allDone;
            return (
              <span
                key={ph.key}
                className={`faceid-dot ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}
              />
            );
          })}
        </div>
      </div>

      <div className="faceid-stage">
        <div className="faceid-circle-wrap">
          <div className="faceid-camera">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ transform: "scaleX(-1)" }}
            />
            <div className="faceid-vignette" />
            <div className={`faceid-capture-flash ${flash ? "flashing" : ""}`} />
          </div>

          <div className="faceid-ring-static" />

          {cameraReady && !allDone && (
            <svg
              className="faceid-ring-svg"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="faceid-ring-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#50e3c2" />
                  <stop offset="50%" stopColor="#0070f3" />
                  <stop offset="100%" stopColor="#7928ca" />
                </linearGradient>
              </defs>
              <circle
                className="faceid-ring-arc"
                cx="50"
                cy="50"
                r="48"
                strokeDasharray="226 75"
                strokeDashoffset="0"
                transform="rotate(-90 50 50)"
              />
            </svg>
          )}

          {showCheckmark && (
            <div className="faceid-check">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M25 52 L43 70 L75 35" />
              </svg>
            </div>
          )}
        </div>

        {!cameraReady && !cameraError && (
          <div className="faceid-loading">
            <div className="faceid-spinner" />
            <span>Starting camera…</span>
          </div>
        )}

        {cameraError && (
          <div className="faceid-loading">
            <span style={{ color: "#ff4444", marginBottom: "12px" }}>
              Camera access denied or blocked — please allow camera permissions in your browser
            </span>
            <button
              className="faceid-retry"
              onClick={startCamera}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {step === "done" && !onDone && (
          <div className="faceid-done">
            <div className="faceid-done-check">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M25 52 L43 70 L75 35" />
              </svg>
            </div>
            <div className="faceid-done-title">Enrollment Complete</div>
            <div className="faceid-done-sub">
              Your face has been registered. You can now use face recognition for attendance check-in.
            </div>
          </div>
        )}
      </div>

      <div className="faceid-bottom">
        {step !== "done" && currentPhase && (
          <>
            <div className="faceid-instruction">{currentPhase.instruction}</div>
            <div className={`faceid-hint ${guidance.state === "ok" ? "ok" : guidance.state === "warn" ? "warn" : guidance.state === "error" ? "error" : ""}`}>
              {guidance.hint}
            </div>
          </>
        )}
        {step === "done" && (
          <div className="faceid-hint ok">All angles captured successfully</div>
        )}
      </div>
    </div>
  );
}
