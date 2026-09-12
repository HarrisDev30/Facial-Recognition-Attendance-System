import React, { useRef } from "react";
import {
  IconScan,
  IconShieldCheck,
  IconBolt,
  IconCircleCheck,
  IconLock,
  IconUserCheck,
  IconFocus2,
  IconEyeOff,
  IconClock,
  IconShieldLock,
} from "@tabler/icons-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface PipelineStage {
  id: number;
  title: string;
  description: string;
  highlights: string[];
  videoUrl?: string;
}

const STAGES: PipelineStage[] = [
  {
    id: 1,
    title: "Doorway Focus & Crowd Filtering",
    description:
      "As attendees approach the entrance, intelligent spatial zoning focuses exclusively on individuals passing through the doorway threshold, filtering out background passersby and distant crowd faces.",
    highlights: [
      "Active doorway boundary tracking",
      "Filters out passersby and hallway traffic",
      "Instant walking-speed detection",
    ],
  },
  {
    id: 2,
    title: "Mathematical Vectorization",
    description:
      "Facial geometry is converted into an encrypted mathematical vector in volatile memory. The raw camera photo is wiped immediately to ensure strict student privacy compliance.",
    highlights: [
      "Zero raw photos stored to disk",
      "Volatile RAM-only vectorization",
      "Complies with institutional data privacy",
    ],
  },
  {
    id: 3,
    title: "Instant Student Identification",
    description:
      "The secure vector is matched against the verified student roster in under 10 milliseconds, confirming enrollment even across university directories with tens of thousands of records.",
    highlights: [
      "Sub-10ms match latency",
      "High-accuracy vector indexing",
      "Frictionless walking-pace verification",
    ],
  },
  {
    id: 4,
    title: "Verified Log & Duplicate Lock",
    description:
      "Attendance records sync immediately with the institutional database. Smart cooldown locks automatically prevent duplicate check-ins if a student passes by the entrance multiple times.",
    highlights: [
      "Instant database transaction sync",
      "Intelligent duplicate cooldown locks",
      "Real-time marshal & kiosk confirmation",
    ],
  },
];

export const ScrollPipelineSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Simple, elegant GSAP ScrollTrigger reveals for each stage row
  useGSAP(
    () => {
      const rows = gsap.utils.toArray<HTMLElement>(".pipeline-scroll-row");

      rows.forEach((row) => {
        const copyCol = row.querySelector(".pipeline-copy-col");
        const mediaCol = row.querySelector(".pipeline-media-col");

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: row,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        });

        tl.fromTo(
          copyCol,
          { opacity: 0, y: 36 },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            ease: "power2.out",
            force3D: true,
          }
        ).fromTo(
          mediaCol,
          { opacity: 0, scale: 0.96, y: 28 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.85,
            ease: "power2.out",
            force3D: true,
          },
          "-=0.45"
        );
      });
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} id="pipeline" className="pipeline-section">
      <div className="pipeline-container">
        {/* Editorial Section Header (Unified with Hardware Showroom Typography) */}
        <div className="pipeline-header-center">
          <h2 className="pipeline-main-title">How it works.</h2>
          <p className="pipeline-main-subtitle">
            From doorway entrance to verified campus attendance in milliseconds.
            Engineered for high accuracy and total privacy.
          </p>
        </div>

        {/* Apple-Style Natural Scrollable Sequence (Alternating 2-Column Rows) */}
        <div className="pipeline-scroll-list">
          {STAGES.map((stage, index) => {
            const isReversed = index % 2 === 1;

            return (
              <div
                key={stage.id}
                className={`pipeline-scroll-row ${isReversed ? "is-reversed" : ""}`}
              >
                {/* Copy Column */}
                <div className="pipeline-copy-col">
                  <h3 className="pipeline-stage-title">{stage.title}</h3>
                  <p className="pipeline-stage-desc">{stage.description}</p>

                  <div className="pipeline-highlights-list">
                    {stage.highlights.map((h, i) => (
                      <div key={i} className="pipeline-highlight-item">
                        <div className="pipeline-highlight-icon">
                          <IconCircleCheck size={16} />
                        </div>
                        <span className="pipeline-highlight-text">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Media Column (Video or Coded High-Craft Showcase Preview) */}
                <div className="pipeline-media-col">
                  <div className="pipeline-media-viewport">
                    {stage.videoUrl ? (
                      <video
                        key={stage.videoUrl}
                        src={stage.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="pipeline-feature-video"
                      />
                    ) : (
                      /* High-Craft Coded Showcase Previews (Matching 4-Part Storyboard) */
                      <div className={`pipeline-preview-stage stage-${stage.id}`}>
                        {/* STAGE 1: Doorway Focus Aperture */}
                        {stage.id === 1 && (
                          <div className="stage-preview-doorway">
                            <div className="doorway-camera-frame">
                              <div className="aperture-bracket tl" />
                              <div className="aperture-bracket tr" />
                              <div className="aperture-bracket bl" />
                              <div className="aperture-bracket br" />

                              <div className="doorway-focus-box">
                                <div className="doorway-focus-ring">
                                  <IconFocus2 size={32} />
                                </div>
                                <span className="doorway-status-tag">DOORWAY LOCKED</span>
                              </div>

                              <div className="doorway-passerby-indicator">
                                <IconEyeOff size={14} />
                                <span>Passerby Filtered</span>
                              </div>
                            </div>

                            <div className="stage-preview-caption">
                              <IconScan size={15} />
                              <span>Real-time entrance perimeter active</span>
                            </div>
                          </div>
                        )}

                        {/* STAGE 2: Privacy Cryptographic Hash Token */}
                        {stage.id === 2 && (
                          <div className="stage-preview-privacy">
                            <div className="privacy-token-display">
                              <div className="privacy-shield-orb">
                                <IconShieldLock size={36} />
                              </div>

                              <div className="privacy-hash-capsule">
                                <span className="hash-label">RAM VECTOR</span>
                                <span className="hash-code">#7F9A:e48b:91c0:d22f:8041</span>
                              </div>

                              <div className="privacy-wiped-pill">
                                <span className="wiped-dot" />
                                <span>Raw camera photo wiped from memory</span>
                              </div>
                            </div>

                            <div className="stage-preview-caption">
                              <IconLock size={15} />
                              <span>Zero biometric images saved to disk</span>
                            </div>
                          </div>
                        )}

                        {/* STAGE 3: Sub-Second Student Roster Match */}
                        {stage.id === 3 && (
                          <div className="stage-preview-roster">
                            <div className="roster-match-card">
                              <div className="roster-avatar-box">
                                <IconUserCheck size={28} />
                              </div>

                              <div className="roster-student-info">
                                <span className="roster-student-name">Alex Chen</span>
                                <span className="roster-student-dept">
                                  BS Computer Science • ID #2024-8842
                                </span>
                              </div>

                              <div className="roster-verified-pill">
                                <IconCircleCheck size={14} />
                                <span>Verified</span>
                              </div>
                            </div>

                            <div className="roster-latency-strip">
                              <div className="latency-metric">
                                <IconBolt size={14} />
                                <span>
                                  Match Latency: <strong>6.8ms</strong>
                                </span>
                              </div>
                              <span className="latency-divider">•</span>
                              <span className="latency-status">High Confidence (99.4%)</span>
                            </div>

                            <div className="stage-preview-caption">
                              <IconClock size={15} />
                              <span>Sub-linear nearest-neighbor index lookup</span>
                            </div>
                          </div>
                        )}

                        {/* STAGE 4: Verified Log & Duplicate Lock */}
                        {stage.id === 4 && (
                          <div className="stage-preview-clearance">
                            <div className="clearance-wallet-card">
                              <div className="clearance-header">
                                <span className="clearance-inst-name">Attendify Campus Clearance</span>
                                <span className="clearance-timestamp">8:45 AM • Gate A</span>
                              </div>

                              <div className="clearance-body">
                                <div className="clearance-check-ring">
                                  <IconCircleCheck size={36} />
                                </div>
                                <span className="clearance-title">Attendance Logged</span>
                                <span className="clearance-room">Auditorium East • Session #104</span>
                              </div>

                              <div className="clearance-footer-pills">
                                <span className="cooldown-pill">
                                  <IconLock size={12} /> Cooldown Locked: 10s
                                </span>
                                <span className="sync-pill">
                                  <IconShieldCheck size={12} /> Synced Live
                                </span>
                              </div>
                            </div>

                            <div className="stage-preview-caption">
                              <IconShieldCheck size={15} />
                              <span>Database transaction committed & duplicate-protected</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
