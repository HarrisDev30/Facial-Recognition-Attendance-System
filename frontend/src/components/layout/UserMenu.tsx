import { useNavigate } from "react-router-dom";
import {
  Text,
  UnstyledButton,
  Group,
  Menu,
  rem,
} from "@mantine/core";
import {
  IconLogout,
  IconChevronDown,
  IconUser,
} from "@tabler/icons-react";
import Avatar from "../Avatar";

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
  const displayName = firstName ? `${firstName} ${lastName ?? ""}`.trim() : email ?? "User";

  return (
    <Menu shadow="md" width={240} offset={8}>
      <Menu.Target>
        <UnstyledButton>
          <Group gap="xs">
            <Avatar
              src={profilePhotoUrl}
              firstName={firstName}
              lastName={lastName}
              size="sm"
            />
            <Text size="sm" visibleFrom="sm">
              {firstName ?? email ?? "User"}
            </Text>
            <IconChevronDown
              size={14}
              style={{ color: "var(--text-secondary)", transition: "transform 0.2s ease" }}
              className="menu-chevron"
            />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown
        style={{
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0px 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ padding: `${rem(8)} ${rem(12)}` }}>
          <Text size="sm" fw={600}>
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
          onClick={() => navigate("/profile")}
        >
          Profile Settings
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
