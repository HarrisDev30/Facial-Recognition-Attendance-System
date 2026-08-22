import React, { useRef, useState, useCallback } from "react";
import {
  IconScan,
  IconCpu,
  IconServer,
  IconDatabase,
  IconBolt,
  IconCheck,
  IconRadar,
  IconLockCheck,
} from "@tabler/icons-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export const ScrollPipelineSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const beamFillRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(1);
  const activeStageRef = useRef(1);

  const stages = [
    {
      number: 1,
      tag: "STEP 01 // ENTRANCE CAPTURE",
      title: "Doorway Focus & Crowd Filtering",
      icon: <IconScan size={22} />,
      desc: "As attendees approach the entrance kiosk, the camera focuses exclusively on individuals passing through the active doorway, automatically ignoring background passersby and distant crowd faces.",
      metricTitle: "ACCURACY FILTER",
      metricValue: "Filters Out Background Passersby",
    },
    {
      number: 2,
      tag: "STEP 02 // SECURE CONVERSION",
      title: "Facial Geometry Verification",
      icon: <IconCpu size={22} />,
      desc: "The system instantly converts facial features into a secure, mathematical code in temporary server memory. The original camera picture is deleted immediately to protect student privacy.",
      metricTitle: "PRIVACY PROTECTION",
      metricValue: "Zero Photos Saved to Disk",
    },
    {
      number: 3,
      tag: "STEP 03 // HIGH-SPEED LOOKUP",
      title: "Instant Student Identification",
      icon: <IconServer size={22} />,
      desc: "The mathematical code is matched against the university's student roster in milliseconds, accurately confirming the student's identity even across large campus enrollments.",
      metricTitle: "MATCH SPEED",
      metricValue: "Under 10ms Verification Time",
    },
    {
      number: 4,
      tag: "STEP 04 // ATTENDANCE RECORDED",
      title: "Verified Log & Duplicate Prevention",
      icon: <IconDatabase size={22} />,
      desc: "Attendance is officially recorded in the institutional database while automatically preventing duplicate check-ins if a student passes by the entrance multiple times.",
      metricTitle: "RECORDS INTEGRITY",
      metricValue: "Instant Sync • No Duplicate Logs",
    },
  ];

  // Throttled stage setter to prevent React state thrashing during rapid scroll
  const handleStageChange = useCallback((newStage: number) => {
    if (activeStageRef.current !== newStage) {
      activeStageRef.current = newStage;
      setActiveStage(newStage);
    }
  }, []);

  // Smoothly scroll and glide into target stage on pill or telemetry visual click
  const handlePillClick = useCallback((stageNumber: number) => {
    handleStageChange(stageNumber);

    const targetCard = document.getElementById(`pipeline-stage-${stageNumber}`);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [handleStageChange]);

  const isFirstRender = useRef(true);

  // Choreographed GSAP Timeline for Telemetry Visual Morphing (only on actual stage change)
  useGSAP(
    () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }

      if (visualRef.current) {
        gsap.fromTo(
          visualRef.current,
          { opacity: 0.7, scale: 0.98 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.28,
            ease: "power2.out",
            force3D: true,
            overwrite: "auto",
          }
        );
      }
    },
    { dependencies: [activeStage], scope: hudRef }
  );

  // GSAP ScrollTrigger setup: Stage Cards & Inertial Data Beam
  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>(".pipeline-stage-card");

      // 1. Unified Bidirectional Pipeline In-Out Timeline (Hero -> Pipeline -> Hardware)
      if (containerRef.current && hudRef.current) {
        const sectionTl = gsap.timeline({
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 95%",
            end: "bottom 15%",
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        sectionTl
          // Phase 1: Entrance Fade from Hero (0% - 18% of scroll)
          .fromTo(
            [".section-header-center", hudRef.current, ".pipeline-cards-column"],
            { opacity: 0, y: 45 },
            { opacity: 1, y: 0, duration: 0.18, ease: "power1.out", force3D: true, stagger: 0.04 }
          )
          // Phase 2: Active Pipeline Stages (18% - 82% of scroll)
          .to([".section-header-center", hudRef.current, ".pipeline-cards-column"], {
            opacity: 1,
            duration: 0.64,
          })
          // Phase 3: Exit Fade into Hardware (82% - 100% of scroll)
          .to([".section-header-center", hudRef.current, ".pipeline-cards-column"], {
            opacity: 0,
            y: -45,
            duration: 0.18,
            ease: "power1.in",
            force3D: true,
          });
      }

      // 2. Smooth Inertial Data-Flow Beam (scrub: 0.8 provides silky momentum lag)
      if (beamFillRef.current && containerRef.current) {
        gsap.fromTo(
          beamFillRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            transformOrigin: "top center",
            force3D: true,
            scrollTrigger: {
              trigger: ".pipeline-cards-column",
              start: "top 60%",
              end: "bottom 70%",
              scrub: 0.8,
            },
          }
        );
      }

      // 3. Stage Card ScrollTriggers with smooth entry transitions
      cards.forEach((card, index) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top 55%",
          end: "bottom 55%",
          onEnter: () => handleStageChange(index + 1),
          onEnterBack: () => handleStageChange(index + 1),
        });

        gsap.fromTo(
          card,
          { opacity: 0, y: 35 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            force3D: true,
            overwrite: "auto",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} id="pipeline" className="pipeline-section">
      <div className="section-header-center">
        <div className="section-eyebrow">
          <IconBolt size={14} />
          <span>TECHNICAL ARCHITECTURE</span>
        </div>
        <h2 className="section-title">The 4-Stage Biometric Pipeline</h2>
        <p className="section-subtitle">
          How video frames transform into verified institutional attendance in milliseconds.
          Engineered for high accuracy and total privacy.
        </p>
      </div>

      <div className="pipeline-grid">
        {/* Sticky Visual HUD with Smooth GSAP Pinning (Left Column) */}
        <div className="pipeline-hud-wrapper">
          <div ref={hudRef} className="pipeline-sticky-hud">
            <div className="hud-header">
              <div className="hud-header-left">
                <span className="hud-status-dot pulse-active" />
                <span className="hud-title">ACTIVE PROCESSING STAGE</span>
              </div>
              <span className="hud-stage-counter">STAGE 0{activeStage} / 04</span>
            </div>

            {/* Dynamic Stage Visual Indicator with Smooth 3D Flip Perspective */}
            <div
              ref={visualRef}
              className="hud-stage-visual hud-stage-3d-perspective interactive-telemetry-window"
              onClick={() => handlePillClick((activeStage % 4) + 1)}
              title="Click to jump to next stage"
            >
              {activeStage === 1 && (
                <div className="hud-visual-state state-opencv">
                  <div className="visual-scan-box">
                    <span className="zone-tag">DOORWAY_ROI_ZONE</span>
                    <div className="filter-crosshair" />
                    <div className="reticle-corner tl" />
                    <div className="reticle-corner tr" />
                    <div className="reticle-corner bl" />
                    <div className="reticle-corner br" />
                  </div>
                  <div className="visual-caption-box">
                    <IconRadar size={14} color="#00dfd8" />
                    <span className="visual-caption">OpenCV Spatial Entrance Zone [Active]</span>
                  </div>
                </div>
              )}

              {activeStage === 2 && (
                <div className="hud-visual-state state-insightface">
                  <div className="visual-vector-graphic">
                    <div className="vector-nodes-grid">
                      {[...Array(16)].map((_, i) => (
                        <span key={i} className="vector-node-dot" />
                      ))}
                    </div>
                    <div className="laser-sweep-bar" />
                  </div>
                  <div className="visual-caption-box">
                    <IconCpu size={14} color="#38bdf8" />
                    <span className="visual-caption">InsightFace Buffalo_L 512D Vectorization</span>
                  </div>
                </div>
              )}

              {activeStage === 3 && (
                <div className="hud-visual-state state-faiss">
                  <div className="visual-faiss-index">
                    <div className="faiss-cluster">
                      <span className="cluster-center" />
                      <span className="query-node active-pulse" />
                      <span className="cluster-satellite sat-1" />
                      <span className="cluster-satellite sat-2" />
                    </div>
                    <div className="faiss-latency-meter">
                      <span>FAISS LATENCY: 7.2ms</span>
                      <span className="text-cyan">COSINE MATCH: 0.82</span>
                    </div>
                  </div>
                  <div className="visual-caption-box">
                    <IconServer size={14} color="#00dfd8" />
                    <span className="visual-caption">Sub-linear Partitioned Nearest-Neighbor</span>
                  </div>
                </div>
              )}

              {activeStage === 4 && (
                <div className="hud-visual-state state-database">
                  <div className="visual-db-success">
                    <div className="success-pulse-circle">
                      <IconCheck size={32} color="#10b981" />
                    </div>
                    <div className="db-tags-group">
                      <span className="cooldown-active-tag">COOLDOWN_LOCK: 10s</span>
                      <span className="acid-guarantee-tag">ACID VERIFIED</span>
                    </div>
                  </div>
                  <div className="visual-caption-box">
                    <IconLockCheck size={14} color="#10b981" />
                    <span className="visual-caption">PostgreSQL Transaction Committed</span>
                  </div>
                </div>
              )}
            </div>

            {/* Active Stage Quick Progress Pills */}
            <div className="hud-stage-progress-pills">
              {stages.map((stg) => (
                <div
                  key={stg.number}
                  className={`progress-pill-item ${activeStage === stg.number ? "active" : ""} ${
                    activeStage > stg.number ? "completed" : ""
                  }`}
                  onClick={() => handlePillClick(stg.number)}
                  title={`Jump to Stage ${stg.number}: ${stg.title}`}
                >
                  <span className="pill-dot" />
                  <span className="pill-text">Stage {stg.number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scrolling Stage Cards with Data-Flow Beam Spine (Right Column) */}
        <div className="pipeline-cards-wrapper">
          {/* Vertical Illuminated Data-Flow Beam Spine */}
          <div className="pipeline-beam-spine" aria-hidden="true">
            {/* Background Track Line */}
            <div className="beam-track-line" />

            {/* Glowing Active Beam Fill (GPU scaleY accelerated) */}
            <div ref={beamFillRef} className="beam-fill-glow" />

            {/* 4 Node Connectors */}
            {stages.map((stg) => (
              <div
                key={stg.number}
                className={`beam-stage-node node-${stg.number} ${
                  activeStage >= stg.number ? "active" : ""
                } ${activeStage === stg.number ? "current-pulse" : ""}`}
                onClick={() => handlePillClick(stg.number)}
                style={{ cursor: "pointer" }}
              >
                <div className="node-inner-dot" />
                <div className="node-halo-ring" />
              </div>
            ))}
          </div>

          <div className="pipeline-cards-column">
            {stages.map((stage) => (
              <div
                key={stage.number}
                id={`pipeline-stage-${stage.number}`}
                className={`pipeline-stage-card ${activeStage === stage.number ? "is-focused" : ""}`}
                onMouseEnter={() => handleStageChange(stage.number)}
                onClick={() => handlePillClick(stage.number)}
              >
                <div className="stage-card-header">
                  <div className="stage-card-icon-box">{stage.icon}</div>
                  <div className="stage-card-tags">
                    <span className="stage-tag-code">{stage.tag}</span>
                    <span className="stage-number-badge">0{stage.number}</span>
                  </div>
                </div>

                <h3 className="stage-card-title">{stage.title}</h3>
                <p className="stage-card-desc">{stage.desc}</p>

                <div className="stage-metric-footer">
                  <span className="metric-tag">{stage.metricTitle}</span>
                  <span className="metric-result">{stage.metricValue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
