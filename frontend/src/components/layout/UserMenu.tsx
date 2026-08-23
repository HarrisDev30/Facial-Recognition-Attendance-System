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
    <Menu shadow="md" width={240} offset={8}>
      <Menu.Target>
        <UnstyledButton className="btn-pressable">
          <Group gap="xs">
            <Avatar
              src={profilePhotoUrl}
              firstName={firstName}
              lastName={lastName}
              size="sm"
            />
            <Text size="sm" visibleFrom="sm" c="var(--text-primary)">
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
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ padding: `${rem(8)} ${rem(12)}` }}>
          <Text size="sm" fw={600} c="var(--text-primary)">
            {displayName}
          </Text>
          {email && (
            <Text size="xs" c="dimmed">
              {email}
            </Text>
          )}
        </div>
        <Menu.Divider />
        <Menu.Item
          leftSection={
            <IconUser style={{ width: rem(16), height: rem(16) }} />
          }
          onClick={handleProfileClick}
        >
          Profile Settings
        </Menu.Item>
        <Menu.Item
          leftSection={
            isDark ? (
              <IconSun size={16} style={{ color: "var(--text-primary)" }} />
            ) : (
              <IconMoon size={16} style={{ color: "var(--text-primary)" }} />
            )
          }
          onClick={toggleTheme}
        >
          {isDark ? "Light Mode" : "Dark Mode"}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={
            <IconLogout style={{ width: rem(16), height: rem(16) }} />
          }
          onClick={onLogout}
        >
          Sign Out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
