import { useNavigate } from "react-router-dom";
import {
  Text,
  UnstyledButton,
  Group,
  Menu,
  rem,
  Box,
  useMantineColorScheme,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconLogout,
  IconChevronDown,
  IconUser,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import Avatar from "../Avatar";
import { useAuthStore } from "../../store/authStore";

interface UserMenuProps {
  email?: string;
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string | null;
  onLogout: () => void;
}

export default function UserMenu({
  email,
  firstName,
  lastName,
  profilePhotoUrl,
  onLogout,
}: UserMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("dark", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";

  const displayName = firstName ? `${firstName} ${lastName ?? ""}`.trim() : email ?? "User";

  const handleProfileClick = () => {
    const role = user?.role;
    if (role === "admin" || role === "org_admin") {
      navigate("/admin/profile");
    } else if (role === "marshal") {
      navigate("/marshal/profile");
    } else {
      navigate("/student/profile");
    }
  };

  const toggleTheme = () => {
    setColorScheme(isDark ? "light" : "dark");
  };

  return (
    <Menu shadow="md" width={240} offset={8} position="bottom-end" transitionProps={{ transition: "pop-top-right", duration: 160 }}>
      <Menu.Target>
        <UnstyledButton className="btn-pressable">
          <Group gap="xs">
            <Avatar
              src={profilePhotoUrl}
              firstName={firstName}
              lastName={lastName}
              size="sm"
            />
            <Text size="sm" visibleFrom="sm" c="var(--text-primary)" fw={500}>
              {firstName ?? email ?? "User"}
            </Text>
            <Box visibleFrom="sm" style={{ display: "flex", alignItems: "center" }}>
              <IconChevronDown
                size={14}
                style={{ color: "var(--text-secondary)", transition: "transform 0.2s ease" }}
                className="menu-chevron"
              />
            </Box>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown
        style={{
          background: "var(--surface-1)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 12px 32px -4px rgba(0, 0, 0, 0.28)",
          borderRadius: "14px",
          padding: "6px",
        }}
      >
        <div style={{ padding: "8px 10px" }}>
          <Text size="sm" fw={600} c="var(--text-primary)" lh={1.2}>
            {displayName}
          </Text>
          {email && (
            <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
              {email}
            </Text>
          )}
        </div>
        <Menu.Divider style={{ borderColor: "var(--border-subtle)", margin: "4px 0" }} />
        <Menu.Item
          leftSection={
            <IconUser style={{ width: rem(15), height: rem(15) }} />
          }
          onClick={handleProfileClick}
          style={{
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            transition: "transform 140ms var(--ease-out), background-color 140ms ease",
          }}
        >
          Profile Settings
        </Menu.Item>
        <Menu.Item
          leftSection={
            isDark ? (
              <IconSun size={15} style={{ color: "var(--text-primary)" }} />
            ) : (
              <IconMoon size={15} style={{ color: "var(--text-primary)" }} />
            )
          }
          onClick={toggleTheme}
          style={{
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            transition: "transform 140ms var(--ease-out), background-color 140ms ease",
          }}
        >
          {isDark ? "Light Mode" : "Dark Mode"}
        </Menu.Item>
        <Menu.Divider style={{ borderColor: "var(--border-subtle)", margin: "4px 0" }} />
        <Menu.Item
          color="red"
          leftSection={
            <IconLogout style={{ width: rem(15), height: rem(15) }} />
          }
          onClick={onLogout}
          style={{
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            transition: "transform 140ms var(--ease-out), background-color 140ms ease",
          }}
        >
          Sign Out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
