import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  IconDashboard,
  IconCalendarEvent,
  IconUser,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import AppShellChrome from "./AppShellChrome";
import MarshalMobileNav from "./MarshalMobileNav";
import MarshalScanModal from "../marshal/MarshalScanModal";
import StudentSearchModal from "../marshal/StudentSearchModal";
import { DualPortalModeSwitcher } from "./DualPortalModeSwitcher";
import { getActiveSessions, type ActiveSession } from "../../api/marshal";
import { getAttendees, type AttendeeResponse } from "../../api/attendees";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, to: "/marshal/dashboard" },
  { label: "Events", icon: IconCalendarEvent, to: "/marshal/events" },
  { label: "Profile", icon: IconUser, to: "/marshal/profile" },
];

export default function MarshalLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeResponse[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  const isScannerRoute = location.pathname.includes("/marshal/scanner");

  // Automatically dismiss modals on route changes (e.g. clicking Dashboard, Events, Profile)
  useEffect(() => {
    setScanModalOpen(false);
    setStudentsModalOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    getActiveSessions()
      .then((sessions) => setActiveSessions(sessions || []))
      .catch(() => setActiveSessions([]));
  }, []);

  // For fullscreen scanner routes (Kiosk, Mobile, QR), render the view directly without chrome or navbars
  if (isScannerRoute) {
    return <Outlet />;
  }

  const handleOpenScan = () => {
    setStudentsModalOpen(false);
    setScanModalOpen((prev) => !prev);
  };

  const handleOpenStudents = async () => {
    setScanModalOpen(false);
    setStudentsModalOpen((prev) => !prev);
    if (attendees.length === 0) {
      try {
        const atts = await getAttendees();
        setAttendees(atts || []);
      } catch {
        // Silently handle
      }
    }
  };

  const handleCloseModals = () => {
    setScanModalOpen(false);
    setStudentsModalOpen(false);
  };

  const handleLogout = () => {
    const campusSlug = user?.institution_code?.toLowerCase();
    logout();
    if (campusSlug) {
      navigate(`/${campusSlug}`, { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };

  return (
    <>
      <AppShellChrome
        navItems={navItems}
        navLabel="Marshal"
        handleLogout={handleLogout}
        email={user?.email ?? undefined}
        firstName={user?.first_name ?? undefined}
        lastName={user?.last_name ?? undefined}
        profilePhotoUrl={user?.profile_photo_url}
        headerRight={<DualPortalModeSwitcher />}
      />

      {/* Floating 5-Slot Bottom Navigation Bar for Mobile (< 768px) */}
      <MarshalMobileNav
        onOpenScan={handleOpenScan}
        onOpenStudents={handleOpenStudents}
        onCloseModals={handleCloseModals}
        activeModal={scanModalOpen ? "scan" : studentsModalOpen ? "students" : null}
        hasActiveLiveEvent={activeSessions.length > 0}
      />

      {/* Fast Scanner Launcher Modal */}
      <MarshalScanModal
        opened={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onOpenStudents={handleOpenStudents}
      />

      {/* Unified Student Search & Direct Manual Check-In Pop-Up Modal */}
      <StudentSearchModal
        opened={studentsModalOpen}
        onClose={() => setStudentsModalOpen(false)}
        activeSessions={activeSessions}
        attendees={attendees}
      />
    </>
  );
}
