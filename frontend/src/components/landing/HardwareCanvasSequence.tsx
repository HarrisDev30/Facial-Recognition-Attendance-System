import React, { useRef, useEffect, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const TOTAL_FRAMES = 192;

const formatFrameNum = (num: number): string => {
  return String(num).padStart(3, "0");
};

export const HardwareCanvasSequence: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const laptopCanvasRef = useRef<HTMLCanvasElement>(null);

  const phoneImagesRef = useRef<HTMLImageElement[]>([]);
  const laptopImagesRef = useRef<HTMLImageElement[]>([]);
  const phoneLoadedCountRef = useRef(0);
  const laptopLoadedCountRef = useRef(0);
  const currentProgressRef = useRef(0);

  const [currentStage, setCurrentStage] = useState<"phone" | "laptop">("phone");

  // High-DPI canvas drawing with balanced device proportions (Laptop 86%, Phone 94%)
  const drawFrame = useCallback(
    (
      canvas: HTMLCanvasElement | null,
      images: HTMLImageElement[],
      frameIndex: number,
      deviceType: "phone" | "laptop"
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const safeIndex = Math.max(0, Math.min(frameIndex, TOTAL_FRAMES - 1));
      const img = images[safeIndex];
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      if (displayWidth === 0 || displayHeight === 0) return;

      const targetCanvasWidth = Math.round(displayWidth * dpr);
      const targetCanvasHeight = Math.round(displayHeight * dpr);

      if (
        canvas.width !== targetCanvasWidth ||
        canvas.height !== targetCanvasHeight
      ) {
        canvas.width = targetCanvasWidth;
        canvas.height = targetCanvasHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // ✂️ Precision Edge Trim: Trims 2.5% X / 3.0% Y to eliminate any outer dark edge lines
      const cropMarginX = img.naturalWidth * 0.025;
      const cropMarginY = img.naturalHeight * 0.030;
      const sourceW = img.naturalWidth - cropMarginX * 2;
      const sourceH = img.naturalHeight - cropMarginY * 2;

      const imgRatio = sourceW / sourceH;
      const canvasRatio = canvas.width / canvas.height;

      // ⚖️ Balanced Proportions: Laptop uses 86% scale, Phone uses 94% scale
      const FIT_SCALE = deviceType === "laptop" ? 0.86 : 0.94;
      let drawW: number;
      let drawH: number;

      if (canvasRatio > imgRatio) {
        drawH = canvas.height * FIT_SCALE;
        drawW = drawH * imgRatio;
      } else {
        drawW = canvas.width * FIT_SCALE;
        drawH = drawW / imgRatio;
      }

      const offsetX = (canvas.width - drawW) / 2;
      const offsetY = (canvas.height - drawH) / 2;

      ctx.drawImage(
        img,
        cropMarginX,
        cropMarginY,
        sourceW,
        sourceH,
        offsetX,
        offsetY,
        drawW,
        drawH
      );
    },
    []
  );

  // Helper to render frame based on scroll ratio
  const renderCurrentScroll = useCallback((p: number) => {
    currentProgressRef.current = p;
    const isPhone = p < 0.46;
    if (isPhone) {
      const phoneRatio = Math.max(0, Math.min(p / 0.42, 1));
      const phoneFrame = Math.min(Math.floor(phoneRatio * TOTAL_FRAMES), TOTAL_FRAMES - 1);
      drawFrame(phoneCanvasRef.current, phoneImagesRef.current, phoneFrame, "phone");
    } else {
      const laptopRatio = Math.max(0, Math.min((p - 0.46) / 0.48, 1));
      const laptopFrame = Math.min(Math.floor(laptopRatio * TOTAL_FRAMES), TOTAL_FRAMES - 1);
      drawFrame(laptopCanvasRef.current, laptopImagesRef.current, laptopFrame, "laptop");
    }
  }, [drawFrame]);

  // 1. Asynchronously preload both 192-frame pristine original WebP sequences into memory
  useEffect(() => {
    let isCancelled = false;
    phoneImagesRef.current = [];
    laptopImagesRef.current = [];
    phoneLoadedCountRef.current = 0;
    laptopLoadedCountRef.current = 0;

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const frameStr = formatFrameNum(i);

      // Preload Phone WebP
      const phoneImg = new Image();
      phoneImg.src = `/assets/objects/phone/frame-${frameStr}.webp`;
      phoneImg.onload = () => {
        if (isCancelled) return;
        phoneLoadedCountRef.current++;
        if (i === 1) {
          drawFrame(phoneCanvasRef.current, phoneImagesRef.current, 0, "phone");
        }
        if (phoneLoadedCountRef.current >= TOTAL_FRAMES && laptopLoadedCountRef.current >= TOTAL_FRAMES) {
          renderCurrentScroll(currentProgressRef.current);
          ScrollTrigger.refresh();
        }
      };
      phoneImagesRef.current.push(phoneImg);

      // Preload Laptop WebP
      const laptopImg = new Image();
      laptopImg.src = `/assets/objects/laptop/frame-${frameStr}.webp`;
      laptopImg.onload = () => {
        if (isCancelled) return;
        laptopLoadedCountRef.current++;
        if (i === 1) {
          drawFrame(laptopCanvasRef.current, laptopImagesRef.current, 0, "laptop");
        }
        if (phoneLoadedCountRef.current >= TOTAL_FRAMES && laptopLoadedCountRef.current >= TOTAL_FRAMES) {
          renderCurrentScroll(currentProgressRef.current);
          ScrollTrigger.refresh();
        }
      };
      laptopImagesRef.current.push(laptopImg);
    }

    return () => {
      isCancelled = true;
    };
  }, [drawFrame, renderCurrentScroll]);

  // 2. Deterministic, Single-Instance Bidirectional Scroll Engine
  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) return;

      // Draw initial frames immediately on both canvases
      drawFrame(phoneCanvasRef.current, phoneImagesRef.current, 0, "phone");
      drawFrame(laptopCanvasRef.current, laptopImagesRef.current, 0, "laptop");

      const mm = gsap.matchMedia();

      mm.add("(min-width: 100px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            id: "hardware-trigger",
            trigger: container,
            start: "top top",
            end: "+=320%",
            pin: true,
            scrub: 0.35,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
            preventOverlaps: true,
            onUpdate: (self) => {
              const p = self.progress;
              setCurrentStage(p < 0.46 ? "phone" : "laptop");
              renderCurrentScroll(p);
            },
          },
        });

        // ══════════════════════════════════════════════
        // 📱 STAGE 1: PHONE (0.00 -> 0.42)
        // ══════════════════════════════════════════════
        tl.fromTo(
          ".minimal-phone-stage",
          { opacity: 1, scale: 1, y: 0, pointerEvents: "auto" },
          { opacity: 1, scale: 1, y: 0, duration: 0.40, ease: "none" },
          0
        );

        // Phone Beat 1: "No app install." (Enters 0.04 -> Exits 0.22)
        tl.fromTo(
          ".phone-beat-1",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" },
          0.04
        ).to(
          ".phone-beat-1",
          { opacity: 0, y: -20, duration: 0.05, ease: "power2.in" },
          0.18
        );

        // Phone Beat 2: "Roam freely." (Enters 0.23 -> Exits 0.39)
        tl.fromTo(
          ".phone-beat-2",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" },
          0.23
        ).to(
          ".phone-beat-2",
          { opacity: 0, y: -20, duration: 0.05, ease: "power2.in" },
          0.35
        );

        // ══════════════════════════════════════════════
        // 🔄 SEAMLESS CROSSFADE MORPH (0.40 -> 0.48)
        // ══════════════════════════════════════════════
        tl.to(
          ".minimal-phone-stage",
          {
            opacity: 0,
            scale: 0.96,
            y: -16,
            duration: 0.07,
            ease: "power2.inOut",
            pointerEvents: "none",
          },
          0.40
        );

        tl.fromTo(
          ".minimal-laptop-stage",
          { opacity: 0, scale: 0.96, y: 16, pointerEvents: "none" },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.07,
            ease: "power2.inOut",
            pointerEvents: "auto",
          },
          0.44
        );

        // ══════════════════════════════════════════════
        // 💻 STAGE 2: LAPTOP (0.48 -> 0.95)
        // ══════════════════════════════════════════════
        // Laptop Beat 1: "Use what you have." (Enters 0.50 -> Exits 0.68)
        tl.fromTo(
          ".laptop-beat-1",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" },
          0.50
        ).to(
          ".laptop-beat-1",
          { opacity: 0, y: -20, duration: 0.05, ease: "power2.in" },
          0.64
        );

        // Laptop Beat 2: "No paper sheets." (Enters 0.69 -> Exits 0.88)
        tl.fromTo(
          ".laptop-beat-2",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" },
          0.69
        ).to(
          ".laptop-beat-2",
          { opacity: 0, y: -20, duration: 0.05, ease: "power2.in" },
          0.84
        );

        // Hold timeline steady at end
        tl.to({}, { duration: 0.05 }, 0.95);
      });

      let resizeTimer: ReturnType<typeof setTimeout>;
      const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          renderCurrentScroll(currentProgressRef.current);
          ScrollTrigger.refresh();
        }, 120);
      };

      window.addEventListener("resize", handleResize);
      return () => {
        clearTimeout(resizeTimer);
        window.removeEventListener("resize", handleResize);
      };
    },
    { scope: containerRef, dependencies: [drawFrame, renderCurrentScroll] }
  );

  return (
    <section ref={containerRef} id="hardware" className="apple-minimal-hardware-section">
      <div className="apple-minimal-container">
        
        {/* ─── STAGE 1: HERO PHONE ─── */}
        <div className="apple-device-stage minimal-phone-stage">
          <div className="floating-stage-top">
            <h2 className="minimal-title">Your everyday phone.</h2>
          </div>

          <div className="floating-canvas-stage">
            {/* Beat 1 (Left Side): No App Install */}
            <div className="side-annotation-block block-left phone-beat-1">
              <h3 className="side-annotation-title">No app install.</h3>
              <p className="side-annotation-desc">
                Opens directly in Safari or Chrome.
              </p>
            </div>

            {/* Center Canvas */}
            <div className="minimal-hero-canvas-wrapper">
              <canvas
                ref={phoneCanvasRef}
                className="apple-hero-canvas"
                aria-label="3D Spinning smartphone hardware scroll animation"
              />
            </div>

            {/* Beat 2 (Right Side): Roam Freely */}
            <div className="side-annotation-block block-right phone-beat-2">
              <h3 className="side-annotation-title">Roam freely.</h3>
              <p className="side-annotation-desc">
                Marshals walk aisles and scan on the move.
              </p>
            </div>
          </div>

          <div className="floating-stage-bottom">
            <p className="minimal-caption">
              Pair any smartphone in seconds. Roaming marshals walk
              freely through crowds and log attendee check-ins in real time.
            </p>
          </div>
        </div>

        {/* ─── STAGE 2: HERO LAPTOP ─── */}
        <div className="apple-device-stage minimal-laptop-stage">
          <div className="floating-stage-top">
            <h2 className="minimal-title">Your standard laptop.</h2>
          </div>

          <div className="floating-canvas-stage">
            {/* Beat 1 (Left Side): Use What You Have */}
            <div className="side-annotation-block block-left laptop-beat-1">
              <h3 className="side-annotation-title">Use what you have.</h3>
              <p className="side-annotation-desc">
                Works with your built-in webcam.
              </p>
            </div>

            {/* Center Canvas */}
            <div className="minimal-hero-canvas-wrapper">
              <canvas
                ref={laptopCanvasRef}
                className="apple-hero-canvas"
                aria-label="3D Opening laptop hardware scroll animation"
              />
            </div>

            {/* Beat 2 (Right Side): No Paper Sheets */}
            <div className="side-annotation-block block-right laptop-beat-2">
              <h3 className="side-annotation-title">No paper sheets.</h3>
              <p className="side-annotation-desc">
                Attendees walk in with zero bottlenecks.
              </p>
            </div>
          </div>

          <div className="floating-stage-bottom">
            <p className="minimal-caption">
              Set up on any desk with a standard webcam. Students are verified
              seamlessly as they walk through the door, clearing queues with zero friction.
            </p>
          </div>
        </div>

        {/* Tight, Minimalist Stage Indicator */}
        <div className="apple-stage-indicator" aria-hidden="true">
          <span className={`indicator-pill ${currentStage === "phone" ? "active" : ""}`}>
            Phone
          </span>
          <span className="indicator-divider">/</span>
          <span className={`indicator-pill ${currentStage === "laptop" ? "active" : ""}`}>
            Laptop
          </span>
        </div>

      </div>
    </section>
  );
};
