import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  ActionIcon,
  Badge,
  Text,
  Group,
  Stack,
  Button,
  Box,
  ScrollArea,
  Indicator,
  ThemeIcon,
} from "@mantine/core";
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
import { formatDate } from "../../utils/formatters";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const handleNotificationClick = async (notif: NotificationItem) => {
    setOpened(false);
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        /* ignore */
      }
    }
    if (notif.link_url) {
      navigate(notif.link_url);
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "cohost_invite":
        return <IconUsers size={16} style={{ color: "#c084fc" }} />;
      case "event_announcement":
        return <IconCalendar size={16} style={{ color: "#60a5fa" }} />;
      case "attendance_checkin":
        return <IconCheck size={16} style={{ color: "#4ade80" }} />;
      default:
        return <IconInfoCircle size={16} style={{ color: "#fbbf24" }} />;
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={360}
      position="bottom-end"
      shadow="xl"
      withArrow
      arrowSize={10}
      transitionProps={{ transition: "pop", duration: 150 }}
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          radius="md"
          onClick={() => {
            setOpened((o) => !o);
            loadNotifications();
          }}
          aria-label="Notifications"
          style={{
            position: "relative",
            transition: "all 0.15s ease",
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
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown
        p="xs"
        style={{
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0px 12px 32px rgba(0,0,0,0.7)",
          borderRadius: "12px",
        }}
      >
        <Group justify="space-between" px="xs" py="xs" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Group gap="xs">
            <Text size="sm" fw={700}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <Badge size="xs" color="teal" variant="light" radius="sm">
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
            >
              Mark all read
            </Button>
          )}
        </Group>

        <ScrollArea.Autosize mah={360} mx="-xs" px="xs" mt="xs">
          {notifications.length === 0 ? (
            <Box
              py="xl"
              px="md"
              style={{
                textAlign: "center",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "8px",
                margin: "8px 0",
              }}
            >
              <ThemeIcon
                size={44}
                radius="xl"
                variant="light"
                color="gray"
                mx="auto"
                mb="xs"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <IconBellOff size={22} style={{ opacity: 0.7 }} />
              </ThemeIcon>
              <Text size="sm" fw={600} c="dimmed">
                All caught up! 🎉
              </Text>
              <Text size="xs" c="dimmed" mt={2} style={{ opacity: 0.7 }}>
                You have no new notifications or alerts at the moment.
              </Text>
            </Box>
          ) : (
            <Stack gap={4}>
              {notifications.map((n) => (
                <Box
                  key={n.id}
                  p="xs"
                  style={{
                    borderRadius: "8px",
                    background: n.is_read ? "transparent" : "rgba(45, 212, 191, 0.07)",
                    borderLeft: n.is_read ? "3px solid transparent" : "3px solid #2dd4bf",
                    cursor: "pointer",
                    transition: "background 0.15s ease, transform 0.1s ease",
                  }}
                  className="notification-item"
                  onClick={() => handleNotificationClick(n)}
                >
                  <Group align="flex-start" gap="xs" wrap="nowrap">
                    <Box mt={2}>{getIcon(n.notification_type)}</Box>
                    <div style={{ flex: 1 }}>
                      <Text size="xs" fw={n.is_read ? 500 : 700} lh={1.3}>
                        {n.title}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1.3} mt={2}>
                        {n.message}
                      </Text>
                      <Text size="10px" c="dimmed" mt={4} style={{ opacity: 0.6 }}>
                        {formatDate(n.created_at)}
                      </Text>
                    </div>
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
