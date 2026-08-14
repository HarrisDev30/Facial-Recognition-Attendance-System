import { useCallback, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Paper,
  Badge,
  Text,
  Group,
  Button,
  SegmentedControl,
  Select,
  CopyButton,
  ActionIcon,
} from "@mantine/core";
import { IconPrinter, IconDownload, IconCopy } from "@tabler/icons-react";
import { useReactToPrint } from "react-to-print";
import * as sessionsApi from "../api/sessions";
import * as attendanceApi from "../api/attendance";
import * as attendeesApi from "../api/attendees";
import type { SessionResponse } from "../types/session";
import type { AttendanceLogResponse, AttendanceSummary } from "../api/attendance";
import type { AttendeeResponse } from "../api/attendees";
import { useAsync } from "../hooks";
import { formatDateTime, formatConfidence } from "../utils/formatters";
import DataTable from "../components/shared/DataTable";
import VerificationBadge from "../components/shared/VerificationBadge";
import PageHeader from "../components/layout/PageHeader";
import StatsRow from "../components/StatsRow";
import { generateCSV, downloadCSV } from "../utils/export-csv";

type StatusFilter = "all" | "present" | "absent";
const MDASH = "\u2014";
const NDASH = "\u2013";

function shortId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface UnifiedRow {
  id: string;
  index: number;
  identifier: string;
  name: string;
  department: string;
  attendeeType: string;
  status: "present" | "absent";
  verifiedAt: string | null;
  verificationMethod: string | null;
  confidenceScore: number | null;
}

export default function AdminSessionAttendancePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Attendance Report",
  });

  const loadData = useCallback(async () => {
    if (!sessionId) {
      return {
        session: null as SessionResponse | null,
        logs: [] as AttendanceLogResponse[],
        summary: null as AttendanceSummary | null,
        attendees: [] as AttendeeResponse[],
      };
    }
    const [sess, logData, summ, attendees] = await Promise.all([
      sessionsApi.getSession(sessionId),
      attendanceApi.getSessionLogs(sessionId),
      attendanceApi.getSessionSummary(sessionId),
      attendeesApi.getAttendees(),
    ]);
    return { session: sess, logs: logData, summary: summ, attendees };
  }, [sessionId]);

  const { data, loading } = useAsync(loadData, true);

  const session = data?.session ?? null;
  const logs = data?.logs ?? [];
  const summary = data?.summary ?? null;
  const attendees = data?.attendees ?? [];

  const departments = useMemo(() => {
    const deptMap = new Map<string, string>();
    for (const a of attendees) {
      if (a.department_name && a.department_id) {
        deptMap.set(a.department_id, a.department_name);
      }
    }
    return Array.from(deptMap.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [attendees]);

  const checkedInIds = useMemo(
    () => new Set(logs.map((l) => l.attendee_id)),
    [logs],
  );
  const logByAttendee = useMemo(() => {
    const map = new Map<string, AttendanceLogResponse>();
    for (const l of logs) {
      map.set(l.attendee_id, l);
    }
    return map;
  }, [logs]);

  const unifiedRows: UnifiedRow[] = useMemo(
    () =>
      attendees.map((a, i) => {
        const log = logByAttendee.get(a.id);
        return {
          id: a.id,
          index: i + 1,
          identifier: a.identifier,
          name: `${a.last_name}, ${a.first_name}`,
          department: a.department_name ?? MDASH,
          attendeeType: a.attendee_type,
          status: checkedInIds.has(a.id) ? ("present" as const) : ("absent" as const),
          verifiedAt: log?.verified_at ?? null,
          verificationMethod: log?.verification_method ?? null,
          confidenceScore: log?.confidence_score ?? null,
        };
      }),
    [attendees, checkedInIds, logByAttendee],
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    let rows = unifiedRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.identifier.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (typeFilter) {
      rows = rows.filter((r) => r.attendeeType === typeFilter);
    }
    return rows;
  }, [unifiedRows, search, statusFilter, typeFilter]);

  const displayedRows = useMemo(() => {
    if (!deptFilter) return filteredRows;
    const deptAttendeeIds = new Set(
      attendees.filter((a) => a.department_id === deptFilter).map((a) => a.id),
    );
    return filteredRows.filter((r) => deptAttendeeIds.has(r.id));
  }, [filteredRows, deptFilter, attendees]);

  const statusCounts = useMemo(() => {
    const present = unifiedRows.filter((r) => r.status === "present").length;
    return {
      all: unifiedRows.length,
      present,
      absent: unifiedRows.length - present,
    };
  }, [unifiedRows]);

  const rate = summary && summary.total_attendees > 0
    ? Math.round((summary.present_count / summary.total_attendees) * 100)
    : 0;

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Name",
      "Department",
      "Type",
      "Status",
      "Check-in Time",
      "Method",
      "Confidence",
    ];
    const csvRows = displayedRows.map((r) => [
      r.identifier,
      r.name,
      r.department,
      r.attendeeType,
      r.status,
      r.verifiedAt ? formatDateTime(r.verifiedAt) : "-",
      r.verificationMethod ?? "-",
      r.confidenceScore != null ? `${(r.confidenceScore * 100).toFixed(1)}%` : "-",
    ]);
    downloadCSV(
      `attendance-${session?.name ?? "report"}-${new Date().toISOString().slice(0, 10)}.csv`,
      generateCSV(headers, csvRows),
    );
  };

  const headerSubtitle = session
    ? `${formatDate(session.start_time)} ${formatTime(session.start_time)} ${NDASH} ${formatTime(session.end_time)}${session.venue ? ` ${"\u00b7"} ${session.venue}` : ""} ${"\u00b7"} ${session.status}`
    : undefined;

  const columns = [
    {
      key: "index",
      label: "#",
      render: (row: UnifiedRow) => (
        <Text size="sm" c="dimmed" style={{ width: 36 }}>
          {row.index}
        </Text>
      ),
    },
    {
      key: "identifier",
      label: "ID",
      render: (row: UnifiedRow) => (
        <Group gap={4} wrap="nowrap">
          <Text size="sm" fw={500}>
            {shortId(row.identifier)}
          </Text>
          {row.identifier.length > 18 && (
            <CopyButton value={row.identifier}>
              {({ copied, copy }) => (
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color={copied ? "green" : "gray"}
                  onClick={copy}
                >
                  <IconCopy size={14} />
                </ActionIcon>
              )}
            </CopyButton>
          )}
        </Group>
      ),
    },
    { key: "name", label: "Name" },
    {
      key: "department",
      label: "Department",
      render: (row: UnifiedRow) => (
        <Text size="sm" c="dimmed">
          {row.department}
        </Text>
      ),
    },
    {
      key: "attendeeType",
      label: "Type",
      render: (row: UnifiedRow) => (
        <span style={{ display: "inline-block", minWidth: 68 }}>
          <Badge
            size="sm"
            variant="light"
            color={row.attendeeType === "staff" ? "violet" : "blue"}
          >
            {row.attendeeType}
          </Badge>
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: UnifiedRow) => (
        <span style={{ display: "inline-block", minWidth: 72 }}>
          <Badge
            size="sm"
            variant="light"
            color={row.status === "present" ? "green" : "gray"}
          >
            {row.status === "present" ? "Present" : "Absent"}
          </Badge>
        </span>
      ),
    },
    {
      key: "verifiedAt",
      label: "Check-in Time",
      render: (row: UnifiedRow) => (
        <Text size="sm" style={{ whiteSpace: "nowrap" }}>
          {row.verifiedAt ? formatDateTime(row.verifiedAt) : MDASH}
        </Text>
      ),
    },
    {
      key: "verificationMethod",
      label: "Method",
      render: (row: UnifiedRow) =>
        row.verificationMethod ? (
          <VerificationBadge method={row.verificationMethod} />
        ) : (
          <Text size="sm" c="dimmed">
            {MDASH}
          </Text>
        ),
    },
    {
      key: "confidenceScore",
      label: "Confidence",
      render: (row: UnifiedRow) =>
        row.confidenceScore != null ? (
          <Text size="sm">{formatConfidence(row.confidenceScore)}</Text>
        ) : (
          <Text size="sm" c="dimmed">
            {MDASH}
          </Text>
        ),
    },
  ];

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader
        title="Attendance"
        subtitle={headerSubtitle}
        breadcrumbs={[
          { label: "Events", to: "/admin/events" },
          {
            label: "Sessions",
            to: session
              ? `/admin/events/${session.event_id}/sessions`
              : undefined,
          },
          { label: session?.name ?? "Attendance" },
        ]}
      />

      {summary && (
        <StatsRow
          stats={[
            {
              label: "Total Attendees",
              value: summary.total_attendees,
              color: "blue",
            },
            {
              label: "Present",
              value: summary.present_count,
              color: "green",
            },
            {
              label: "Absent",
              value: summary.absent_count,
              color: "red",
            },
            {
              label: "Check-in Rate",
              value: `${rate}%`,
              color: "violet",
            },
          ]}
          cols={4}
        />
      )}
      {/* Spacer between stats and filter toolbar */}
      <div style={{ height: "var(--mantine-spacing-lg)" }} />

      <Paper p="md" radius="md" bg="var(--surface-1)">
        <Group justify="space-between" mb="sm" wrap="wrap">
          <Group gap="sm" wrap="wrap">
            <SegmentedControl
              size="sm"
              data={[
                { label: `All (${statusCounts.all})`, value: "all" },
                {
                  label: `Present (${statusCounts.present})`,
                  value: "present",
                },
                {
                  label: `Absent (${statusCounts.absent})`,
                  value: "absent",
                },
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
            />
            <Select
              size="sm"
              placeholder="Filter by type"
              data={[
                { value: "", label: "All types" },
                { value: "student", label: "Student" },
                { value: "staff", label: "Staff" },
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
              w={150}
            />
            {departments.length > 1 && (
              <Select
                size="sm"
                placeholder="All Departments"
                data={departments}
                value={deptFilter}
                onChange={setDeptFilter}
                clearable
                w={180}
              />
            )}
          </Group>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="sm"
              leftSection={<IconDownload size={16} />}
              onClick={handleExportCSV}
            >
              CSV
            </Button>
            <Button
              variant="subtle"
              size="sm"
              leftSection={<IconPrinter size={16} />}
              onClick={() => handlePrint()}
            >
              Print
            </Button>
          </Group>
        </Group>

        <DataTable
          columns={columns}
          rows={displayedRows}
          loading={loading}
          emptyMessage="No attendees match the selected filters."
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search attendees by ID, name, or department..."
          page={1}
          pageSize={displayedRows.length}
          total={displayedRows.length}
        />
      </Paper>

      <div style={{ display: "none" }}>
        <div ref={printRef} className="print-area">
          <h1>Attendance Report</h1>
          {session && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 16 }}>
                <strong>Session:</strong> {session.name}
              </p>
              <p style={{ margin: 0, fontSize: 14 }}>
                {formatDate(session.start_time)}{" "}
                {formatTime(session.start_time)} {NDASH}{" "}
                {formatTime(session.end_time)}
                {session.venue ? ` \u00b7 ${session.venue}` : ""}
              </p>
              {summary && (
                <p style={{ margin: "4px 0 0", fontSize: 14 }}>
                  Present: {summary.present_count} / {summary.total_attendees} (
                  {rate}%) | Absent: {summary.absent_count}
                </p>
              )}
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Type</th>
                <th>Status</th>
                <th>Check-in Time</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.index}</td>
                  <td>{r.identifier}</td>
                  <td>{r.name}</td>
                  <td>{r.department}</td>
                  <td>{r.attendeeType}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.verifiedAt ? formatDateTime(r.verifiedAt) : "-"}
                  </td>
                  <td>{r.verificationMethod ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Container>
  );
}
