import { useNavigate } from "react-router-dom";
import {
  IconActivity,
  IconBuildingArch,
  IconDeviceCctv,
  IconBroadcast,
  IconCpu,
  IconUser,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import AppShellChrome from "./AppShellChrome";

export default function SuperAdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const navItems = [
    { label: "Platform Operations", icon: IconActivity, to: "/super-admin/dashboard" },
    { label: "University Tenants", icon: IconBuildingArch, to: "/super-admin/institutions" },
    { label: "Global Scanner Fleet", icon: IconDeviceCctv, to: "/super-admin/devices" },
    { label: "Incident & Broadcasts", icon: IconBroadcast, to: "/super-admin/broadcasts" },
    { label: "System & Infrastructure", icon: IconCpu, to: "/super-admin/system" },
    { label: "Profile", icon: IconUser, to: "/super-admin/profile" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppShellChrome
      navItems={navItems}
      navLabel="Super Admin Command Center"
      handleLogout={handleLogout}
      email={user?.email ?? undefined}
      firstName={user?.first_name ?? "Platform"}
      lastName={user?.last_name ?? "Admin"}
      profilePhotoUrl={user?.profile_photo_url}
    />
  );
}
