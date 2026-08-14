import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Group,
  Select,
  Paper,
  Text,
  Badge,
  Box,
  Pagination,
  SimpleGrid,
} from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { getMyAttendanceLogs } from "../api/attendees";
import type { AttendanceLogEntry } from "../types/auth";
import PageHeader from "../components/layout/PageHeader";
import { usePagination } from "../hooks";
import { formatDate, formatTime, formatConfidence } from "../utils/formatters";

const EVENT_TYPES = [
  { value: "", label: "All types" },
  { value: "intramurals", label: "Intramurals" },
  { value: "seminar", label: "Seminar" },
  { value: "workshop", label: "Workshop" },
  { value: "conference", label: "Conference" },
  { value: "campus_activity", label: "Campus Activity" },
  { value: "assembly", label: "Assembly" },
];

const VERIFICATION_LABELS: Record<string, string> = {
  face_recognition: "Face",
  qr_code: "QR",
  marshal_override: "Manual",
};

const VERIFICATION_COLORS: Record<string, { bg: string; fg: string }> = {
  face_recognition: { bg: "rgba(59, 130, 246, 0.12)", fg: "#3b82f6" },
  marshal_override: { bg: "rgba(249, 115, 22, 0.12)", fg: "#f97316" },
  qr_code: { bg: "rgba(34, 211, 238, 0.12)", fg: "#22d3ee" },
};

export default function AttendanceHistoryPage() {
  const [logs, setLogs] = useState<AttendanceLogEntry[]>([]);
  const { page, setPage, pageSize, total, setTotal } = usePagination(1, 20);
  const [sort, setSort] = useState("date_desc");
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [page, sort, eventType]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await getMyAttendanceLogs({
        page,
        size: pageSize,
        sort,
        event_type: eventType || undefined,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const dayGroups = useMemo(() => {
    const groups: { date: string; items: typeof logs }[] = [];
    for (const row of logs) {
      const date = formatDate(row.session_date || row.check_in_time);
      let group = groups[groups.length - 1];
      if (!group || group.date !== date) {
        group = { date, items: [] };
        groups.push(group);
      }
      group.items.push(row);
    }
    return groups;
  }, [logs]);

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader title="Attendance History" />

      <SimpleGrid cols={{ base: 2, xs: 2 }} mb="md">
        <Select
          size="sm"
          placeholder="Event Type"
          value={eventType}
          onChange={(v) => {
            setEventType(v || "");
            setPage(1);
          }}
          data={EVENT_TYPES}
          clearable
        />
        <Select
          size="sm"
          placeholder="Sort By"
          value={sort}
          onChange={(v) => {
            setSort(v || "date_desc");
            setPage(1);
          }}
          data={[
            { value: "date_desc", label: "Newest first" },
            { value: "date_asc", label: "Oldest first" },
            { value: "event_name", label: "By event name" },
          ]}
        />
      </SimpleGrid>

      {!loading && logs.length === 0 ? (
        <Paper p="xl" radius="md" bg="var(--surface-1)" ta="center">
          <IconClock size={40} style={{ opacity: 0.15 }} />
          <Text c="dimmed" mt="md">
            No attendance records found.
          </Text>
        </Paper>
      ) : (
        <Paper radius="md" bg="var(--surface-1)" style={{ overflow: "hidden" }}>
          {dayGroups.map((group) => (
            <Box key={group.date}>
              <Box
                px="md"
                py="xs"
                style={{
                  background: "var(--surface-0)",
                  borderBottom: "1px solid var(--border-subtle)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  {group.date}
                </Text>
              </Box>
              {group.items.map((row, i) => (
                <LogRow
                  key={row.id ?? i}
                  row={row}
                  isLast={i === group.items.length - 1}
                />
              ))}
            </Box>
          ))}
        </Paper>
      )}

      {total > pageSize && (
        <Group justify="center" pt="md">
          <Pagination
            total={Math.ceil(total / pageSize)}
            value={page}
            onChange={setPage}
          />
        </Group>
      )}
    </Container>
  );
}

function LogRow({
  row,
  isLast,
}: {
  row: AttendanceLogEntry;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const vc = VERIFICATION_COLORS[row.verification_method];

  const toTitleCase = (s: string) =>
    s
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? "var(--surface-2)" : undefined,
        borderBottom: isLast ? undefined : "1px solid var(--border-subtle)",
        transition: "background-color 0.15s ease, transform 0.15s ease",
        transform: hovered ? "scale(1.01)" : undefined,
        padding: "var(--mantine-spacing-sm) var(--mantine-spacing-md)",
      }}
    >
      <Group align="flex-start" wrap="nowrap">
        <Box
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--mantine-radius-md)",
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconClock size={20} style={{ opacity: 0.6 }} />
        </Box>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text
              size="sm"
              fw={600}
              style={{ wordBreak: "break-word" }}
            >
              {row.event_name}
            </Text>
            <Badge
              size="xs"
              variant="light"
              style={{ flexShrink: 0 }}
              styles={{
                root: {
                  background: vc
                    ? vc.bg
                    : "rgba(136, 136, 136, 0.12)",
                  color: vc ? vc.fg : "#888888",
                },
              }}
            >
              {VERIFICATION_LABELS[row.verification_method] ||
                row.verification_method}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {formatTime(row.check_in_time)}
            {row.session_name
              ? ` \u00b7 ${toTitleCase(row.session_name)}`
              : ""}
            {row.confidence_score != null &&
              ` \u00b7 ${formatConfidence(row.confidence_score)} confidence`}
          </Text>
        </div>
      </Group>
    </Box>
  );
}
