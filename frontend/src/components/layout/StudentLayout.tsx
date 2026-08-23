import { useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconCalendarEvent,
  IconHistory,
  IconUser,
  IconCameraSelfie,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import AppShellChrome from "./AppShellChrome";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, to: "/student/dashboard" },
  { label: "Events", icon: IconCalendarEvent, to: "/student/events" },
  { label: "Attendance", icon: IconHistory, to: "/student/attendance" },
  { label: "Profile", icon: IconUser, to: "/student/profile" },
  { label: "Biometrics", icon: IconCameraSelfie, to: "/register-biometrics" },
];

export default function StudentLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

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
    <AppShellChrome
      navItems={navItems}
      navLabel="Student"
      handleLogout={handleLogout}
      email={user?.email ?? undefined}
      firstName={user?.first_name ?? undefined}
      lastName={user?.last_name ?? undefined}
      profilePhotoUrl={user?.profile_photo_url}
    />
  );
}
