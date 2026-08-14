import { useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconCalendarEvent,
  IconUsers,
  IconCameraSelfie,
  IconDeviceCctv,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import AppShellChrome from "./AppShellChrome";

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const isOrgAdmin = user?.role === "org_admin";

  const navItems = [
    { label: "Dashboard", icon: IconDashboard, to: "/admin" },
    {
      label: isOrgAdmin ? "My Organization" : "Organizations & Clubs",
      icon: IconBuildingCommunity,
      to: "/admin/organizations",
    },
    { label: "Events", icon: IconCalendarEvent, to: "/admin/events" },
    { label: "Attendees", icon: IconUsers, to: "/admin/attendees" },
    { label: "Biometrics", icon: IconCameraSelfie, to: "/admin/enrollment" },
    ...(!isOrgAdmin
      ? [{ label: "Scanner Devices", icon: IconDeviceCctv, to: "/admin/scanner-devices" }]
      : []),
  ];

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppShellChrome
      navItems={navItems}
      navLabel={isOrgAdmin ? "Organization Admin" : "System Admin"}
      handleLogout={handleLogout}
      email={user?.email ?? undefined}
      firstName={user?.first_name ?? undefined}
      lastName={user?.last_name ?? undefined}
      profilePhotoUrl={user?.profile_photo_url}
    />
  );
}
