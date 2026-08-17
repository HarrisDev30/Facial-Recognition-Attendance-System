import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Text,
  Group,
  Stack,
  Button,
  Box,
  ScrollArea,
  Indicator,
  ThemeIcon,
  UnstyledButton,
  Paper,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconBell,
  IconCalendar,
  IconCheck,
  IconUsers,
  IconInfoCircle,
  IconChecklist,
  IconBellOff,
} from "@tabler/icons-react";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../api/notifications";
import type { NotificationItem } from "../../api/notifications";
import { timeAgo } from "../../utils/formatters";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMobile = useMediaQuery("(max-width: 576px)");

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getMyNotifications();
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpened(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    setOpened((prev) => {
      const next = !prev;
      if (next) {
        loadNotifications();
      }
      return next;
    });
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationRead(notif.id);
      } catch {
        /* ignore */
      }
    }
    setOpened(false);
    if (notif.link_url) {
      navigate(notif.link_url);
    }
  };

  const handleSingleMarkRead = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(notifId);
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    // Optimistic clear
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const getCategoryMeta = (type: string) => {
    switch (type) {
      case "cohost_invite":
        return {
          icon: <IconUsers size={15} style={{ color: "#c084fc" }} />,
          label: "Co-Host Invite",
          color: "grape",
          accentColor: "#c084fc",
          bgColor: "rgba(192, 132, 252, 0.08)",
        };
      case "event_announcement":
        return {
          icon: <IconCalendar size={15} style={{ color: "#60a5fa" }} />,
          label: "Event",
          color: "blue",
          accentColor: "#60a5fa",
          bgColor: "rgba(96, 165, 250, 0.08)",
        };
      case "attendance_checkin":
        return {
          icon: <IconCheck size={15} style={{ color: "#4ade80" }} />,
          label: "Check-In",
          color: "teal",
          accentColor: "#4ade80",
          bgColor: "rgba(74, 222, 128, 0.08)",
        };
      default:
        return {
          icon: <IconInfoCircle size={15} style={{ color: "#fbbf24" }} />,
          label: "Notice",
          color: "yellow",
          accentColor: "#fbbf24",
          bgColor: "rgba(251, 191, 36, 0.08)",
        };
    }
  };

  return (
    <Box ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <UnstyledButton
        aria-label="Notifications"
        onClick={handleToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: "10px",
          transition: "all 0.2s ease",
          color: opened ? "#2dd4bf" : "var(--text-secondary)",
          backgroundColor: opened ? "rgba(45, 212, 191, 0.12)" : "transparent",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!opened) {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color = "var(--text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!opened) {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }
        }}
      >
        <Indicator
          disabled={unreadCount === 0}
          label={unreadCount > 9 ? "9+" : unreadCount}
          size={18}
          color="red"
          offset={-2}
          processing={unreadCount > 0}
        >
          <IconBell size={20} />
        </Indicator>
      </UnstyledButton>

      {opened && (
        <Paper
          p="xs"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: isMobile ? "-12px" : 0,
            width: isMobile ? "calc(100vw - 32px)" : "360px",
            maxWidth: "calc(100vw - 32px)",
            zIndex: 1000,
            background: "#121214",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0px 20px 40px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)",
            borderRadius: "14px",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          <Group justify="space-between" px="xs" py="xs" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <Group gap="xs">
              <Text size="sm" fw={700} style={{ letterSpacing: "-0.01em" }}>
                Notifications
              </Text>
              {unreadCount > 0 && (
                <Badge size="xs" color="teal" variant="light" radius="sm" style={{ fontWeight: 600 }}>
                  {unreadCount} new
                </Badge>
              )}
            </Group>
            {unreadCount > 0 && (
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                leftSection={<IconChecklist size={12} />}
                loading={loading}
                onClick={handleMarkAllRead}
                style={{ fontSize: "11px" }}
              >
                Mark all read
              </Button>
            )}
          </Group>

          <ScrollArea.Autosize mah={isMobile ? 300 : 380} mx="-xs" px="xs" mt="xs">
            {notifications.length === 0 ? (
              <Box
                py="xl"
                px="md"
                style={{
                  textAlign: "center",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: "10px",
                  margin: "8px 0",
                  border: "1px stroke rgba(255,255,255,0.04)",
                }}
              >
                <ThemeIcon
                  size={46}
                  radius="xl"
                  variant="light"
                  color="teal"
                  mx="auto"
                  mb="xs"
                  style={{ background: "rgba(45, 212, 191, 0.08)" }}
                >
                  <IconBellOff size={22} style={{ color: "#2dd4bf" }} />
                </ThemeIcon>
                <Text size="sm" fw={600} c="dimmed">
                  All caught up! 🎉
                </Text>
                <Text size="xs" c="dimmed" mt={2} style={{ opacity: 0.7 }}>
                  You have no new notifications or alerts at the moment.
                </Text>
              </Box>
            ) : (
              <Stack gap={6}>
                {notifications.map((n) => {
                  const meta = getCategoryMeta(n.notification_type);
                  return (
                    <Box
                      key={n.id}
                      p="xs"
                      style={{
                        borderRadius: "10px",
                        background: n.is_read ? "transparent" : meta.bgColor,
                        borderLeft: n.is_read ? "3px solid transparent" : `3px solid ${meta.accentColor}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        position: "relative",
                      }}
                      className="notification-item"
                      onClick={() => handleNotificationClick(n)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = n.is_read ? "transparent" : meta.bgColor;
                      }}
                    >
                      <Group align="flex-start" gap="xs" wrap="nowrap">
                        <ThemeIcon
                          size={28}
                          radius="md"
                          variant="light"
                          color={meta.color}
                          mt={2}
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          {meta.icon}
                        </ThemeIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Group justify="space-between" align="center" gap={4} wrap="nowrap" mb={2}>
                            <Badge size="xs" color={meta.color} variant="outline" radius="xs" style={{ fontSize: "9px", padding: "0 4px", height: "16px" }}>
                              {meta.label}
                            </Badge>
                            <Text size="10px" c="dimmed" style={{ opacity: 0.6 }}>
                              {timeAgo(n.created_at)}
                            </Text>
                          </Group>
                          <Text size="xs" fw={n.is_read ? 500 : 700} lh={1.3} truncate>
                            {n.title}
                          </Text>
                          <Text size="xs" c="dimmed" lh={1.35} mt={2} style={{ fontSize: "11px", wordBreak: "break-word" }}>
                            {n.message}
                          </Text>
                        </div>
                        {!n.is_read && (
                          <Tooltip label="Mark read" position="left" withArrow>
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="gray"
                              onClick={(e) => handleSingleMarkRead(e, n.id)}
                              style={{ opacity: 0.6 }}
                            >
                              <IconCheck size={12} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </ScrollArea.Autosize>
        </Paper>
      )}
    </Box>
  );
}
