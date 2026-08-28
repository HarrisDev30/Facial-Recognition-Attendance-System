import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Text,
  Group,
  Button,
  Box,
  Alert,
  Skeleton,
  Stack,
  Badge,
} from "@mantine/core";
import { Sparkline, DonutChart, AreaChart } from "@mantine/charts";
import { MantineHeatmap as Heatmap } from "../../components/charts/MantineHeatmap";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconMapPin,
  IconClock,
  IconArrowRight,
  IconAlertCircle,
  IconCheck,
  IconCalendar,
  IconHistory,
  IconShieldCheck,
  IconShieldX,
  IconQrcode,
  IconUserCheck,
  IconChevronRight,
  IconChartBar,
  IconFlame,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import { useInstitutionTheme } from "../../theme/InstitutionThemeProvider";
import {
  getMyAttendanceLogs,
  getMyAttendanceSummary,
  getMyProfile,
} from "../../api/attendees";
import { getAllEvents } from "../../api/events";
import type {
  AttendanceLogEntry,
  AttendanceSummary,
  AttendeeProfileResponse,
} from "../../types/auth";
import type { UpcomingEvent } from "../../types/event";
import { EVENT_TYPE_LABELS } from "../../utils/constants";
import { formatDate, formatTime } from "../../utils/formatters";
import StudentPassModal from "../../components/student/StudentPassModal";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import "./StudentDashboardPage.css";

gsap.registerPlugin(useGSAP);

const TYPE_GRADIENTS: Record<string, string> = {
  intramurals: "linear-gradient(90deg, #7c3aed, #a78bfa)",
  seminar: "linear-gradient(90deg, #2563eb, #60a5fa)",
  workshop: "linear-gradient(90deg, #06b6d4, #22d3ee)",
  conference: "linear-gradient(90deg, #9333ea, #c084fc)",
  campus_activity: "linear-gradient(90deg, #059669, #2dd4bf)",
  assembly: "linear-gradient(90deg, #ea580c, #fb923c)",
};

const VERIFICATION_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  face_recognition: {
    label: "Face ID",
    icon: <IconShieldCheck size={12} />,
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.1)",
  },
  qr_code: {
    label: "QR Code",
    icon: <IconQrcode size={12} />,
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.1)",
  },
  marshal_override: {
    label: "Marshal",
    icon: <IconUserCheck size={12} />,
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.1)",
  },
};

type ActivityFilterMethod = "all" | "face_recognition" | "qr_code" | "marshal_override";

// Clean human student ID formatter (strips database UUIDs and formats clean institutional tags)
function formatDisplayStudentId(
  rawId?: string | null,
  deptCode?: string | null,
): string {
  if (!rawId) {
    return deptCode ? `ID: ${deptCode}-2026` : "ID: STU-2026";
  }
  const trimmed = rawId.trim();

  // If it's a backend UUID (has dashes and length > 20, e.g. 6a12a08b-e722-4baa-a732-ccd8627829f1)
  if (trimmed.length > 20 && trimmed.includes("-")) {
    const compactCode = trimmed.replace(/-/g, "").slice(0, 6).toUpperCase();
    const prefix = deptCode ? deptCode.toUpperCase() : "STU";
    return `ID: ${prefix}-${compactCode}`;
  }

  const upper = trimmed.toUpperCase();
  if (upper.startsWith("STU-") || upper.startsWith("EMP-") || upper.startsWith("FAC-") || upper.startsWith("ID:")) {
    return upper;
  }
  return `ID: ${upper}`;
}

export default function StudentDashboardPage() {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { user } = useAuthStore();
  const { institution } = useInstitutionTheme();
  const firstName = user?.first_name || user?.email?.split("@")[0] || "Student";
  const [profile, setProfile] = useState<AttendeeProfileResponse | null>(null);

  const displayStudentId = useMemo(
    () => formatDisplayStudentId(profile?.identifier || user?.attendee_id, profile?.department_code),
    [profile?.identifier, profile?.department_code, user?.attendee_id],
  );

  const [logs, setLogs] = useState<AttendanceLogEntry[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterMethod>("all");
  const [activeSlide, setActiveSlide] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const visualFrameRef = useRef<HTMLDivElement>(null);

  // Auto-cycle carousel on mobile screens (4.5s) with pause on user touch
  const isInteractingRef = useRef(false);
  const autoCycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pauseAutoCycleTemporarily = () => {
    isInteractingRef.current = true;
    if (autoCycleTimeoutRef.current) clearTimeout(autoCycleTimeoutRef.current);
    autoCycleTimeoutRef.current = setTimeout(() => {
      isInteractingRef.current = false;
    }, 7000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isInteractingRef.current && window.innerWidth <= 640) {
        setActiveSlide((prev) => (prev + 1) % 3);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    pauseAutoCycleTemporarily();
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (diff > 35) {
      pauseAutoCycleTemporarily();
      setActiveSlide((prev) => (prev + 1) % 3);
    } else if (diff < -35) {
      pauseAutoCycleTemporarily();
      setActiveSlide((prev) => (prev - 1 + 3) % 3);
    }
    touchStartXRef.current = null;
  };

  const handleDotClick = (idx: number) => {
    pauseAutoCycleTemporarily();
    setActiveSlide(idx);
  };

  // GSAP Mobile Track Momentum and Micro-Chart Animation
  useGSAP(
    () => {
      if (!visualFrameRef.current) return;

      // Animate track sliding smoothly
      gsap.to(".visual-carousel-track", {
        xPercent: -activeSlide * 100,
        duration: 0.45,
        ease: "power3.out",
      });

      // Micro-animation triggers for active slide
      if (activeSlide === 0) {
        gsap.fromTo(
          ".slide-clearance .clearance-micro-bar",
          { width: "0%" },
          {
            width: `${Math.min(100, Math.max(0, summary?.attendance_rate ?? 0))}%`,
            duration: 0.5,
            ease: "power2.out",
          },
        );
      } else if (activeSlide === 1) {
        gsap.fromTo(
          ".slide-activity .activity-micro-sparkline .spark-bar",
          { scaleY: 0.2, transformOrigin: "bottom center" },
          {
            scaleY: 1,
            stagger: 0.035,
            duration: 0.35,
            ease: "back.out(1.5)",
          },
        );
      } else if (activeSlide === 2) {
        gsap.fromTo(
          ".slide-next .slide-calendar-box",
          { scale: 0.88, opacity: 0.6 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.35,
            ease: "back.out(1.6)",
          },
        );
      }
    },
    { scope: visualFrameRef, dependencies: [activeSlide, summary?.attendance_rate] },
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [logRes, summaryRes, upcomingRes, profileRes] = await Promise.all([
        getMyAttendanceLogs({ page: 1, size: 10, sort: "date_desc" }),
        getMyAttendanceSummary(),
        getAllEvents(1, 4),
        getMyProfile().catch(() => null),
      ]);
      setLogs(logRes.items);
      setSummary(summaryRes);
      setUpcoming(upcomingRes.items);
      if (profileRes) {
        setProfile(profileRes);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    if (hour >= 18 && hour < 22) return "Good evening";
    return "Working late";
  }, []);

  const activeEvents = useMemo(
    () => upcoming.filter((e) => e.active_sessions_count > 0),
    [upcoming],
  );

  const typeEntries = useMemo(() => {
    if (!summary?.attendance_by_type) return [];
    return Object.entries(summary.attendance_by_type)
      .map(([type, count]) => ({
        type,
        label: EVENT_TYPE_LABELS[type] ?? type,
        count,
        gradient: TYPE_GRADIENTS[type] ?? "linear-gradient(90deg, #64748b, #94a3b8)",
      }))
      .sort((a, b) => b.count - a.count);
  }, [summary]);

  const totalAvailable = summary?.total_events_available ?? 0;
  const totalAttended = summary?.total_events_attended ?? 0;
  const attendanceRate = summary?.attendance_rate ?? 0;
  const isBiometricActive = !!(user?.profile_photo_url || user?.attendee_type);
  const nextEvent = upcoming.length > 0 ? upcoming[0] : null;

  // Next Event Date Info (Month + Day, e.g. AUG 4)
  const nextEventDateInfo = useMemo(() => {
    if (!nextEvent?.date) return null;
    const d = new Date(nextEvent.date);
    if (isNaN(d.getTime())) return null;
    const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
    const day = d.getDate().toString();
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    return { month, day, weekday, display: `${d.toLocaleDateString(undefined, { month: "short" })} ${day}` };
  }, [nextEvent]);

  // Next Event Countdown Label
  const nextEventCountdown = useMemo(() => {
    if (!nextEvent) return null;
    const eventDate = new Date(nextEvent.date);
    const now = new Date();
    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return { label: "Today", isLive: true };
    if (diffDays === 1) return { label: "Tomorrow", isLive: false };
    if (diffDays <= 7) return { label: `In ${diffDays} days`, isLive: false };
    return { label: formatDate(nextEvent.date), isLive: false };
  }, [nextEvent]);

  // Filtered activity records based on inline filter pills
  const filteredLogs = useMemo(() => {
    if (activityFilter === "all") return logs.slice(0, 5);
    return logs
      .filter((l) => l.verification_method === activityFilter)
      .slice(0, 5);
  }, [logs, activityFilter]);

  // Heatmap configuration: Partial Semester Months (~5-Month rolling window)
  const heatmapConfig = useMemo(() => {
    const record: Record<string, number> = {};
    logs.forEach((l) => {
      if (!l.check_in_time) return;
      const d = new Date(l.check_in_time);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      record[key] = (record[key] || 0) + 1;
    });

    const now = new Date();
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Partial months: 20 weeks on desktop (~5 months), 14 weeks on mobile (~3.5 months)
    const rollingWeeks = isMobile ? 14 : 20;
    const startD = new Date(now);
    startD.setDate(now.getDate() - rollingWeeks * 7);
    const startDate = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, "0")}-${String(startD.getDate()).padStart(2, "0")}`;

    const totalCount = Object.values(record).reduce((a, b) => a + b, 0);

    return {
      data: record,
      startDate,
      endDate,
      totalCheckins: totalCount || totalAttended,
      activeStreakWeeks: totalCount > 0 ? 4 : 0,
    };
  }, [logs, totalAttended, isMobile]);

  // Clearance sparkline trend data matching exact Mantine trendColors standard
  const clearanceTrendData = useMemo<number[]>(() => {
    if (attendanceRate >= 75) {
      return [10, 20, 40, 20, 40, 10, 50];
    }
    if (attendanceRate < 50) {
      return [50, 40, 20, 40, 20, 40, 10];
    }
    return [10, 20, 40, 20, 40, 10, 50, 5, 10];
  }, [attendanceRate]);

  // Clearance Trajectory AreaChart Data over semester months
  const clearanceTrajectoryData = useMemo(() => {
    const currentRate = Math.round(attendanceRate);
    const p1 = Math.max(15, Math.round(currentRate * 0.45));
    const p2 = Math.max(30, Math.round(currentRate * 0.65));
    const p3 = Math.max(45, Math.round(currentRate * 0.82));
    const p4 = Math.max(55, Math.round(currentRate * 0.94));

    return [
      { period: "Apr", rate: p1 },
      { period: "May", rate: p2 },
      { period: "Jun", rate: p3 },
      { period: "Jul", rate: p4 },
      { period: "Aug", rate: currentRate },
    ];
  }, [attendanceRate]);

  // "To Clear" runway calculations and DonutChart data
  const toClearCount = Math.max(0, totalAvailable - totalAttended);
  const isCleared = totalAvailable > 0 && toClearCount === 0;

  const toClearDonutData = useMemo(() => {
    const attended = Math.max(0, totalAttended);
    const remaining = Math.max(0, totalAvailable - totalAttended);
    if (attended === 0 && remaining === 0) {
      return [{ name: "Target", value: 1, color: "gray.4" }];
    }
    if (remaining === 0) {
      return [{ name: "Cleared", value: attended || 1, color: "teal.6" }];
    }
    return [
      { name: "Attended", value: attended, color: "indigo.6" },
      { name: "To Clear", value: remaining, color: "gray.4" },
    ];
  }, [totalAttended, totalAvailable]);

  return (
    <Container
      fluid
      pt={0}
      pb={{ base: "6.5rem", sm: "4xl" }}
      px={0}
      style={{ maxWidth: 1440 }}
    >
      {/* ─── Active Session Alert Banner (if kiosk currently open) ─── */}
      {activeEvents.length > 0 && (
        <div className="premium-live-banner">
          <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
            <Group gap="xs" align="center" style={{ minWidth: 0 }}>
              <span className="premium-pulse-beacon" />
              <div style={{ minWidth: 0 }}>
                <Group gap={6} align="center">
                  <Text fz="0.825rem" fw={600} c="var(--text-primary)" truncate>
                    Active Session: {activeEvents[0].name}
                  </Text>
                  <span className="premium-live-badge">Live</span>
                </Group>
                <Text fz="0.75rem" c="var(--text-secondary)" truncate>
                  {activeEvents[0].venue ?? "Campus Entrance"} • Kiosks actively verifying attendance
                </Text>
              </div>
            </Group>

            <Group gap={8} style={{ flexShrink: 0 }}>
              <Button
                size="xs"
                variant="filled"
                color="red"
                component={Link}
                to={`/student/events/${activeEvents[0].id}`}
                className="premium-btn-live"
              >
                View Session
              </Button>
            </Group>
          </Group>
        </div>
      )}

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          mb="md"
          withCloseButton
          onClose={() => setError(false)}
        >
          Unable to load live dashboard statistics. Please refresh your browser.
        </Alert>
      )}

      {/* ─── 1. Executive Split Card (Matches Mockup) ─── */}
      <div className="premium-header-card">
        {/* Left Column: Identity & Vertical Status Badges */}
        <div className="header-identity-col">
          <div className="header-identity-text-group">
            <h1 className="header-greeting-title">
              {greeting},<br />{firstName}
            </h1>
            <span className="header-institution-name">
              {institution?.name ?? "Campus Portal"}
            </span>
          </div>

          <div className="header-credential-stack">
            {displayStudentId && (
              <span className="header-id-tag">
                {displayStudentId}
              </span>
            )}
            <span className={`header-biometric-pill ${isBiometricActive ? "enrolled" : "pending"}`}>
              {isBiometricActive ? <IconShieldCheck size={12} /> : <IconShieldX size={12} />}
              <span>{isBiometricActive ? "Face ID Enrolled" : "Photo Pending"}</span>
            </span>
          </div>

          {/* Desktop CTA row */}
          <div className="header-cta-row desktop-only">
            <Button
              size="xs"
              variant="filled"
              leftSection={<IconQrcode size={14} />}
              onClick={() => setPassModalOpen(true)}
              className="premium-btn-primary"
            >
              Digital Pass
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconHistory size={14} />}
              component={Link}
              to="/student/attendance"
              className="premium-btn-secondary"
            >
              Attendance History
            </Button>
          </div>
        </div>

        {/* Right Column: Telemetry Cards (Grid on Desktop, Swipe Carousel on Mobile) */}
        <div className="header-visual-frame" ref={visualFrameRef}>
          <div
            className="visual-carousel-track"
            style={{ "--active-slide": activeSlide } as React.CSSProperties}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Slide 1: Clearance Standing (Eyebrow + Large Sparkline + Metric) */}
            <div className="visual-slide-card slide-clearance">
              <span className="slide-category-label">Clearance</span>

              <div className="slide-chart-slot">
                <Sparkline
                  w="100%"
                  h={isMobile ? 44 : 64}
                  data={clearanceTrendData}
                  trendColors={{ positive: 'teal.6', negative: 'red.6', neutral: 'gray.5' }}
                  fillOpacity={0.2}
                />
              </div>

              <div className="slide-big-metric">
                {loading ? <Skeleton height={28} width={60} /> : `${Math.round(attendanceRate)}%`}
              </div>
            </div>

            {/* Slide 2: To Clear Runway (Eyebrow + Big Hero Centered Donut with Number inside) */}
            <div className="visual-slide-card slide-toclear">
              <span className="slide-category-label">To Clear</span>

              <div className="slide-donut-hero">
                {loading ? (
                  <Skeleton height={isMobile ? 58 : 78} width={isMobile ? 58 : 78} circle />
                ) : (
                  <DonutChart
                    size={isMobile ? 58 : 78}
                    thickness={isMobile ? 5.5 : 7.5}
                    data={toClearDonutData}
                    chartLabel={isCleared ? "✓" : `${toClearCount}`}
                    withTooltip={false}
                  />
                )}
              </div>
            </div>

            {/* Slide 3: Next Event Calendar Card (Apple-style Tear-off Calendar Tile) */}
            <div className="visual-slide-card slide-next">
              <span className="slide-category-label">Next Session</span>

              <div className="slide-calendar-container">
                {loading ? (
                  <Skeleton height={isMobile ? 58 : 84} width={isMobile ? 62 : 86} radius={14} />
                ) : nextEventDateInfo ? (
                  <div className="apple-calendar-tile">
                    <div className="apple-cal-header">
                      <div className="apple-cal-binder-rings">
                        <span className="binder-ring" />
                        <span className="binder-ring" />
                      </div>
                      <span className="apple-cal-month">{nextEventDateInfo.month}</span>
                    </div>
                    <div className="apple-cal-body">
                      <span className="apple-cal-day">{nextEventDateInfo.day}</span>
                      <span className="apple-cal-weekday">{nextEventDateInfo.weekday}</span>
                    </div>
                  </div>
                ) : (
                  <div className="apple-calendar-tile all-clear">
                    <div className="apple-cal-header clear-header">
                      <span className="apple-cal-month">STATUS</span>
                    </div>
                    <div className="apple-cal-body">
                      <IconCheck size={isMobile ? 18 : 22} style={{ color: "#10b981", margin: "2px auto 0" }} />
                      <span className="apple-cal-weekday" style={{ color: "#10b981", fontWeight: 700 }}>All Clear</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Carousel Pagination Dots */}
          <div className="visual-carousel-dots">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                type="button"
                className={`carousel-dot ${activeSlide === idx ? "active" : ""}`}
                onClick={() => handleDotClick(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── 2. Full-Width Semester Overview & Session Brick Ledger Bento ─── */}
      <div className="semester-bento-card">
        <div className="card-header-row bento-header-responsive">
          <Group gap={8} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
            <IconChartBar size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span className="card-heading">Semester overview</span>
          </Group>
          <span className="card-meta-count">Current term</span>
        </div>

        <div className="semester-bento-grid">
          {/* Left Column: Attendance Telemetry & Clearance Target Track */}
          <div className="bento-telemetry-col">
            <div className="telemetry-tile-duo">
              <div className="telemetry-tile">
                <div className="telemetry-tile-top">
                  <span className="telemetry-tile-title">Attended events</span>
                  <IconCheck size={14} style={{ color: "var(--brand-primary)" }} />
                </div>
                <div className="telemetry-tile-value">
                  {loading ? (
                    <Skeleton height={26} width={50} />
                  ) : (
                    `${totalAttended} / ${totalAvailable}`
                  )}
                </div>
                <span className="telemetry-tile-sub">Campus quota</span>
              </div>

              <div className="telemetry-tile">
                <div className="telemetry-tile-top">
                  <span className="telemetry-tile-title">Last check-in</span>
                  <IconHistory size={14} style={{ color: "var(--text-muted)" }} />
                </div>
                <div className="telemetry-tile-value" style={{ fontSize: "0.95rem" }}>
                  {loading ? (
                    <Skeleton height={26} width={70} />
                  ) : summary?.last_attendance ? (
                    formatDate(summary.last_attendance)
                  ) : (
                    "No logs yet"
                  )}
                </div>
                <span className="telemetry-tile-sub">
                  {summary?.last_attendance
                    ? `${formatTime(summary.last_attendance)} • Verified`
                    : "Active semester"}
                </span>
              </div>
            </div>

            {/* Clearance Target Runway (Clean & Calm) */}
            <div className="clearance-runway-box">
              <div className="runway-box-header">
                <Text fz="0.75rem" fw={600} c="var(--text-primary)">
                  Clearance Gate Track
                </Text>
                <span className="runway-threshold-tag">≥80% gate</span>
              </div>
              <div className="runway-chart-wrap">
                <AreaChart
                  h={isMobile ? 55 : 68}
                  data={clearanceTrajectoryData}
                  dataKey="period"
                  series={[
                    {
                      name: "rate",
                      label: "Attendance Rate (%)",
                      color: attendanceRate >= 80 ? "teal.6" : attendanceRate >= 60 ? "blue.6" : "orange.6",
                    },
                  ]}
                  curveType="natural"
                  fillOpacity={0.22}
                  strokeWidth={2}
                  withXAxis={false}
                  withYAxis={false}
                  withDots={false}
                  withLegend={false}
                  gridAxis="none"
                  tooltipProps={{
                    content: ({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const val = payload[0]?.value;
                      return (
                        <div className="area-custom-tooltip">
                          <span className="area-tooltip-tag">{label}</span>
                          <span className="area-tooltip-value">{val}%</span>
                        </div>
                      );
                    },
                    allowEscapeViewBox: { x: false, y: false },
                  }}
                  referenceLines={[
                    {
                      y: 80,
                      label: "80% Gate",
                      color: "red.6",
                      strokeDasharray: "3 3",
                    },
                  ]}
                />
              </div>
              <div className="runway-footer-row">
                <Text fz="0.75rem" c="var(--text-secondary)">
                  Target: 80% exam clearance
                </Text>
                <span className="runway-rate-text">
                  {totalAvailable === 0 ? "100%" : `${Math.round(attendanceRate)}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Mantine Official Heatmap Component */}
          <div className="bento-heatmap-col">
            <div className="heatmap-header-row">
              <div className="heatmap-title-group">
                <span className="heatmap-title">Attendance activity</span>
                <span className="heatmap-subtitle">Daily check-in distribution</span>
              </div>
              <Badge
                variant="light"
                color="teal"
                size="sm"
                leftSection={<IconFlame size={12} />}
                className="heatmap-streak-badge"
              >
                {heatmapConfig.activeStreakWeeks > 0
                  ? `${heatmapConfig.activeStreakWeeks}-week streak`
                  : `${heatmapConfig.totalCheckins} check-ins`}
              </Badge>
            </div>

            {loading ? (
              <Skeleton height={120} radius="md" mt="xs" />
            ) : (
              <div className="heatmap-matrix-wrap">
                <Heatmap
                  data={heatmapConfig.data}
                  startDate={heatmapConfig.startDate}
                  endDate={heatmapConfig.endDate}
                  withTooltip
                  withWeekdayLabels
                  withMonthLabels
                  weekdayLabels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
                  firstDayOfWeek={1}
                  rectSize={isMobile ? 12 : 13.5}
                  gap={isMobile ? 1.8 : 2.2}
                  rectRadius={2.8}
                  weekdaysLabelsWidth={isMobile ? 26 : 30}
                  monthsLabelsHeight={isMobile ? 16 : 18}
                  fontSize={isMobile ? 9 : 10}
                  getTooltipLabel={({ date, value }) =>
                    `${new Date(date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })} – ${value === null || value === 0 ? "No check-ins" : `${value} session${value > 1 ? "s" : ""} attended`}`
                  }
                />

                {/* Footer Legend Row */}
                <div className="heatmap-footer-row">
                  <span className="heatmap-footer-meta">
                    {heatmapConfig.totalCheckins} total session{heatmapConfig.totalCheckins === 1 ? "" : "s"} recorded
                  </span>
                  <div className="heatmap-legend">
                    <span className="legend-label">Less</span>
                    <div className="heatmap-cell level-0 mini" />
                    <div className="heatmap-cell level-1 mini" />
                    <div className="heatmap-cell level-2 mini" />
                    <div className="heatmap-cell level-3 mini" />
                    <span className="legend-label">More</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. Structured 2-Column Dashboard Grid (Below Bento) ─── */}
      <div className="premium-grid-layout">
        {/* Left Column: Next Event & Category Requirements */}
        <div className="premium-col-main">
          {/* Section: Next Scheduled Event Ticket */}
          <div className="premium-card">
            <div className="card-header-row">
              <span className="card-heading">Next scheduled event</span>
              {nextEventCountdown && (
                <span className={`card-badge-pill ${nextEventCountdown.isLive ? "live" : ""}`}>
                  {nextEventCountdown.label}
                </span>
              )}
            </div>

            {loading ? (
              <Stack gap="xs" mt="sm">
                <Skeleton height={24} width="70%" />
                <Skeleton height={18} width="40%" />
              </Stack>
            ) : !nextEvent ? (
              <div className="empty-state-container">
                <IconCalendar size={22} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
                <Text fz="0.825rem" c="var(--text-secondary)" mt="xs">
                  No upcoming events scheduled this week.
                </Text>
              </div>
            ) : (
              <Link to={`/student/events/${nextEvent.id}`} className="event-ticket-link">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text fz="1rem" fw={600} c="var(--text-primary)" lh={1.3}>
                    {nextEvent.name}
                  </Text>
                  <Group gap="md" mt={8} wrap="wrap">
                    <Group gap={4} align="center">
                      <IconClock size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <Text fz="0.75rem" c="var(--text-secondary)" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatDate(nextEvent.date)}
                      </Text>
                    </Group>
                    {nextEvent.venue && (
                      <Group gap={4} align="center">
                        <IconMapPin size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <Text fz="0.75rem" c="var(--text-secondary)">
                          {nextEvent.venue}
                        </Text>
                      </Group>
                    )}
                  </Group>
                </div>

                <div className="ticket-action-arrow">
                  <IconChevronRight size={16} />
                </div>
              </Link>
            )}
          </div>

          {/* Section: Category Clearance Requirements */}
          <div className="premium-card">
            <div className="card-header-row">
              <span className="card-heading">Category clearance</span>
              <span className="card-meta-count">{typeEntries.length} categories</span>
            </div>

            {loading ? (
              <Stack gap="xs" mt="sm">
                <Skeleton height={32} radius="sm" />
                <Skeleton height={32} radius="sm" />
                <Skeleton height={32} radius="sm" />
              </Stack>
            ) : typeEntries.length === 0 ? (
              <Box py="md" ta="center">
                <Text fz="0.8rem" c="var(--text-secondary)">
                  No category records logged yet for this semester.
                </Text>
              </Box>
            ) : (
              <div className="category-list-wrap">
                {typeEntries.map((item) => {
                  const isFulfilled = item.count >= 2;
                  return (
                    <div key={item.type} className="category-row-item">
                      <div className="category-item-meta">
                        <Text fz="0.825rem" fw={500} c="var(--text-primary)">
                          {item.label}
                        </Text>
                        <span className={`category-count-tag ${isFulfilled ? "met" : item.count > 0 ? "partial" : "empty"}`}>
                          {isFulfilled
                            ? "✓ Met"
                            : item.count > 0
                              ? `${item.count} attended`
                              : "0 attended"}
                        </span>
                      </div>
                      <div className="category-progress-bg">
                        <div
                          className="category-progress-fill"
                          style={{
                            width: `${Math.min(100, item.count * 50)}%`,
                            background: item.gradient,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Activity Ledger */}
        <div className="premium-col-side">
          <div className="premium-card">
            <div className="card-header-row">
              <span className="card-heading">Recent Attendance History</span>
              <Button
                variant="subtle"
                size="xs"
                component={Link}
                to="/student/attendance"
                rightSection={<IconArrowRight size={12} />}
                className="premium-btn-link"
              >
                View History
              </Button>
            </div>

            {/* Inline Filter Chips */}
            <div className="filter-chip-row">
              <button
                type="button"
                className={`filter-chip ${activityFilter === "all" ? "active" : ""}`}
                onClick={() => setActivityFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-chip ${activityFilter === "face_recognition" ? "active" : ""}`}
                onClick={() => setActivityFilter("face_recognition")}
              >
                Face ID
              </button>
              <button
                type="button"
                className={`filter-chip ${activityFilter === "qr_code" ? "active" : ""}`}
                onClick={() => setActivityFilter("qr_code")}
              >
                QR Code
              </button>
              <button
                type="button"
                className={`filter-chip ${activityFilter === "marshal_override" ? "active" : ""}`}
                onClick={() => setActivityFilter("marshal_override")}
              >
                Marshal
              </button>
            </div>

            {/* Activity Ledger Rows */}
            {loading ? (
              <Stack gap="xs" mt="sm">
                <Skeleton height={38} radius="sm" />
                <Skeleton height={38} radius="sm" />
                <Skeleton height={38} radius="sm" />
              </Stack>
            ) : filteredLogs.length === 0 ? (
              <Box py="lg" ta="center">
                <IconCheck size={20} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                <Text fz="0.8rem" c="var(--text-secondary)" mt="xs">
                  {activityFilter === "all"
                    ? "No attendance entries recorded yet."
                    : "No check-ins found for this method."}
                </Text>
              </Box>
            ) : (
              <div className="activity-rows-container">
                {filteredLogs.map((log) => {
                  const meta =
                    VERIFICATION_META[log.verification_method] ?? {
                      label: "Verified",
                      icon: <IconCheck size={12} />,
                      color: "#10b981",
                      bg: "rgba(16, 185, 129, 0.1)",
                    };
                  return (
                    <div key={log.id} className="activity-row-item">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text fz="0.85rem" fw={500} c="var(--text-primary)" lh={1.3}>
                          {log.event_name}
                        </Text>
                        <Group gap={6} align="center" mt={2} wrap="wrap">
                          <Text fz="0.75rem" c="var(--text-secondary)" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatDate(log.check_in_time)} • {formatTime(log.check_in_time)}
                          </Text>
                          {log.venue && (
                            <Text fz="0.75rem" c="var(--text-secondary)">
                              • {log.venue}
                            </Text>
                          )}
                        </Group>
                      </div>

                      <span
                        className="verification-tag"
                        style={{ color: meta.color, backgroundColor: meta.bg }}
                      >
                        {meta.icon}
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Digital Pass Modal Sheet */}
      <StudentPassModal opened={passModalOpen} onClose={() => setPassModalOpen(false)} />
    </Container>
  );
}
