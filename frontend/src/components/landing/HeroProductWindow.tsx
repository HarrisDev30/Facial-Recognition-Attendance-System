import React, { useState, useEffect, useRef } from "react";
import {
  IconCamera,
  IconActivity,
  IconShieldCheck,
  IconCheck,
  IconScan,
  IconCpu,
  IconLock,
  IconServer,
  IconDatabase,
} from "@tabler/icons-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export const HeroProductWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"scanner" | "stream" | "privacy">("scanner");
  const [tickerCount, setTickerCount] = useState(482);
  const [currentAttendeeIndex, setCurrentAttendeeIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const sampleAttendees = [
    { name: "Maria Santos", id: "2023-0142", dept: "College of Computing", match: "99.6%", latency: "7.2ms" },
    { name: "John Mark Reyes", id: "2022-0891", dept: "College of Business", match: "99.2%", latency: "8.1ms" },
    { name: "Alyssa Nicole Cruz", id: "2024-0318", dept: "College of Engineering", match: "99.8%", latency: "6.9ms" },
    { name: "David James Tan", id: "2021-1205", dept: "College of Arts & Sciences", match: "99.4%", latency: "7.6ms" },
  ];

  // Cycling simulated check-ins
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerCount((prev) => prev + 1);
      setCurrentAttendeeIndex((prev) => (prev + 1) % sampleAttendees.length);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  const activeAttendee = sampleAttendees[currentAttendeeIndex];

  useGSAP(
    () => {
      // 3D subtle mouse-tracking / float effect
      gsap.fromTo(
        containerRef.current,
        { y: 30, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: "power3.out" }
      );
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="hero-product-window">
      {/* Window Titlebar */}
      <div className="product-window-header">
        <div className="window-controls">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="window-title">attendify-node-gateway // entrance-kiosk-01</span>
        </div>

        {/* Tab Controls */}
        <div className="product-tab-controls">
          <button
            className={`product-tab-btn ${activeTab === "scanner" ? "active" : ""}`}
            onClick={() => setActiveTab("scanner")}
          >
            <IconCamera size={14} />
            <span>Live Scanner</span>
          </button>
          <button
            className={`product-tab-btn ${activeTab === "stream" ? "active" : ""}`}
            onClick={() => setActiveTab("stream")}
          >
            <IconActivity size={14} />
            <span>Live Stream</span>
          </button>
          <button
            className={`product-tab-btn ${activeTab === "privacy" ? "active" : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            <IconShieldCheck size={14} />
            <span>Vector Shield</span>
          </button>
        </div>
      </div>

      {/* Window Body Content */}
      <div className="product-window-body">
        {activeTab === "scanner" && (
          <div className="telemetry-scanner-view">
            {/* Viewport simulation */}
            <div className="camera-viewport-mock">
              <div className="detection-zone-box">
                <span className="zone-label">DETECTION_ZONE_ACTIVE [640x480]</span>
                <div className="face-bounding-reticle">
                  <div className="reticle-corner tl" />
                  <div className="reticle-corner tr" />
                  <div className="reticle-corner bl" />
                  <div className="reticle-corner br" />
                  <div className="reticle-scan-line" />
                  <div className="face-id-tag">
                    <IconCheck size={12} color="#10b981" />
                    <span>{activeAttendee.name}</span>
                    <span className="match-pct">{activeAttendee.match}</span>
                  </div>
                </div>
              </div>

              <div className="viewport-overlay-stats">
                <div className="stat-pill">
                  <IconCpu size={12} />
                  <span>InsightFace Buffalo_L</span>
                </div>
                <div className="stat-pill highlight">
                  <IconServer size={12} />
                  <span>FAISS: {activeAttendee.latency}</span>
                </div>
                <div className="stat-pill">
                  <span>30.0 FPS // 1080p</span>
                </div>
              </div>
            </div>

            {/* Side Telemetry Sidebar */}
            <div className="telemetry-sidebar">
              <div className="telemetry-card">
                <span className="telemetry-label">CURRENT VERIFICATION</span>
                <h4 className="telemetry-value text-emerald">{activeAttendee.name}</h4>
                <div className="telemetry-meta">
                  <span>ID: <code>{activeAttendee.id}</code></span>
                  <span>{activeAttendee.dept}</span>
                </div>
              </div>

              <div className="telemetry-card">
                <span className="telemetry-label">INFERENCE METRICS</span>
                <div className="telemetry-row">
                  <span>Embedding Vector</span>
                  <span className="mono-val">512 Dimensions (Float32)</span>
                </div>
                <div className="telemetry-row">
                  <span>Similarity Distance</span>
                  <span className="mono-val text-cyan">0.814 (Cosine L2)</span>
                </div>
                <div className="telemetry-row">
                  <span>Pose Head Yaw/Pitch</span>
                  <span className="mono-val">-1.4° / +0.8° (Optimal)</span>
                </div>
                <div className="telemetry-row">
                  <span>Session Cooldown</span>
                  <span className="mono-val text-emerald">Active (10s lock)</span>
                </div>
              </div>

              <div className="telemetry-status-badge">
                <span className="pulse-indicator" />
                <span>SERVER RECOGNITION ONLINE &bull; PARTITIONED FAISS LOADED</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "stream" && (
          <div className="telemetry-stream-view">
            <div className="stream-header-metrics">
              <div className="stream-metric-box">
                <span className="metric-title">TOTAL ATTENDANCE TODAY</span>
                <span className="metric-number">{tickerCount}</span>
                <span className="metric-trend text-emerald">+18 in last 5 mins</span>
              </div>
              <div className="stream-metric-box">
                <span className="metric-title">AVERAGE VERIFICATION TIME</span>
                <span className="metric-number">7.4ms</span>
                <span className="metric-trend text-cyan">Server-Side GPU Accelerated</span>
              </div>
              <div className="stream-metric-box">
                <span className="metric-title">ACTIVE GATES / SCANNERS</span>
                <span className="metric-number">4 Kiosks</span>
                <span className="metric-trend">2 Mobile Marshals</span>
              </div>
            </div>

            <div className="stream-table-container">
              <div className="stream-table-header">
                <span>TIME</span>
                <span>ATTENDEE NAME</span>
                <span>STUDENT / STAFF ID</span>
                <span>ORGANIZATION</span>
                <span>STATUS</span>
              </div>
              <div className="stream-table-rows">
                {sampleAttendees.map((att, idx) => (
                  <div key={idx} className="stream-table-row">
                    <span className="mono-val">10:42:{15 + idx * 4} AM</span>
                    <span className="font-semibold">{att.name}</span>
                    <span className="mono-val">{att.id}</span>
                    <span className="dept-tag">{att.dept}</span>
                    <span className="status-tag success">Verified ({att.match})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className="telemetry-privacy-view">
            <div className="privacy-illustration-grid">
              <div className="privacy-step-box">
                <div className="step-icon-circle">
                  <IconScan size={24} />
                </div>
                <h5>1. Frame Ingestion</h5>
                <p>Transient video frame captured in server RAM. Never written to disk or storage.</p>
              </div>

              <div className="privacy-step-arrow">&rarr;</div>

              <div className="privacy-step-box highlighted">
                <div className="step-icon-circle">
                  <IconCpu size={24} />
                </div>
                <h5>2. 512D Vectorization</h5>
                <p>InsightFace converts facial geometry into irreversible 512-dimensional floating-point vectors.</p>
              </div>

              <div className="privacy-step-arrow">&rarr;</div>

              <div className="privacy-step-box">
                <div className="step-icon-circle text-emerald">
                  <IconDatabase size={24} />
                </div>
                <h5>3. 0 Raw Bytes Saved</h5>
                <p>Original image immediately purged from memory. Only mathematical hashes are stored.</p>
              </div>
            </div>

            <div className="privacy-compliance-callout">
              <IconLock size={20} color="#10b981" />
              <div>
                <strong>Data Privacy Act of 2012 (RA 10173) Compliant Architecture</strong>
                <p>
                  Zero permanent raw photos on server disks. Students maintain absolute ownership with instant
                  self-service biometric data removal.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
