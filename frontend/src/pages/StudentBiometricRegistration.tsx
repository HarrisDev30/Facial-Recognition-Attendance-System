import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingOverlay, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconX,
  IconLock,
  IconRefresh,
} from "@tabler/icons-react";
import {
  getRegistrationStatus,
  uploadMyEmbedding,
  resetMyRegistration,
} from "../api/registration";
import { giveConsent, getConsentStatus } from "../api/attendees";
import { getApiError } from "../utils/error";
import { useAsync } from "../hooks";
import { useInstitutionTheme } from "../theme/InstitutionThemeProvider";
import type { RegistrationStatus } from "../api/registration";
import RegistrationCamera from "../components/RegistrationCamera";
import ConsentForm from "../components/ConsentForm";
import "./StudentBiometricRegistration.css";

const ANGLE_LABELS: Record<string, string> = {
  frontal: "Straight Ahead",
  left: "Left Angle",
  right: "Right Angle",
  tilt_up: "Tilt Up",
  tilt_down: "Tilt Down",
  random: "Natural",
};

const PHASE_KEYS = ["frontal", "left", "right", "tilt_up", "tilt_down", "random"];

const ALL_PHASES = PHASE_KEYS.map((key) => ({
  key,
  label: ANGLE_LABELS[key],
  instruction: "",
}));

type Step = "intro" | "capture" | "review" | "done";

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

export default function StudentBiometricRegistration() {
  const navigate = useNavigate();
  const { institution } = useInstitutionTheme();
  const [step, setStep] = useState<Step>("intro");
  const [, setStatus] = useState<RegistrationStatus | null>(null);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [capturePhases, setCapturePhases] = useState<typeof ALL_PHASES | undefined>();

  const { loading } = useAsync(
    async () => {
      try {
        const s = await getRegistrationStatus();
        setStatus(s);
        if (s.num_embeddings >= PHASE_KEYS.length) {
          setStep("done");
        }
      } catch {
        notifications.show({
          title: "Error",
          message: "Failed to load registration status",
          color: "red",
          icon: <IconX size={16} />,
        });
      }
    },
    true,
  );

  const handleStart = async () => {
    try {
      const status = await getConsentStatus();
      if (status.has_consented) {
        const missing = PHASE_KEYS.filter((k) => !images[k]);
        setCapturePhases(
          missing.length > 0 && missing.length < 6
            ? ALL_PHASES.filter((p) => missing.includes(p.key))
            : undefined,
        );
        setStep("capture");
      } else {
        setConsentModalOpen(true);
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to check consent status",
        color: "red",
        icon: <IconX size={16} />,
      });
    }
  };

  const handleConsent = async () => {
    setConsentLoading(true);
    try {
      await giveConsent({ consent_given: true, acknowledge_data_privacy: true });
      setConsentModalOpen(false);
      setStep("capture");
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save consent",
        color: "red",
        icon: <IconX size={16} />,
      });
    } finally {
      setConsentLoading(false);
    }
  };

  const handleCapture = async (dataUrl: string, angle: string) => {
    setImages((prev) => ({ ...prev, [angle]: dataUrl }));
  };

  const handleCameraDone = () => {
    setStep("review");
  };

  const handleCameraBack = () => {
    if (Object.keys(images).length > 0) {
      setStep("review");
    } else {
      setStep("intro");
    }
  };

  const handleRecapture = (angle: string) => {
    setCapturePhases(ALL_PHASES.filter((p) => p.key === angle));
    setStep("capture");
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      for (const [angle, dataUrl] of Object.entries(images)) {
        await uploadMyEmbedding(dataUrlToFile(dataUrl, `${angle}.jpg`), angle);
      }
      notifications.show({
        title: "Face ID Set Up",
        message: "Your biometric profile is active for event check-in.",
        color: "green",
        icon: <IconCheck size={16} />,
      });
      setStep("done");
    } catch (err) {
      notifications.show({
        title: "Upload Failed",
        message: getApiError(err),
        color: "red",
        icon: <IconX size={16} />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetMyRegistration();
      setImages({});
      setStep("intro");
      notifications.show({
        title: "Reset Complete",
        message: "You can start Face ID setup again.",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({
        title: "Reset Failed",
        message: getApiError(err),
        color: "red",
        icon: <IconX size={16} />,
      });
    }
  };

  if (loading) {
    return (
      <div className="faceid-apple-root" style={{ justifyContent: "center", alignItems: "center" }}>
        <LoadingOverlay visible />
      </div>
    );
  }

  // Camera capture step runs full-screen with its own dedicated Apple topbar & controls
  if (step === "capture") {
    return (
      <RegistrationCamera
        onCapture={handleCapture}
        onBack={handleCameraBack}
        onDone={handleCameraDone}
        phases={capturePhases}
      />
    );
  }

  const campusName = institution?.name || "Campus Security";

  return (
    <div className="faceid-apple-root">
      {/* ─── Apple Navigation Bar ─── */}
      <header className="faceid-apple-nav">
        <button
          type="button"
          className="faceid-apple-close-btn"
          onClick={() => navigate("/student/profile")}
          aria-label="Exit Setup"
        >
          <IconX size={18} />
        </button>

        <div className="faceid-apple-institution-pill">
          <span className="faceid-apple-dot" />
          <span>{campusName}</span>
        </div>
      </header>

      {/* ─── Main Center Focus Stage ─── */}
      <main className="faceid-apple-stage">
        {step === "intro" && (
          <>
            <ConsentForm
              opened={consentModalOpen}
              onClose={() => setConsentModalOpen(false)}
              onConfirm={handleConsent}
              loading={consentLoading}
            />

            {/* Apple Face ID Line-Art Glyph */}
            <div className="faceid-apple-glyph">
              <svg viewBox="0 0 48 48">
                <rect x="6" y="6" width="36" height="36" rx="10" />
                <circle cx="18" cy="20" r="1.8" fill="#ffffff" stroke="none" />
                <circle cx="30" cy="20" r="1.8" fill="#ffffff" stroke="none" />
                <path d="M24 22 V27 H22" strokeWidth="2" strokeLinecap="round" />
                <path d="M17 32 C19 35, 29 35, 31 32" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>

            <h1 className="faceid-apple-title">How to Set Up Face ID</h1>
            <p className="faceid-apple-desc">
              First, position your face in the camera frame. Then slowly turn your head to complete all 6 angles.
            </p>

            <div className="faceid-apple-privacy">
              <IconLock size={13} />
              <span>Encrypted mathematical vectors only • No raw photos stored</span>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <h1 className="faceid-apple-title" style={{ fontSize: "1.5rem", marginBottom: 6 }}>
              Review Face Angles
            </h1>
            <p className="faceid-apple-desc" style={{ marginBottom: 12 }}>
              {Object.keys(images).length} of {PHASE_KEYS.length} angles captured
            </p>

            <div className="faceid-apple-review-grid">
              {PHASE_KEYS.map((key) => {
                const dataUrl = images[key];
                return (
                  <div
                    className="faceid-apple-photo-cell"
                    key={key}
                    onClick={() => handleRecapture(key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRecapture(key);
                    }}
                  >
                    {dataUrl ? (
                      <>
                        <img src={dataUrl} alt={ANGLE_LABELS[key]} />
                        <div className="faceid-apple-cell-badge">
                          <IconCheck size={12} stroke={3} />
                        </div>
                        <div className="faceid-apple-cell-label">{ANGLE_LABELS[key]}</div>
                      </>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "#6b7280" }}>
                        <IconRefresh size={18} />
                        <span style={{ fontSize: "0.65rem" }}>Recapture</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div className="faceid-apple-success-glyph">
              <IconCheck size={48} stroke={3} />
            </div>

            <h1 className="faceid-apple-title">Face ID is Now Set Up</h1>
            <p className="faceid-apple-desc">
              Your biometric profile is active. You can now use Face ID for contactless check-in across campus kiosks.
            </p>
          </>
        )}
      </main>

      {/* ─── Apple Bottom Safe-Area Fixed Actions ─── */}
      <footer className="faceid-apple-bottom-bar">
        <div className="faceid-apple-actions-inner">
          {step === "intro" && (
            <>
              <button type="button" className="faceid-apple-btn-primary" onClick={handleStart}>
                Get Started
              </button>
              <button
                type="button"
                className="faceid-apple-btn-secondary"
                onClick={() => navigate("/student/profile")}
              >
                Set Up Later
              </button>
            </>
          )}

          {step === "review" && (
            <>
              <button
                type="button"
                className="faceid-apple-btn-primary"
                onClick={handleComplete}
                disabled={Object.keys(images).length < PHASE_KEYS.length || submitting}
              >
                {submitting ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Loader size="sm" color="white" />
                    Saving Profile…
                  </span>
                ) : (
                  "Save & Activate Face ID"
                )}
              </button>
              <button
                type="button"
                className="faceid-apple-btn-secondary"
                onClick={handleReset}
                disabled={submitting}
              >
                Start Over
              </button>
            </>
          )}

          {step === "done" && (
            <button
              type="button"
              className="faceid-apple-btn-primary"
              onClick={() => navigate("/student/dashboard")}
            >
              Done
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
