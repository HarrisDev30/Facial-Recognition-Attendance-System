import { Link, useLocation } from "react-router-dom";
import {
  IconDashboard,
  IconCalendarEvent,
  IconHistory,
  IconUser,
  IconQrcode,
} from "@tabler/icons-react";
import "./StudentMobileNav.css";

interface StudentMobileNavProps {
  onOpenPass: () => void;
  hasActiveLiveEvent?: boolean;
}

export default function StudentMobileNav({
  onOpenPass,
  hasActiveLiveEvent = false,
}: StudentMobileNavProps) {
  const location = useLocation();

  const isCurrent = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="student-mobile-nav-container">
      <nav className="student-mobile-nav-bar" aria-label="Student Mobile Navigation">
        {/* Tab 1: Dashboard */}
        <Link
          to="/student/dashboard"
          className={`student-nav-tab-button ${isCurrent("/student/dashboard") ? "is-active" : ""}`}
        >
          <div className="student-nav-tab-icon-wrapper">
            <IconDashboard size={20} stroke={1.75} />
          </div>
          <span className="student-nav-tab-label">Dashboard</span>
          {isCurrent("/student/dashboard") && <span className="student-nav-active-pill" />}
        </Link>

        {/* Tab 2: Events */}
        <Link
          to="/student/events"
          className={`student-nav-tab-button ${isCurrent("/student/events") ? "is-active" : ""}`}
        >
          <div className="student-nav-tab-icon-wrapper">
            <IconCalendarEvent size={20} stroke={1.75} />
            {hasActiveLiveEvent && <span className="student-nav-live-dot" />}
          </div>
          <span className="student-nav-tab-label">Events</span>
          {isCurrent("/student/events") && <span className="student-nav-active-pill" />}
        </Link>

        {/* Center Elevated Action: Digital Pass */}
        <button
          type="button"
          onClick={onOpenPass}
          className="student-nav-center-action"
          aria-label="Open Digital Student Pass"
        >
          <div className="student-nav-center-bubble">
            <IconQrcode size={24} stroke={1.75} />
          </div>
          <span className="student-nav-center-label">Pass</span>
        </button>

        {/* Tab 3: History */}
        <Link
          to="/student/attendance"
          className={`student-nav-tab-button ${isCurrent("/student/attendance") ? "is-active" : ""}`}
        >
          <div className="student-nav-tab-icon-wrapper">
            <IconHistory size={20} stroke={1.75} />
          </div>
          <span className="student-nav-tab-label">History</span>
          {isCurrent("/student/attendance") && <span className="student-nav-active-pill" />}
        </Link>

        {/* Tab 4: Profile */}
        <Link
          to="/student/profile"
          className={`student-nav-tab-button ${isCurrent("/student/profile") ? "is-active" : ""}`}
        >
          <div className="student-nav-tab-icon-wrapper">
            <IconUser size={20} stroke={1.75} />
          </div>
          <span className="student-nav-tab-label">Profile</span>
          {isCurrent("/student/profile") && <span className="student-nav-active-pill" />}
        </Link>
      </nav>
    </div>
  );
}
