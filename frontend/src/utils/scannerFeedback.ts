/**
 * scannerFeedback.ts
 * Multi-Sensory Gate Feedback Engine:
 * - Real-Time Synthesized Audio Chimes (Web Audio API - 0ms latency, zero asset downloads)
 * - Tactile Device Vibration (Navigator Vibrate API)
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Positive Gate Pass Sensory Cue
 * - Audio: High-harmonic pleasant bell (880Hz -> 1318Hz)
 * - Haptic: Single crisp 60ms pulse
 */
export function playSuccessFeedback() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.09); // E6

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    }

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(60);
    }
  } catch {
    // Fail gracefully if device audio is muted or policy restricted
  }
}

/**
 * Gate Warning / Rejection Sensory Cue
 * - Audio: Cautionary low-tone double buzz (340Hz -> 200Hz)
 * - Haptic: Heavy double-pulse vibration [100ms, 60ms gap, 100ms]
 */
export function playFailedFeedback() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.16);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    }

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([100, 60, 100]);
    }
  } catch {
    // Fail gracefully
  }
}
