import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Group,
  Select,
  Text,
  Box,
  Pagination,
  Skeleton,
} from "@mantine/core";
import {
  IconHistory,
  IconClock,
  IconShieldCheck,
  IconQrcode,
  IconUserCheck,
  IconCalendar,
} from "@tabler/icons-react";
import { getMyAttendanceLogs } from "../../api/attendees";
import type { AttendanceLogEntry } from "../../types/auth";
import EmptyState from "../../components/EmptyState";
import { usePagination } from "../../hooks";
import { formatDate, formatTime, formatConfidence } from "../../utils/formatters";
import "./AttendanceHistoryPage.css";

const EVENT_TYPES = [
  { value: "", label: "All event types" },
  { value: "intramurals", label: "Intramurals" },
  { value: "seminar", label: "Seminar" },
  { value: "workshop", label: "Workshop" },
  { value: "conference", label: "Conference" },
  { value: "campus_activity", label: "Campus Activity" },
  { value: "assembly", label: "Assembly" },
];

type MethodFilter = "all" | "face_recognition" | "qr_code" | "marshal_override";

export default function AttendanceHistoryPage() {
  const [logs, setLogs] = useState<AttendanceLogEntry[]>([]);
  const { page, setPage, pageSize, total, setTotal } = usePagination(1, 20);
  const [sort, setSort] = useState("date_desc");
  const [eventType, setEventType] = useState("");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
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

  // Client-side method filtering for instant feedback
  const filteredLogs = useMemo(() => {
    if (methodFilter === "all") return logs;
    return logs.filter((row) => row.verification_method === methodFilter);
  }, [logs, methodFilter]);

  const dayGroups = useMemo(() => {
    const groups: { date: string; items: typeof filteredLogs }[] = [];
    for (const row of filteredLogs) {
      const date = formatDate(row.session_date || row.check_in_time);
      let group = groups[groups.length - 1];
      if (!group || group.date !== date) {
        group = { date, items: [] };
        groups.push(group);
      }
      group.items.push(row);
    }
    return groups;
  }, [filteredLogs]);

  // Telemetry counts
  const faceIdCount = useMemo(
    () => logs.filter((l) => l.verification_method === "face_recognition").length,
    [logs],
  );

  return (
    <Container
      fluid
      pt={0}
      pb={{ base: "6.5rem", sm: "4xl" }}
      px={0}
      style={{ maxWidth: 1440 }}
    >
      {/* ─── 1. Header Card ─── */}
      <div className="history-header-card">
        <div className="history-header-text">
          <Group gap={8} align="center">
            <IconHistory size={20} style={{ color: "var(--brand-primary)" }} />
            <Text
              fz={{ base: "1.25rem", sm: "1.5rem" }}
              fw={600}
              c="var(--text-primary)"
              lh={1.2}
              lts="-0.02em"
            >
              Attendance History
            </Text>
          </Group>
          <Text fz="0.8125rem" c="var(--text-secondary)" mt={4}>
            View all recorded attendance and check-in times.
          </Text>
        </div>

        {/* Ribbon Counts Pod */}
        <div className="history-telemetry-ribbon">
          <div className="history-ribbon-pod">
            <span className="history-pod-val">{total}</span>
            <span className="history-pod-lbl">Total Records</span>
          </div>
          <div className="history-pod-divider" />
          <div className="history-ribbon-pod">
            <span className="history-pod-val verified">
              {logs.length > 0
                ? `${Math.round((faceIdCount / logs.length) * 100)}%`
                : "100%"}
            </span>
            <span className="history-pod-lbl">Face ID</span>
          </div>
        </div>
      </div>

      {/* ─── 2. Controls Toolbar ─── */}
      <div className="history-toolbar">
        {/* Method Filter Chips */}
        <div className="history-filter-chips">
          <button
            type="button"
            className={`history-chip ${methodFilter === "all" ? "is-active" : ""}`}
            onClick={() => setMethodFilter("all")}
          >
            All Methods
          </button>
          <button
            type="button"
            className={`history-chip ${methodFilter === "face_recognition" ? "is-active" : ""}`}
            onClick={() => setMethodFilter("face_recognition")}
          >
            <span className="history-chip-dot face" />
            Face ID
          </button>
          <button
            type="button"
            className={`history-chip ${methodFilter === "qr_code" ? "is-active" : ""}`}
            onClick={() => setMethodFilter("qr_code")}
          >
            <span className="history-chip-dot qr" />
            QR Code
          </button>
          <button
            type="button"
            className={`history-chip ${methodFilter === "marshal_override" ? "is-active" : ""}`}
            onClick={() => setMethodFilter("marshal_override")}
          >
            <span className="history-chip-dot marshal" />
            Manual
          </button>
        </div>

        {/* Dropdown Filters */}
        <Group gap="xs" wrap="nowrap">
          <Select
            size="xs"
            placeholder="Event type"
            value={eventType}
            onChange={(v) => {
              setEventType(v || "");
              setPage(1);
            }}
            data={EVENT_TYPES}
            clearable
            style={{ width: 150 }}
            styles={{
              input: {
                borderRadius: "6px",
                backgroundColor: "var(--surface-0)",
                borderColor: "var(--border-subtle)",
                fontSize: "13px",
                height: "32px",
              },
            }}
          />

          <Select
            size="xs"
            placeholder="Sort by"
            value={sort}
            onChange={(v) => {
              setSort(v || "date_desc");
              setPage(1);
            }}
            data={[
              { value: "date_desc", label: "Newest first" },
              { value: "date_asc", label: "Oldest first" },
              { value: "event_name", label: "Event name" },
            ]}
            style={{ width: 140 }}
            styles={{
              input: {
                borderRadius: "6px",
                backgroundColor: "var(--surface-0)",
                borderColor: "var(--border-subtle)",
                fontSize: "13px",
                height: "32px",
              },
            }}
          />
        </Group>
      </div>

      {/* ─── 3. Timeline Feed Layout ─── */}
      {loading && (
        <Box style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Skeleton height={80} radius="md" />
          <Skeleton height={80} radius="md" />
          <Skeleton height={80} radius="md" />
        </Box>
      )}

      {!loading && filteredLogs.length === 0 ? (
        <EmptyState
          title="No attendance records found"
          description="Check-in records will appear here automatically when you attend campus sessions."
          icon={<IconHistory size={32} />}
        />
      ) : (
        !loading && (
          <div className="history-timeline-feed">
            {dayGroups.map((group) => (
              <div key={group.date} className="history-milestone-group">
                {/* Date Milestone Header */}
                <div className="history-milestone-header">
                  <div className="history-milestone-tag">
                    <IconCalendar size={14} style={{ color: "var(--text-secondary)" }} />
                    <span>{group.date}</span>
                  </div>
                  <span className="history-milestone-count">
                    {group.items.length} {group.items.length === 1 ? "check-in" : "check-ins"}
                  </span>
                </div>

                {/* Milestone Cards Stack */}
                <div className="history-milestone-stack">
                  {group.items.map((row) => (
                    <HistoryRecordCard
                      key={row.id || `${row.event_name}-${row.check_in_time}`}
                      row={row}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {total > pageSize && (
        <Group justify="center" pt="xl">
          <Pagination
            total={Math.ceil(total / pageSize)}
            value={page}
            onChange={setPage}
            size="sm"
            radius="md"
          />
        </Group>
      )}
    </Container>
  );
}

function HistoryRecordCard({ row }: { row: AttendanceLogEntry }) {
  const method = row.verification_method;

  const toTitleCase = (s: string) =>
    s
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const isFace = method === "face_recognition";
  const isQr = method === "qr_code";

  return (
    <div className="history-record-card">
      {/* Desktop Monospace Time Anchor */}
      <div className="record-time-anchor">
        <IconClock size={13} />
        <span>{formatTime(row.check_in_time)}</span>
      </div>

      {/* Main Content Details */}
      <div className="record-info-body">
        <div className="record-title-row">
          <Text className="record-event-name">{row.event_name}</Text>

          {/* Mobile Verification Capsule */}
          <div
            className={`record-verify-capsule mobile-only ${
              isFace ? "face" : isQr ? "qr" : "marshal"
            }`}
          >
            {isFace ? (
              <IconShieldCheck size={11} style={{ color: "#10b981" }} />
            ) : isQr ? (
              <IconQrcode size={11} style={{ color: "#3b82f6" }} />
            ) : (
              <IconUserCheck size={11} style={{ color: "#f59e0b" }} />
            )}
            <span>{isFace ? "Face ID" : isQr ? "QR" : "Manual"}</span>
          </div>
        </div>

        <div className="record-meta-line">
          {/* Mobile Timestamp */}
          <span className="record-time-mobile">
            <IconClock size={12} />
            <span>{formatTime(row.check_in_time)}</span>
          </span>

          {row.session_name && (
            <>
              <span className="record-meta-dot">•</span>
              <span>{toTitleCase(row.session_name)}</span>
            </>
          )}

          {row.venue && (
            <>
              <span className="record-meta-dot">•</span>
              <span>{row.venue}</span>
            </>
          )}
        </div>
      </div>

      {/* Desktop Verification Capsule */}
      <div
        className={`record-verify-capsule desktop-only ${
          isFace ? "face" : isQr ? "qr" : "marshal"
        }`}
      >
        {isFace ? (
          <IconShieldCheck size={13} style={{ color: "#10b981" }} />
        ) : isQr ? (
          <IconQrcode size={13} style={{ color: "#3b82f6" }} />
        ) : (
          <IconUserCheck size={13} style={{ color: "#f59e0b" }} />
        )}
        <span>{isFace ? "Face ID" : isQr ? "QR Code" : "Manual"}</span>
        {row.confidence_score != null && (
          <span className="verify-match-text">
            • {formatConfidence(row.confidence_score)}
          </span>
        )}
      </div>
    </div>
  );
}
