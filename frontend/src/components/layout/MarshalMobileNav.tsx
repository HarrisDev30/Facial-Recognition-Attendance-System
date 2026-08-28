import { Link, useLocation } from "react-router-dom";
import {
  IconDashboard,
  IconCalendarEvent,
  IconScan,
  IconUsers,
  IconUser,
} from "@tabler/icons-react";
import "./MarshalMobileNav.css";

interface MarshalMobileNavProps {
  onOpenScan: () => void;
  onOpenStudents: () => void;
  onCloseModals?: () => void;
  activeModal?: "scan" | "students" | null;
  hasActiveLiveEvent?: boolean;
}

export default function MarshalMobileNav({
  onOpenScan,
  onOpenStudents,
  onCloseModals,
  activeModal = null,
  hasActiveLiveEvent = false,
}: MarshalMobileNavProps) {
  const location = useLocation();

  const isCurrent = (path: string) => !activeModal && location.pathname.startsWith(path);

  return (
    <div className="marshal-mobile-nav-container">
      <nav className="marshal-mobile-nav-bar" aria-label="Marshal Mobile Navigation">
        {/* Tab 1: Dashboard */}
        <Link
          to="/marshal/dashboard"
          onClick={onCloseModals}
          className={`marshal-nav-tab-button ${isCurrent("/marshal/dashboard") ? "is-active" : ""}`}
        >
          <div className="marshal-nav-tab-icon-wrapper">
            <IconDashboard size={20} stroke={1.75} />
          </div>
          <span className="marshal-nav-tab-label">Dashboard</span>
          {isCurrent("/marshal/dashboard") && <span className="marshal-nav-active-pill" />}
        </Link>

        {/* Tab 2: Events */}
        <Link
          to="/marshal/events"
          onClick={onCloseModals}
          className={`marshal-nav-tab-button ${isCurrent("/marshal/events") ? "is-active" : ""}`}
        >
          <div className="marshal-nav-tab-icon-wrapper">
            <IconCalendarEvent size={20} stroke={1.75} />
            {hasActiveLiveEvent && <span className="marshal-nav-live-dot" />}
          </div>
          <span className="marshal-nav-tab-label">Events</span>
          {isCurrent("/marshal/events") && <span className="marshal-nav-active-pill" />}
        </Link>

        {/* Center Elevated Action: Instant Scanner Launcher */}
        <button
          type="button"
          onClick={onOpenScan}
          className={`marshal-nav-center-action ${activeModal === "scan" ? "is-active" : ""}`}
          aria-label="Open Scanner Options"
        >
          <div className="marshal-nav-center-bubble">
            <IconScan size={24} stroke={1.75} />
          </div>
          <span className="marshal-nav-center-label">Scan</span>
        </button>

        {/* Tab 4: Students Search & Manual Check-In */}
        <button
          type="button"
          onClick={onOpenStudents}
          className={`marshal-nav-tab-button ${activeModal === "students" ? "is-active" : ""}`}
          aria-label="Search Students and Manual Check-In"
        >
          <div className="marshal-nav-tab-icon-wrapper">
            <IconUsers size={20} stroke={1.75} />
          </div>
          <span className="marshal-nav-tab-label">Students</span>
          {activeModal === "students" && <span className="marshal-nav-active-pill" />}
        </button>

        {/* Tab 5: Profile */}
        <Link
          to="/marshal/profile"
          onClick={onCloseModals}
          className={`marshal-nav-tab-button ${isCurrent("/marshal/profile") ? "is-active" : ""}`}
        >
          <div className="marshal-nav-tab-icon-wrapper">
            <IconUser size={20} stroke={1.75} />
          </div>
          <span className="marshal-nav-tab-label">Profile</span>
          {isCurrent("/marshal/profile") && <span className="marshal-nav-active-pill" />}
        </Link>
      </nav>
    </div>
  );
}
