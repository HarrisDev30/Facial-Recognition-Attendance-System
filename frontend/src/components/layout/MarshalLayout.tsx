import { useNavigate } from "react-router-dom";
import { IconDashboard, IconCalendarEvent, IconShield, IconUser } from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import AppShellChrome from "./AppShellChrome";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, to: "/marshal/dashboard" },
  { label: "Events", icon: IconCalendarEvent, to: "/marshal/events" },
  { label: "Profile", icon: IconUser, to: "/marshal/profile" },
  { label: "Privacy", icon: IconShield, to: "/privacy" },
];

export default function MarshalLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppShellChrome
      navItems={navItems}
      navLabel="Marshal"
      handleLogout={handleLogout}
      email={user?.email ?? undefined}
      firstName={user?.first_name ?? undefined}
      lastName={user?.last_name ?? undefined}
      profilePhotoUrl={user?.profile_photo_url}
    />
  );
}
