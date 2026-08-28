import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Modal,
  Stack,
  Text,
  UnstyledButton,
  Group,
  Badge,
  Skeleton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconScan,
  IconDeviceMobile,
  IconQrcode,
  IconUsers,
  IconChevronRight,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { getActiveSessions, type ActiveSession } from "../../api/marshal";

interface MarshalScanModalProps {
  opened: boolean;
  onClose: () => void;
  onOpenStudents: () => void;
}

export default function MarshalScanModal({
  opened,
  onClose,
  onOpenStudents,
}: MarshalScanModalProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setLoading(true);
      getActiveSessions()
        .then((data) => {
          setSessions(data || []);
          if (data && data.length > 0) {
            setSelectedSessionId(data[0].session_id);
          }
        })
        .catch(() => setSessions([]))
        .finally(() => setLoading(false));
    }
  }, [opened]);

  const handleLaunch = (mode: "kiosk" | "mobile" | "qr") => {
    onClose();
    const targetSessionId = selectedSessionId || sessions[0]?.session_id;

    if (!targetSessionId) {
      navigate("/marshal/events");
      return;
    }

    if (mode === "kiosk") {
      navigate(`/marshal/scanner/${targetSessionId}`);
    } else if (mode === "mobile") {
      navigate(`/marshal/scanner/mobile/${targetSessionId}?mode=face`);
    } else if (mode === "qr") {
      navigate(`/marshal/scanner/mobile/${targetSessionId}?mode=qr`);
    }
  };

  const hasLiveSession = sessions.length > 0;
  const currentSession = sessions.find((s) => s.session_id === selectedSessionId) || sessions[0];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      classNames={{ root: "marshal-scan-modal-root" }}
      title={
        <Group gap="xs">
          <IconScan size={20} color="var(--brand-primary, #10b981)" />
          <Text fw={700} size="md">
            Check-In Scanner
          </Text>
        </Group>
      }
      centered
      radius="lg"
      styles={{
        header: {
          paddingBottom: "8px",
        },
        body: {
          paddingTop: "8px",
        },
      }}
    >
      <Stack gap="sm">
        {loading ? (
          <Skeleton height={50} radius="md" />
        ) : hasLiveSession ? (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface-0)",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <Group gap={6}>
                <Badge size="xs" color="teal" variant="light">
                  Active Station
                </Badge>
                <Text size="xs" c="dimmed">
                  {currentSession.event_name}
                </Text>
              </Group>
              <Text size="sm" fw={600} truncate c="var(--text-primary)" mt={2}>
                {currentSession.session_name}
              </Text>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <Badge size="sm" variant="outline" color="teal">
                {currentSession.checked_in_count || 0} In
              </Badge>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "12px 14px",
              background: "var(--surface-0)",
              borderRadius: "12px",
              border: "1px dashed var(--border-subtle)",
              textAlign: "center",
            }}
          >
            <Text size="xs" c="dimmed">
              No live stations right now. Pick a scanner mode to browse upcoming events.
            </Text>
          </div>
        )}

        <Text size="xs" fw={600} c="dimmed" tt="uppercase" mt={4}>
          Choose Scanner Mode
        </Text>

        {/* Option 1: Face Scanner (Only on Laptop / Desktop screens) */}
        {!isMobile && (
          <UnstyledButton
            onClick={() => handleLaunch("kiosk")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "var(--surface-1)",
              border: "1px solid var(--border-subtle)",
              transition: "all 150ms ease",
            }}
          >
            <Group gap="sm" wrap="nowrap">
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "var(--brand-primary, #10b981)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconScan size={20} />
              </div>
              <div>
                <Text size="sm" fw={600} c="var(--text-primary)">
                  Station Kiosk (Laptop / Desktop)
                </Text>
                <Text size="xs" c="dimmed">
                  Dual-panel face recognition workstation
                </Text>
              </div>
            </Group>
            <IconChevronRight size={16} color="var(--text-muted)" />
          </UnstyledButton>
        )}

        {/* Option 2: Phone Camera Scanner */}
        <UnstyledButton
          onClick={() => handleLaunch("mobile")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "12px",
            background: "var(--surface-1)",
            border: "1px solid var(--border-subtle)",
            transition: "all 150ms ease",
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.12)",
                color: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconDeviceMobile size={20} />
            </div>
            <div>
              <Text size="sm" fw={600} c="var(--text-primary)">
                Phone Scanner
              </Text>
              <Text size="xs" c="dimmed">
                Handheld mobile check-in mode
              </Text>
            </div>
          </Group>
          <IconChevronRight size={16} color="var(--text-muted)" />
        </UnstyledButton>

        {/* Option 3: QR Code Scanner */}
        <UnstyledButton
          onClick={() => handleLaunch("qr")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "12px",
            background: "var(--surface-1)",
            border: "1px solid var(--border-subtle)",
            transition: "all 150ms ease",
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                background: "rgba(6, 182, 212, 0.12)",
                color: "#06b6d4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconQrcode size={20} />
            </div>
            <div>
              <Text size="sm" fw={600} c="var(--text-primary)">
                QR Code Scanner
              </Text>
              <Text size="xs" c="dimmed">
                Scan student digital passes
              </Text>
            </div>
          </Group>
          <IconChevronRight size={16} color="var(--text-muted)" />
        </UnstyledButton>

        {/* Option 4: Search Students / Manual Check-In */}
        <UnstyledButton
          onClick={() => {
            onClose();
            onOpenStudents();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "12px",
            background: "var(--surface-1)",
            border: "1px solid var(--border-subtle)",
            transition: "all 150ms ease",
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                background: "rgba(245, 158, 11, 0.12)",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconUsers size={20} />
            </div>
            <div>
              <Text size="sm" fw={600} c="var(--text-primary)">
                Search Students
              </Text>
              <Text size="xs" c="dimmed">
                Lookup student name or ID for manual check-in
              </Text>
            </div>
          </Group>
          <IconChevronRight size={16} color="var(--text-muted)" />
        </UnstyledButton>

        {!hasLiveSession && (
          <UnstyledButton
            onClick={() => {
              onClose();
              navigate("/marshal/events");
            }}
            style={{
              marginTop: "4px",
              padding: "8px",
              textAlign: "center",
              width: "100%",
            }}
          >
            <Group justify="center" gap={6}>
              <IconCalendarEvent size={14} color="var(--brand-primary)" />
              <Text size="xs" fw={600} c="var(--brand-primary)">
                View All Events & Start a Session
              </Text>
            </Group>
          </UnstyledButton>
        )}
      </Stack>
    </Modal>
  );
}
