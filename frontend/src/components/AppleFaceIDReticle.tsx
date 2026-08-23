import React, { useMemo, useState, useEffect } from "react";

interface Props {
  size?: number;
  yaw: number; // -60 to +60 (head turn left/right)
  pitch: number; // -50 to +50 (head tilt up/down)
  completedPhases: string[]; // e.g. ["frontal", "left"]
  currentPhase?: string;
  isGoodPose: boolean;
  hasFace?: boolean;
}

const TOTAL_TICKS = 48;
const RADIUS = 145; // inner radius for circle in 360x360 SVG viewBox

// Exact 8-tick symmetric clock partitioning (48 ticks total, 6 phases x 8 ticks)
// 0 deg = 3 o'clock (Right), 90 deg = 6 o'clock (Bottom), 180 deg = 9 o'clock (Left), 270 deg = 12 o'clock (Top)
const PHASE_TICK_RANGES: Record<string, number[]> = {
  frontal: [33, 34, 35, 36, 37, 38, 39, 32],      // 12 o'clock (Top - Straight Ahead)
  left: [21, 22, 23, 24, 25, 26, 27, 20],         // 9 o'clock (Left Side)
  right: [45, 46, 47, 0, 1, 2, 3, 44],            // 3 o'clock (Right Side)
  tilt_up: [28, 29, 30, 31, 40, 41, 42, 43],      // Top-Left and Top-Right shoulders
  tilt_down: [9, 10, 11, 12, 13, 14, 15, 8],       // 6 o'clock (Bottom Chin)
  random: [4, 5, 6, 7, 16, 17, 18, 19],           // Bottom-Left and Bottom-Right flanks
};

export const AppleFaceIDReticle: React.FC<Props> = ({
  size = 340,
  yaw,
  pitch,
  completedPhases,
  currentPhase,
  isGoodPose,
  hasFace = false,
}) => {
  const [wavePhase, setWavePhase] = useState(0);

  // Smooth idle wave when no face is in frame
  useEffect(() => {
    if (hasFace) return;
    let animId: number;
    function loop() {
      setWavePhase((prev) => (prev + 0.035) % (Math.PI * 2));
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [hasFace]);

  // Compute user head direction angle in degrees [0, 360)
  const faceAngle = useMemo(() => {
    if (!hasFace) return null;
    const mag = Math.hypot(yaw, pitch);
    if (mag < 1.5) return null; // Dead center looking straight
    let deg = (Math.atan2(-pitch, -yaw) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }, [hasFace, yaw, pitch]);

  const activeTargetTicks = currentPhase ? (PHASE_TICK_RANGES[currentPhase] || []) : [];

  const ticks = useMemo(() => {
    const headMagnitude = Math.min(1.5, Math.hypot(yaw, pitch) / 16);

    // Collect all tick indices that are completed
    const completedTickSet = new Set<number>();
    for (const p of completedPhases) {
      const range = PHASE_TICK_RANGES[p];
      if (range) {
        range.forEach((idx) => completedTickSet.add(idx));
      }
    }

    return Array.from({ length: TOTAL_TICKS }).map((_, i) => {
      const angleDeg = (i * 360) / TOTAL_TICKS;
      const angleRad = (angleDeg * Math.PI) / 180;

      // 1. Is this specific tick completed?
      const isCompleted = completedTickSet.has(i);

      // 2. Is this tick in the active target guidance sector?
      const isTargetSector = !isCompleted && activeTargetTicks.includes(i);

      // 3. Dynamic proximity to user's live gaze direction (only on uncompleted ticks)
      let proximity = 0;
      if (!isCompleted && hasFace && faceAngle !== null) {
        let diff = Math.abs(angleDeg - faceAngle);
        if (diff > 180) diff = 360 - diff;
        if (diff < 55) {
          proximity = (1 - diff / 55) * headMagnitude;
        }
      }

      // 4. Idle wave (only when no face is detected)
      let idleWave = 0;
      if (!isCompleted && !hasFace) {
        idleWave = Math.sin((i / TOTAL_TICKS) * Math.PI * 2 - wavePhase) * 0.5 + 0.5;
      }

      // Calculate Length & Thickness
      const baseLength = 10;
      const extraLength = isCompleted
        ? 15
        : hasFace
        ? proximity * 22 + (isTargetSector ? 4 : 0)
        : idleWave * 6;
      const length = baseLength + extraLength;

      const strokeWidth = isCompleted
        ? 3.6
        : hasFace
        ? (proximity > 0.3 ? 3.2 : isTargetSector ? 2.4 : 1.8)
        : (1.5 + idleWave * 1.2);

      // Coordinates
      const x1 = 180 + RADIUS * Math.cos(angleRad);
      const y1 = 180 + RADIUS * Math.sin(angleRad);
      const x2 = 180 + (RADIUS + length) * Math.cos(angleRad);
      const y2 = 180 + (RADIUS + length) * Math.sin(angleRad);

      let stroke = "rgba(255, 255, 255, 0.2)"; // idle translucent white
      if (isCompleted) {
        stroke = "#34c759"; // completed Apple green
      } else if (hasFace && proximity > 0.25) {
        stroke = isGoodPose ? "#34c759" : "var(--brand-primary, #0071e3)";
      } else if (isTargetSector) {
        stroke = "rgba(255, 255, 255, 0.55)"; // target sector hint
      } else if (!hasFace) {
        stroke = `rgba(255, 255, 255, ${0.15 + idleWave * 0.25})`;
      }

      return { i, x1, y1, x2, y2, stroke, strokeWidth, isCompleted, proximity };
    });
  }, [completedPhases, activeTargetTicks, faceAngle, hasFace, isGoodPose, wavePhase, yaw, pitch]);

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
        <filter id="reticleGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Guide Ring */}
      <circle
        cx="180"
        cy="180"
        r={RADIUS}
        fill="none"
        stroke={isGoodPose ? "rgba(52, 199, 89, 0.5)" : "rgba(255, 255, 255, 0.12)"}
        strokeWidth="1.5"
        strokeDasharray={isGoodPose ? "none" : "4 4"}
      />

      {/* Inner Mask Guide Ring */}
      <circle
        cx="180"
        cy="180"
        r={RADIUS - 8}
        fill="none"
        stroke={isGoodPose ? "#34c759" : "rgba(255, 255, 255, 0.2)"}
        strokeWidth={isGoodPose ? "2" : "1"}
      />

      {/* 48 Dynamic Apple Radial Ticks */}
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
          filter={t.isCompleted || t.proximity > 0.4 ? "url(#reticleGlow)" : undefined}
          style={{
            transition: "stroke 0.08s ease, stroke-width 0.08s ease",
          }}
        />
      ))}
    </svg>
  );
};
