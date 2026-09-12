import { useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconCalendarEvent,
  IconUsers,
  IconCameraSelfie,
  IconDeviceCctv,
  IconBuildingCommunity,
  IconUser,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import AppShellChrome from "./AppShellChrome";

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const isOrgAdmin = user?.role === "org_admin";

  const navItems = [
    { label: "Dashboard", icon: IconDashboard, to: "/admin/dashboard" },
    {
      label: isOrgAdmin ? "My Organization" : "Organizations & Clubs",
      icon: IconBuildingCommunity,
      to: "/admin/organizations",
    },
    { label: "Events", icon: IconCalendarEvent, to: "/admin/events" },
    { label: "Attendees", icon: IconUsers, to: "/admin/students" },
    { label: "Operators & Marshals", icon: IconShieldCheck, to: "/admin/staff" },
    { label: "Biometrics", icon: IconCameraSelfie, to: "/admin/enrollment" },
    { label: "Scanner Devices", icon: IconDeviceCctv, to: "/admin/scanner-devices" },
    ...(!isOrgAdmin ? [{ label: "Campus Settings", icon: IconBuildingCommunity, to: "/admin/settings" }] : []),
    { label: "Profile", icon: IconUser, to: "/admin/profile" },
  ];

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
      navLabel={isOrgAdmin ? "Organization Admin" : "System Admin"}
      handleLogout={handleLogout}
      email={user?.email ?? undefined}
      firstName={user?.first_name ?? undefined}
      lastName={user?.last_name ?? undefined}
      profilePhotoUrl={user?.profile_photo_url}
    />
  );
}
