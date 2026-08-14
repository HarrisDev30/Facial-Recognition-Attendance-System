import {
  AppShell,
  Group,
  Text,
  NavLink,
  Burger,
  rem,
  ScrollArea,
  Stack,
  UnstyledButton,
  Box,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, Outlet, useLocation } from "react-router-dom";
import { IconLogout, IconBell } from "@tabler/icons-react";
import { useState, useCallback, useEffect, type ReactNode, type MouseEvent } from "react";
import Wordmark from "./Wordmark";
import UserMenu from "./UserMenu";
import ConfirmDialog from "../shared/ConfirmDialog";

export interface NavItem {
  label: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  to: string;
}

interface AppShellChromeProps {
  navItems: NavItem[];
  navLabel?: string;
  headerRight?: ReactNode;
  handleLogout: () => void;
  email?: string;
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string | null;
  hasNotifications?: boolean;
  onNotificationClick?: () => void;
}

export default function AppShellChrome({
  navItems,
  navLabel,
  headerRight,
  handleLogout,
  email,
  firstName,
  lastName,
  profilePhotoUrl,
  hasNotifications = false,
  onNotificationClick,
}: AppShellChromeProps) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [logoutOpen, { open: openLogout, close: closeLogout }] = useDisclosure(false);
  const location = useLocation();

  const isActive = (to: string) =>
    to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(to + "/") || location.pathname === to;

  const links = (
    <Stack gap={0}>
      {navLabel && (
        <Text
          size="xs"
          tt="uppercase"
          fw={400}
          px="sm"
          mb="xs"
          mt="sm"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.5px",
            color: "var(--sidebar-text-muted)",
          }}
        >
          {navLabel}
        </Text>
      )}
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        return (
          <NavLink
            key={item.to}
            component={Link}
            to={item.to}
            label={item.label}
            leftSection={<Icon style={{ width: rem(20), height: rem(20) }} />}
            active={active}
            onClick={close}
          />
        );
      })}
    </Stack>
  );

  const [navbarWidth, setNavbarWidth] = useState(() => {
    const saved = localStorage.getItem("navbar-width");
    return saved ? Number(saved) : 240;
  });
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: globalThis.MouseEvent) => {
      if (!dragging) return;
      const clamped = Math.max(180, Math.min(400, e.clientX));
      setNavbarWidth(clamped);
      localStorage.setItem("navbar-width", String(clamped));
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (dragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: navbarWidth, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Wordmark />
          </Group>
          <Group gap="sm">
            {headerRight}
            <UnstyledButton
              onClick={onNotificationClick}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: rem(8),
                transition: "background-color 0.15s ease",
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <Box style={{ position: "relative" }}>
                <IconBell size={20} />
                {hasNotifications && (
                  <span
                    className="pulse-dot"
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      margin: 0,
                    }}
                  />
                )}
              </Box>
            </UnstyledButton>
            <UserMenu
              email={email ?? undefined}
              firstName={firstName}
              lastName={lastName}
              profilePhotoUrl={profilePhotoUrl}
              onLogout={openLogout}
            />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" style={{ paddingBottom: 0 }}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
        <ScrollArea style={{ flex: 1 }}>{links}</ScrollArea>

        <UnstyledButton
          onClick={openLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: rem(10),
            padding: `${rem(8)} ${rem(12)}`,
            borderRadius: rem(6),
            color: "var(--sidebar-text-muted)",
            fontSize: rem(14),
            width: "100%",
            transition: "background-color 0.1s ease, color 0.1s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--sidebar-hover)";
            e.currentTarget.style.color = "var(--sidebar-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--sidebar-text-muted)";
          }}
        >
          <IconLogout style={{ width: rem(18), height: rem(18) }} />
          Sign out
        </UnstyledButton>

        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: 0,
            right: -8,
            bottom: 0,
            width: 12,
            cursor: "col-resize",
            zIndex: 10,
            transition: "background-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        />
        </div>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <ConfirmDialog
        opened={logoutOpen}
        onClose={closeLogout}
        onConfirm={handleLogout}
        title="Sign out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        color="red"
      />
    </AppShell>
  );
}
