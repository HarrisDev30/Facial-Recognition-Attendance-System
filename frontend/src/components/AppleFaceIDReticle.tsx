import React, { useMemo } from "react";

interface Props {
  size?: number;
  yaw: number; // -90 to +90 (head turn left/right)
  pitch: number; // -90 to +90 (head tilt up/down)
  completedPhases: string[]; // e.g. ["frontal", "left"]
  currentPhase?: string;
  isGoodPose: boolean;
}

const TOTAL_TICKS = 48;
const RADIUS = 145; // inner radius for circle in 360x360 SVG viewBox

// Map phases to angular sectors (in degrees 0-360)
const PHASE_SECTORS: Record<string, { start: number; end: number }> = {
  tilt_up: { start: 225, end: 315 },    // Top (270 deg)
  right: { start: 315, end: 45 },       // Right (0/360 deg)
  tilt_down: { start: 45, end: 135 },    // Bottom (90 deg)
  left: { start: 135, end: 225 },       // Left (180 deg)
  frontal: { start: 0, end: 360 },      // Full ring base
  random: { start: 0, end: 360 },       // Full ring base
};

export const AppleFaceIDReticle: React.FC<Props> = ({
  size = 340,
  yaw,
  pitch,
  completedPhases,
  isGoodPose,
}) => {
  // Compute user head direction angle in degrees [0, 360)
  const currentAngle = useMemo(() => {
    if (Math.abs(yaw) < 5 && Math.abs(pitch) < 5) return null;
    // Yaw: positive = left (180 deg), negative = right (0 deg)
    // Pitch: positive = up (270 deg), negative = down (90 deg)
    let deg = (Math.atan2(-pitch, -yaw) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }, [yaw, pitch]);

  const ticks = useMemo(() => {
    return Array.from({ length: TOTAL_TICKS }).map((_, i) => {
      const angleDeg = (i * 360) / TOTAL_TICKS;
      const angleRad = (angleDeg * Math.PI) / 180;

      // Check if this tick belongs to a completed phase
      let isCompleted = false;
      for (const p of completedPhases) {
        const sector = PHASE_SECTORS[p];
        if (sector) {
          if (sector.start === 0 && sector.end === 360) {
            isCompleted = true;
          } else if (sector.start > sector.end) {
            if (angleDeg >= sector.start || angleDeg <= sector.end) isCompleted = true;
          } else {
            if (angleDeg >= sector.start && angleDeg <= sector.end) isCompleted = true;
          }
        }
      }

      // Check proximity to current head angle
      let proximity = 0;
      if (currentAngle !== null) {
        let diff = Math.abs(angleDeg - currentAngle);
        if (diff > 180) diff = 360 - diff;
        if (diff < 45) {
          proximity = 1 - diff / 45; // 0.0 to 1.0
        }
      }

      // Dynamic length and color
      const baseLength = 10;
      const extraLength = isCompleted ? 14 : proximity * 16;
      const length = baseLength + extraLength;
      const strokeWidth = isCompleted ? 3.5 : 2 + proximity * 2;

      // Coordinates
      const x1 = 180 + RADIUS * Math.cos(angleRad);
      const y1 = 180 + RADIUS * Math.sin(angleRad);
      const x2 = 180 + (RADIUS + length) * Math.cos(angleRad);
      const y2 = 180 + (RADIUS + length) * Math.sin(angleRad);

      let stroke = "rgba(148, 163, 184, 0.25)"; // idle slate
      if (isCompleted) {
        stroke = "#10b981"; // completed emerald
      } else if (proximity > 0.1) {
        stroke = isGoodPose ? "#06b6d4" : "#3b82f6"; // electric cyan/blue on active rotation
      }

      return { i, x1, y1, x2, y2, stroke, strokeWidth, isCompleted, proximity };
    });
  }, [completedPhases, currentAngle, isGoodPose]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 360 360"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 10,
        overflow: "visible",
      }}
    >
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Inner guide ring */}
      <circle
        cx="180"
        cy="180"
        r={RADIUS - 4}
        fill="none"
        stroke={isGoodPose ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.1)"}
        strokeWidth="1.5"
        strokeDasharray={isGoodPose ? "none" : "4 4"}
      />

      {/* 48 Dynamic Radial Ticks */}
      {ticks.map((t) => (
        <line
          key={t.i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.stroke}
          strokeWidth={t.strokeWidth}
          strokeLinecap="round"
          filter={t.isCompleted || t.proximity > 0.4 ? "url(#glow)" : undefined}
          style={{
            transition: "all 0.12s ease-out",
          }}
        />
      ))}
    </svg>
  );
};
