import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconCalendarEvent,
  IconHistory,
  IconUser,
  IconCameraSelfie,
  IconQrcode,
} from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { useAuthStore } from "../../store/authStore";
import AppShellChrome from "./AppShellChrome";
import StudentMobileNav from "./StudentMobileNav";
import StudentPassModal from "../student/StudentPassModal";

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
  const [passOpened, setPassOpened] = useState(false);

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
        navLabel="Student"
        handleLogout={handleLogout}
        email={user?.email ?? undefined}
        firstName={user?.first_name ?? undefined}
        lastName={user?.last_name ?? undefined}
        profilePhotoUrl={user?.profile_photo_url}
        headerRight={
          <Button
            size="xs"
            variant="default"
            leftSection={<IconQrcode size={14} />}
            onClick={() => setPassOpened(true)}
            visibleFrom="xs"
            style={{
              borderRadius: "6px",
              height: "32px",
              fontWeight: 500,
              fontSize: "13px",
              borderColor: "var(--border-subtle)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
            }}
          >
            Digital Pass
          </Button>
        }
      />

      <StudentMobileNav onOpenPass={() => setPassOpened(true)} />
      <StudentPassModal opened={passOpened} onClose={() => setPassOpened(false)} />
    </>
  );
}

