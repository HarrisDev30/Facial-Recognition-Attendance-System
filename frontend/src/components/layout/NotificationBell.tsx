
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Text,
  Group,
  Stack,
  Button,
  Box,
  ScrollArea,
  Popover,
} from "@mantine/core";
import { IconBell } from "@tabler/icons-react";
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

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
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

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      offset={8}
      shadow="md"
      width={320}
      withinPortal
      transitionProps={{ transition: "pop-top-right", duration: 160 }}
    >
      <Popover.Target>
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          onClick={handleToggle}
          className={`theme-toggle-btn notification-bell-btn ${opened ? "is-active" : ""}`}
        >
          <IconBell size={17} stroke={1.75} />
          {unreadCount > 0 && <span className="notification-unread-dot" />}
        </button>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: "var(--surface-1)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 12px 32px -4px rgba(0, 0, 0, 0.28)",
          borderRadius: "14px",
          padding: 0,
          overflow: "hidden",
          maxWidth: "calc(100vw - 24px)",
        }}
      >
        {/* Header Row */}
        <Group
          justify="space-between"
          px="md"
          py="xs"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--surface-0)",
          }}
        >
          <Group gap={6} align="center">
            <Text size="sm" fw={600} c="var(--text-primary)" style={{ letterSpacing: "-0.01em" }}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#10b981",
                  background: "rgba(16, 185, 129, 0.12)",
                  padding: "1px 6px",
                  borderRadius: "5px",
                }}
              >
                {unreadCount} new
              </span>
            )}
          </Group>

          {unreadCount > 0 && (
            <Button
              variant="subtle"
              size="compact-xs"
              color="gray"
              loading={loading}
              onClick={handleMarkAllRead}
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              Mark all as read
            </Button>
          )}
        </Group>

        {/* List Area */}
        <ScrollArea.Autosize mah={360}>
          {notifications.length === 0 ? (
            <Box py="xl" px="md" style={{ textAlign: "center" }}>
              <Text size="sm" fw={600} c="var(--text-primary)">
                No notifications
              </Text>
              <Text size="xs" c="var(--text-muted)" mt={4}>
                You're all caught up.
              </Text>
            </Box>
          ) : (
            <Stack gap={0}>
              {notifications.map((n, idx) => (
                <Box
                  key={n.id}
                  p="sm"
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    cursor: "pointer",
                    transition: "background-color 150ms ease, transform 100ms ease",
                    borderBottom:
                      idx === notifications.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    background: n.is_read ? "transparent" : "var(--surface-0)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = n.is_read
                      ? "transparent"
                      : "var(--surface-0)";
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "scale(0.99)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <Group justify="space-between" align="center" gap={6} wrap="nowrap" mb={2}>
                    <Group gap={6} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
                      {!n.is_read && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: "#10b981",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Text
                        size="xs"
                        fw={n.is_read ? 500 : 600}
                        c="var(--text-primary)"
                        lh={1.25}
                        truncate
                      >
                        {n.title}
                      </Text>
                    </Group>
                    <Text
                      size="10px"
                      c="var(--text-muted)"
                      style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                    >
                      {timeAgo(n.created_at)}
                    </Text>
                  </Group>

                  <Text
                    size="xs"
                    c="var(--text-secondary)"
                    lh={1.35}
                    mt={3}
                    style={{
                      paddingLeft: n.is_read ? 0 : 12,
                      wordBreak: "break-word",
                    }}
                  >
                    {n.message}
                  </Text>
                </Box>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
