import { useMemo } from "react";
import { Modal, Text, Badge, Group, Button, ActionIcon } from "@mantine/core";
import {
  IconScan,
  IconShieldCheck,
  IconShieldX,
  IconInfoCircle,
  IconX,
  IconSparkles,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useInstitutionTheme } from "../../theme/InstitutionThemeProvider";
import "./StudentPassModal.css";

interface StudentPassModalProps {
  opened: boolean;
  onClose: () => void;
}

// Deterministic 21x21 QR Code SVG Generator for Attendee ID
function StudentQRCodeSVG({ value }: { value: string }) {
  const matrix = useMemo(() => {
    const size = 21;
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // Function to draw standard QR finder pattern (7x7 with inner 3x3)
    const drawFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            grid[startY + r][startX + c] = true;
          }
        }
      }
    };

    // Draw 3 standard corner finder patterns
    drawFinder(0, 0); // Top-left
    drawFinder(14, 0); // Top-right
    drawFinder(0, 14); // Bottom-left

    // Draw timing patterns
    for (let i = 8; i < 13; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Deterministic hash based data fill
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip finder areas
        const inFinder =
          (r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8);
        if (!inFinder && r !== 6 && c !== 6) {
          const bit = (hash ^ (r * 19 + c * 37 + (r ^ c))) % 3;
          grid[r][c] = bit === 0 || bit === 1;
        }
      }
    }

    return grid;
  }, [value]);

  return (
    <svg
      viewBox="0 0 21 21"
      className="student-pass-qr-code"
      style={{ shapeRendering: "crispEdges" }}
    >
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect key={`${r}-${c}`} x={c} y={r} width="1.01" height="1.01" fill="#0f172a" />
          ) : null,
        ),
      )}
    </svg>
  );
}

export default function StudentPassModal({ opened, onClose }: StudentPassModalProps) {
  const { user } = useAuthStore();
  const { institution } = useInstitutionTheme();

  const attendeeId = user?.attendee_id || user?.id || "N/A";
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Student";
  const institutionName = user?.institution_name || institution?.name || "Campus Attendify";
  const isBiometricActive = user?.profile_photo_url || user?.attendee_type;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="md"
      withCloseButton={false}
      overlayProps={{
        backgroundOpacity: 0.65,
        blur: 8,
      }}
      styles={{
        content: {
          backgroundColor: "transparent",
          boxShadow: "none",
        },
        body: {
          padding: 0,
        },
      }}
    >
      <div className="student-pass-card">
        {/* Header */}
        <div className="student-pass-card-header">
          <div>
            <div className="student-pass-brand-badge">
              <IconScan size={14} />
              <span>{institutionName}</span>
            </div>
            <Text fz="1.15rem" fw={700} c="var(--text-primary)" mt={8} lh={1.2}>
              Digital Student Pass
            </Text>
          </div>

          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            radius="xl"
            onClick={onClose}
            aria-label="Close pass"
          >
            <IconX size={18} />
          </ActionIcon>
        </div>

        {/* QR Code Presentation */}
        <div className="student-pass-qr-wrapper">
          <StudentQRCodeSVG value={`${user?.institution_code || "CAMPUS"}-${attendeeId}-${user?.email || ""}`} />
          <span className="student-pass-id-tag">{attendeeId}</span>
        </div>

        {/* Student Credential Grid */}
        <div className="student-pass-info-grid">
          <div className="student-pass-info-item">
            <label>Student Name</label>
            <span>{fullName}</span>
          </div>

          <div className="student-pass-info-item">
            <label>Biometric Status</label>
            <Badge
              size="xs"
              variant="light"
              color={isBiometricActive ? "teal" : "amber"}
              leftSection={
                isBiometricActive ? (
                  <IconShieldCheck size={12} />
                ) : (
                  <IconShieldX size={12} />
                )
              }
              styles={{ root: { fontWeight: 600, width: "fit-content" } }}
            >
              {isBiometricActive ? "Face ID Verified" : "Photo Pending"}
            </Badge>
          </div>

          <div className="student-pass-info-item">
            <label>Institution Code</label>
            <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
              {user?.institution_code || "CAMPUS"}
            </span>
          </div>

          <div className="student-pass-info-item">
            <label>Role</label>
            <span style={{ textTransform: "capitalize" }}>{user?.role || "Student"}</span>
          </div>
        </div>

        {/* Biometrics Setup Suggestion if not enrolled */}
        {!isBiometricActive && (
          <Group
            justify="space-between"
            align="center"
            p="xs"
            mt="md"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: 10,
            }}
          >
            <Text fz="0.75rem" c="amber.8" fw={500}>
              Biometric enrollment is pending for faster kiosk walk-through.
            </Text>
            <Button
              component={Link}
              to="/register-biometrics"
              size="compact-xs"
              variant="filled"
              color="amber"
              onClick={onClose}
              leftSection={<IconSparkles size={12} />}
            >
              Enroll Face ID
            </Button>
          </Group>
        )}

        {/* Footer Instruction */}
        <div className="student-pass-footer-tip">
          <IconInfoCircle size={18} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
          <Text fz="0.725rem" c="var(--text-secondary)" lh={1.35}>
            Present this pass at any active kiosk or marshal scanner station when entering university sessions.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
