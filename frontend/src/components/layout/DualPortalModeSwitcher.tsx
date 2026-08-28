import { Button, Group, Badge } from "@mantine/core";
import { IconSchool, IconShield, IconArrowsExchange } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export function DualPortalModeSwitcher() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  // Determine if user has dual capabilities (e.g. Appointed Student Marshal, Staff Marshal, or Admin)
  const isStudent = user.role === "student" || !!user.attendee_id;
  const isMarshal =
    user.role === "marshal" ||
    user.is_marshal === true ||
    (user.marshal_org_ids && user.marshal_org_ids.length > 0);
  const isDualRole = (isStudent && isMarshal) || user.role === "admin" || user.role === "super_admin";

  if (!isDualRole) return null;

  const inMarshalMode = location.pathname.startsWith("/marshal") || location.pathname.startsWith("/scanner");

  const handleToggle = () => {
    if (inMarshalMode) {
      navigate("/student/dashboard");
    } else {
      navigate("/marshal/dashboard");
    }
  };

  return (
    <Group gap="xs">
      <Button
        variant="light"
        size="xs"
        radius="xl"
        color={inMarshalMode ? "teal" : "blue"}
        leftSection={inMarshalMode ? <IconSchool size={14} /> : <IconShield size={14} />}
        rightSection={<IconArrowsExchange size={14} />}
        onClick={handleToggle}
      >
        Switch to {inMarshalMode ? "Student Hub" : "Marshal Station"}
      </Button>
      {inMarshalMode && (
        <Badge color="teal" variant="dot" size="sm">
          Field Officer Active
        </Badge>
      )}
    </Group>
  );
}
