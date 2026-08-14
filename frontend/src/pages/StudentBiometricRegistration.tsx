import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingOverlay, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import {
  getRegistrationStatus,
  uploadMyEmbedding,
  resetMyRegistration,
} from "../api/registration";
import { giveConsent, getConsentStatus } from "../api/attendees";
import { getApiError } from "../utils/error";
import { useAsync } from "../hooks";
import type { RegistrationStatus } from "../api/registration";
import RegistrationCamera from "../components/RegistrationCamera";
import ConsentForm from "../components/ConsentForm";
import "./StudentBiometricRegistration.css";

const ANGLE_LABELS: Record<string, string> = {
  frontal: "Front",
  left: "Left",
  right: "Right",
  tilt_up: "Up",
  tilt_down: "Down",
  random: "Natural",
};

const PHASE_KEYS = ["frontal", "left", "right", "tilt_up", "tilt_down", "random"];

const ALL_PHASES = PHASE_KEYS.map((key) => ({
  key,
  label: ANGLE_LABELS[key],
  instruction: "",
}));

type Step = "intro" | "capture" | "review" | "done";

export default function StudentBiometricRegistration() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("intro");
  const [, setStatus] = useState<RegistrationStatus | null>(null);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [capturePhases, setCapturePhases] = useState<typeof ALL_PHASES | undefined>();

  const capturedCount = Object.keys(images).length;

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
      const missing = PHASE_KEYS.filter((k) => !images[k]);
      setCapturePhases(
        missing.length > 0 && missing.length < 6
          ? ALL_PHASES.filter((p) => missing.includes(p.key))
          : undefined,
      );
      setStep("capture");
    } catch (err) {
      notifications.show({
        title: "Consent failed",
        message: getApiError(err),
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

  const handleRecapture = (angle: string) => {
    const remaining = { ...images };
    delete remaining[angle];
    setImages(remaining);
    const missing = PHASE_KEYS.filter((k) => !remaining[k]);
    setCapturePhases(
      missing.length > 0 && missing.length < 6
        ? ALL_PHASES.filter((p) => missing.includes(p.key))
        : undefined,
    );
    setStep("capture");
  };

  const handleCameraBack = () => {
    if (capturedCount > 0) {
      setStep("review");
    } else {
      setCapturePhases(undefined);
      setStep("intro");
    }
  };

  const handleCameraDone = () => {
    setCapturePhases(undefined);
    setStep("review");
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      for (const [angle, dataUrl] of Object.entries(images)) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `face_${angle}.jpg`, { type: "image/jpeg" });
        await uploadMyEmbedding(file, angle);
      }
      setStep("done");
    } catch (err) {
      notifications.show({
        title: "Upload failed",
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
      setCapturePhases(undefined);
      setStatus((prev) => (prev ? { ...prev, num_embeddings: 0, is_registered: false } : prev));
      setStep("intro");
      notifications.show({
        title: "Reset complete",
        message: "You can start enrollment again.",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({
        title: "Reset failed",
        message: getApiError(err),
        color: "red",
        icon: <IconX size={16} />,
      });
    }
  };

  if (loading) {
    return (
      <div className="faceid-loading-overlay">
        <LoadingOverlay visible />
      </div>
    );
  }

  if (step === "intro") {
    return (
      <>
        <ConsentForm
          opened={consentModalOpen}
          onClose={() => setConsentModalOpen(false)}
          onConfirm={handleConsent}
          loading={consentLoading}
        />
        <IntroStep onStart={handleStart} />
      </>
    );
  }

  if (step === "capture") {
    return (
      <div className="faceid-camera-wrap">
        <RegistrationCamera
          onCapture={handleCapture}
          onBack={handleCameraBack}
          onDone={handleCameraDone}
          phases={capturePhases}
        />
      </div>
    );
  }

  if (step === "review") {
    return (
      <ReviewStep
        images={images}
        onRecapture={handleRecapture}
        onComplete={handleComplete}
        onReset={handleReset}
        submitting={submitting}
      />
    );
  }

  return <DoneStep onDashboard={() => navigate("/student/dashboard")} />;
}

function IntroStep({ onStart }: { onStart: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="faceid-page">
      <div className="faceid-page-nav">
        <button className="faceid-back" onClick={() => navigate("/profile")} aria-label="Back" type="button">
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 2L3 10L11 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="faceid-content">
        <div className="faceid-hero-glyph">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="32" />
            <circle cx="50" cy="42" r="10" />
            <path d="M30 76 C 30 62, 42 56, 50 56 C 58 56, 70 62, 70 76" />
          </svg>
        </div>

        <h1 className="faceid-title">Enroll Your Face</h1>
        <p className="faceid-subtitle">
          We'll guide you through capturing 6 angles so we can recognize you at events.
        </p>

        <div className="faceid-bullet-list">
          <div className="faceid-bullet">
            <div className="num">1</div>
            <div>Find a well-lit area and hold your face about 10–20 inches from the camera.</div>
          </div>
          <div className="faceid-bullet">
            <div className="num">2</div>
            <div>Center your face inside the circle and follow the on-screen prompts.</div>
          </div>
          <div className="faceid-bullet">
            <div className="num">3</div>
            <div>Slowly turn your head as instructed — straight, left, right, up, down, natural.</div>
          </div>
          <div className="faceid-bullet">
            <div className="num">4</div>
            <div>Remove sunglasses, masks, or anything covering your face.</div>
          </div>
        </div>

        <div style={{ width: "100%" }}>
          <button className="faceid-primary-btn" onClick={onStart}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  images,
  onRecapture,
  onComplete,
  onReset,
  submitting,
}: {
  images: Record<string, string>;
  onRecapture: (angle: string) => void;
  onComplete: () => void;
  onReset: () => void;
  submitting: boolean;
}) {
  const navigate = useNavigate();
  const capturedCount = Object.keys(images).length;
  const allCaptured = capturedCount >= PHASE_KEYS.length;

  return (
    <div className="faceid-page">
      <div className="faceid-page-nav">
        <button className="faceid-back" onClick={() => navigate("/profile")} aria-label="Back" type="button">
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 2L3 10L11 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="faceid-content" style={{ justifyContent: "flex-start", paddingTop: 16 }}>
        <h1 className="faceid-title" style={{ fontSize: 22, marginBottom: 8 }}>Review Captures</h1>
        <p className="faceid-subtitle" style={{ marginBottom: 24 }}>
          {capturedCount}/{PHASE_KEYS.length} angles captured
        </p>

        <div className="faceid-photo-grid">
          {PHASE_KEYS.map((key) => {
            const dataUrl = images[key];
            return (
              <div
                className={`faceid-photo-cell ${dataUrl ? "has-image" : ""}`}
                key={key}
                onClick={dataUrl ? () => onRecapture(key) : () => onRecapture(key)}
              >
                {dataUrl ? (
                  <>
                    <img src={dataUrl} alt={ANGLE_LABELS[key]} />
                    <div className="faceid-recapture-overlay">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 21h5v-5" />
                      </svg>
                    </div>
                    <div className="label">{ANGLE_LABELS[key]}</div>
                  </>
                ) : (
                  <div className="pending">
                    <div className="faceid-pending-content">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      <span>Tap to capture</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ width: "100%", marginTop: 8 }}>
          <button
            className="faceid-primary-btn"
            onClick={onComplete}
            disabled={!allCaptured || submitting}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader size="sm" color="dark" />
                Uploading…
              </span>
            ) : (
              "Complete Enrollment"
            )}
          </button>
          <button className="faceid-secondary-btn faceid-danger-btn" onClick={onReset} disabled={submitting}>
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneStep({ onDashboard }: { onDashboard: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="faceid-page">
      <div className="faceid-page-nav">
        <button className="faceid-back" onClick={() => navigate("/student/dashboard")} aria-label="Back" type="button">
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 2L3 10L11 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="faceid-content">
        <div className="faceid-done-big">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M25 52 L43 70 L75 35" />
          </svg>
        </div>
        <h1 className="faceid-title">Enrollment Complete</h1>
        <p className="faceid-subtitle">
          Your face has been registered. You can now use face recognition for
          attendance check-in at events.
        </p>
        <div style={{ width: "100%" }}>
          <button className="faceid-primary-btn" onClick={onDashboard}>
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
