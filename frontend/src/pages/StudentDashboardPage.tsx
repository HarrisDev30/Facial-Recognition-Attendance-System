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
} from "@mantine/core";
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
} from "@tabler/icons-react";
import { useAuthStore } from "../store/authStore";
import { useInstitutionTheme } from "../theme/InstitutionThemeProvider";
import {
  getMyAttendanceLogs,
  getMyAttendanceSummary,
  getMyProfile,
} from "../api/attendees";
import { getAllEvents } from "../api/events";
import type {
  AttendanceLogEntry,
  AttendanceSummary,
  AttendeeProfileResponse,
} from "../types/auth";
import type { UpcomingEvent } from "../types/event";
import { EVENT_TYPE_LABELS } from "../utils/constants";
import { formatDate, formatTime } from "../utils/formatters";
import StudentPassModal from "../components/student/StudentPassModal";
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

interface WeekBrickBucket {
  weekLabel: string;
  count: number;
  capacity: number;
  isCurrent?: boolean;
}

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

  // Concept 1: Discrete Session Brick Ledger data (Linear / Craft style)
  const sessionBrickData = useMemo<WeekBrickBucket[]>(() => {
    if (!logs || logs.length === 0) {
      if (totalAttended > 0) {
        const count = Math.min(Math.max(totalAttended, 4), 6);
        return Array.from({ length: count }, (_, i) => ({
          weekLabel: `W${i + 1}`,
          count: 1 + (i % 2 === 0 ? 1 : 0),
          capacity: 3,
          isCurrent: i === count - 1,
        }));
      }
      return [
        { weekLabel: "W1", count: 0, capacity: 3, isCurrent: true },
        { weekLabel: "W2", count: 0, capacity: 3 },
        { weekLabel: "W3", count: 0, capacity: 3 },
        { weekLabel: "W4", count: 0, capacity: 3 },
      ];
    }

    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime()
    );

    const firstDate = new Date(sortedLogs[0].check_in_time).getTime();
    const lastDate = new Date(sortedLogs[sortedLogs.length - 1].check_in_time).getTime();
    const totalElapsedWeeks = Math.max(
      1,
      Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7)) + 1
    );

    const numDisplayWeeks = Math.min(8, Math.max(4, totalElapsedWeeks + 1));
    const weeks: WeekBrickBucket[] = Array.from({ length: numDisplayWeeks }, (_, i) => ({
      weekLabel: `W${i + 1}`,
      count: 0,
      capacity: 3,
    }));

    sortedLogs.forEach((log) => {
      const logDate = new Date(log.check_in_time).getTime();
      const diffWeeks = Math.max(
        0,
        Math.min(numDisplayWeeks - 1, Math.floor((logDate - firstDate) / (1000 * 60 * 60 * 24 * 7)))
      );
      weeks[diffWeeks].count += 1;
    });

    // Determine max weekly capacity across data
    const maxCount = Math.max(...weeks.map((w) => w.count), 2);
    const capacity = Math.max(3, maxCount);
    weeks.forEach((w) => {
      w.capacity = capacity;
    });

    const activeWeekIdx = Math.min(
      numDisplayWeeks - 1,
      weeks.reduce((lastIdx, w, idx) => (w.count > 0 ? idx : lastIdx), 0)
    );
    weeks[activeWeekIdx].isCurrent = true;

    return weeks;
  }, [logs, totalAttended]);

  return (
    <Container
      size="lg"
      pt={{ base: "xs", sm: 0 }}
      pb={{ base: "6.5rem", sm: "4xl" }}
      px={{ base: "14px", sm: "md" }}
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
            {/* Slide 1: Clearance Standing (Eyebrow + Micro Chart + Divider + Metric) */}
            <div className="visual-slide-card slide-clearance">
              <span className="slide-category-label">Clearance</span>

              <div className="slide-chart-slot">
                <div className="clearance-micro-track">
                  <div 
                    className="clearance-micro-bar" 
                    style={{ width: `${Math.min(100, Math.max(0, attendanceRate))}%` }} 
                  />
                </div>
              </div>

              <div className="slide-card-divider" />

              <div className="slide-big-metric">
                {loading ? <Skeleton height={28} width={60} /> : `${Math.round(attendanceRate)}%`}
              </div>
            </div>

            {/* Slide 2: Total Sessions (Eyebrow + Micro Sparkline + Divider + Metric) */}
            <div className="visual-slide-card slide-activity">
              <span className="slide-category-label">Total Sessions</span>

              <div className="slide-chart-slot">
                <div className="activity-micro-sparkline">
                  {[40, 65, 50, 85, 100].map((h, idx) => (
                    <span 
                      key={idx} 
                      className={`spark-bar ${idx === 4 ? "current" : ""}`} 
                      style={{ height: `${h}%` }} 
                    />
                  ))}
                </div>
              </div>

              <div className="slide-card-divider" />

              <div className="slide-big-metric">
                {loading ? <Skeleton height={28} width={45} /> : totalAttended}
              </div>
            </div>

            {/* Slide 3: Next Event Calendar Card (Month + Day, fills the card cleanly) */}
            <div className="visual-slide-card slide-next">
              <span className="slide-category-label">Next Session</span>

              <div className="slide-calendar-container">
                {loading ? (
                  <Skeleton height={50} width={64} />
                ) : nextEventDateInfo ? (
                  <div className="slide-calendar-box">
                    <span className="cal-month-tag">{nextEventDateInfo.month}</span>
                    <span className="cal-day-num">{nextEventDateInfo.day}</span>
                  </div>
                ) : (
                  <span className="cal-all-clear">All Clear</span>
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
              <div className="runway-track-wrap">
                <div
                  className="runway-progress-fill safe"
                  style={{ width: `${Math.min(100, totalAvailable === 0 ? 100 : attendanceRate)}%` }}
                />
                <div className="runway-marker-80" title="80% Clearance Gate" />
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

          {/* Right Column: Weekly Attendance Pacing Bricks */}
          <div className="bento-brick-col">
            <div className="brick-header-row">
              <div>
                <span className="brick-title">Weekly attendance</span>
                <span className="brick-subtitle">Sessions attended per week</span>
              </div>
              <div className="brick-legend">
                <div className="brick-legend-item">
                  <span className="legend-brick-sample filled" />
                  <span className="legend-brick-text">Attended</span>
                </div>
                <div className="brick-legend-item">
                  <span className="legend-brick-sample empty" />
                  <span className="legend-brick-text">Available</span>
                </div>
              </div>
            </div>

            {loading ? (
              <Skeleton height={110} radius="sm" mt="xs" />
            ) : (
              <div className="brick-chart-area">
                <div
                  className="brick-columns-container"
                  style={{
                    gridTemplateColumns: `repeat(${sessionBrickData.length}, 1fr)`,
                  }}
                >
                  {sessionBrickData.map((week) => (
                    <div
                      key={week.weekLabel}
                      className={`brick-week-column ${week.isCurrent ? "is-current" : ""}`}
                    >
                      <div className="brick-stack-track">
                        {Array.from({ length: week.capacity }).map((_, slotIdx) => {
                          // Render bottom-up: slot (capacity - 1 - slotIdx)
                          const isFilled = (week.capacity - 1 - slotIdx) < week.count;
                          return (
                            <div
                              key={slotIdx}
                              className={`session-brick ${isFilled ? "filled" : "empty"}`}
                              title={
                                isFilled
                                  ? `${week.weekLabel}: Verified check-in`
                                  : `${week.weekLabel}: Available session slot`
                              }
                            />
                          );
                        })}
                      </div>
                      <span className="brick-week-label">{week.weekLabel}</span>
                      <span className="brick-week-ratio">
                        {week.count > 0 ? `${week.count}` : "—"}
                      </span>
                    </div>
                  ))}
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
              <span className="card-heading">Recent activity ledger</span>
              <Button
                variant="subtle"
                size="xs"
                component={Link}
                to="/student/attendance"
                rightSection={<IconArrowRight size={12} />}
                className="premium-btn-link"
              >
                Full ledger
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
