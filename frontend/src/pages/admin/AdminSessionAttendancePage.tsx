import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Text,
  Group,
  Button,
  Select,
  CopyButton,
  ActionIcon,
  Avatar,
  TextInput,
  Loader,
} from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import {
  IconPrinter,
  IconDownload,
  IconCopy,
  IconArrowLeft,
  IconShieldCheck,
  IconQrcode,
  IconUserCheck,
  IconSearch,
  IconCheck,
  IconClock,
  IconUsers,
} from "@tabler/icons-react";
import { useReactToPrint } from "react-to-print";
import * as sessionsApi from "../../api/sessions";
import * as attendanceApi from "../../api/attendance";
import * as attendeesApi from "../../api/attendees";
import { downloadSessionCsv, downloadSessionPdf } from "../../api/reports";
import type { SessionResponse } from "../../types/session";
import type { AttendanceLogResponse, AttendanceSummary } from "../../api/attendance";
import type { AttendeeResponse } from "../../api/attendees";
import { useAsync } from "../../hooks";
import { formatDateTime, formatConfidence, formatDate, formatTime } from "../../utils/formatters";
import "./AdminSessionAttendancePage.css";

type StatusFilter = "all" | "present" | "absent";
const MDASH = "\u2014";

function shortId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

interface UnifiedRow {
  id: string;
  index: number;
  identifier: string;
  name: string;
  department: string;
  departmentCode: string | null;
  attendeeType: string;
  status: "present" | "absent";
  verifiedAt: string | null;
  verificationMethod: string | null;
  confidenceScore: number | null;
}

export default function AdminSessionAttendancePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const stateEventId = (location.state as any)?.eventId;
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
      sessionsApi.getSession(sessionId).catch(() => null),
      attendanceApi.getSessionLogs(sessionId).catch(() => []),
      attendanceApi.getSessionSummary(sessionId).catch(() => null),
      attendeesApi.getAttendees().catch(() => []),
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
          departmentCode: a.department_code,
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

  // Verification method breakdown
  const methodCounts = useMemo(() => {
    let face = 0;
    let qr = 0;
    let marshal = 0;
    for (const log of logs) {
      if (log.verification_method === "face_recognition") face++;
      else if (log.verification_method === "qr_code") qr++;
      else if (log.verification_method === "marshal_override") marshal++;
    }
    return { face, qr, marshal };
  }, [logs]);

  const rate =
    summary && summary.total_attendees > 0
      ? Math.round((summary.present_count / summary.total_attendees) * 100)
      : attendees.length > 0
        ? Math.round((statusCounts.present / attendees.length) * 100)
        : 0;

  const donutData = useMemo(() => {
    const present = statusCounts.present;
    const absent = statusCounts.absent;
    if (present === 0 && absent === 0) {
      return [{ name: "Target", value: 1, color: "gray.4" }];
    }
    return [
      { name: "Present", value: Math.max(0, present), color: "teal.6" },
      { name: "Absent", value: Math.max(0, absent), color: "gray.4" },
    ];
  }, [statusCounts]);

  const isActive = session?.status === "active";

  return (
    <div className="attendance-page-container">
      {/* ─── 1. Executive Split Header Card (Student Dashboard Parity) ─── */}
      <div className="session-attendance-header-card">
        {/* Left Column: Navigation, Eyebrow, Session Heading, Meta Tags, and Actions */}
        <div className="attendance-identity-col">
          <div>
            <button
              type="button"
              className="attendance-back-btn"
              onClick={() => {
                const targetEventId = session?.event_id || stateEventId;
                if (targetEventId) {
                  navigate(`/admin/events/${targetEventId}/sessions`);
                } else if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/admin/events");
                }
              }}
            >
              <IconArrowLeft size={14} />
              <span>Back to Sessions</span>
            </button>

            <div className="attendance-title-group" style={{ marginTop: "12px" }}>
              <span className="attendance-eyebrow">Attendance Ledger • Session Telemetry</span>
              <h1 className="attendance-title" title={session?.name || "Session Attendance"}>
                {session?.name || "Session Attendance"}
              </h1>
              <div className="attendance-institution-name">
                {session && (
                  <>
                    <span>
                      {formatDate(session.start_time)} • {formatTime(session.start_time)} – {formatTime(session.end_time)}
                    </span>
                    {session.venue && <span>• {session.venue}</span>}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="attendance-credential-stack">
            {session && (
              <span className="attendance-tag">
                SESSION: {shortId(session.id).toUpperCase()}
              </span>
            )}
            <span className={`attendance-status-pill ${isActive ? "active" : "completed"}`}>
              {isActive ? <IconCheck size={12} /> : null}
              <span>{isActive ? "Active Check-In Session" : session?.status?.toUpperCase() || "CONCLUDED"}</span>
            </span>
            <span className="attendance-tag">
              ROSTER: {attendees.length} ENROLLED
            </span>
          </div>

          <div className="attendance-cta-row">
            <Button
              className="attendance-btn-primary"
              leftSection={<IconDownload size={16} />}
              onClick={() => sessionId && downloadSessionPdf(sessionId)}
              disabled={!sessionId}
            >
              Official PDF Roster
            </Button>
            <Button
              className="attendance-btn-secondary"
              leftSection={<IconDownload size={16} />}
              onClick={() => sessionId && downloadSessionCsv(sessionId)}
              disabled={!sessionId}
            >
              Export CSV
            </Button>
            <Button
              className="attendance-btn-secondary"
              leftSection={<IconPrinter size={16} />}
              onClick={() => handlePrint()}
            >
              Print Roster
            </Button>
          </div>
        </div>

        {/* Right Column: 3 Visual Telemetry Cards */}
        <div className="attendance-visual-frame">
          {/* Slide 1: Turnout Rate Donut */}
          <div className="attendance-visual-slide">
            <span className="attendance-slide-category">Turnout standing</span>
            <div className="attendance-donut-slot">
              <DonutChart
                data={donutData}
                size={58}
                thickness={7}
                withTooltip={false}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="attendance-slide-big-metric" style={{ margin: 0, fontSize: "1.45rem" }}>
                {rate}%
              </span>
              <span className="attendance-slide-subtext" style={{ fontFamily: "var(--font-mono, monospace)" }}>
                {statusCounts.present} / {attendees.length} checked in
              </span>
            </div>
          </div>

          {/* Slide 2: Verification Methods Breakdown */}
          <div className="attendance-visual-slide">
            <span className="attendance-slide-category">Verification Fleet</span>
            <div className="attendance-method-pills">
              <div className="attendance-method-row">
                <span>
                  <span className="attendance-method-dot" style={{ background: "#10b981" }} />
                  Face ID
                </span>
                <span style={{ fontWeight: 700 }}>{methodCounts.face}</span>
              </div>
              <div className="attendance-method-row">
                <span>
                  <span className="attendance-method-dot" style={{ background: "#38bdf8" }} />
                  QR Pass
                </span>
                <span style={{ fontWeight: 700 }}>{methodCounts.qr}</span>
              </div>
              <div className="attendance-method-row">
                <span>
                  <span className="attendance-method-dot" style={{ background: "#f59e0b" }} />
                  Marshal
                </span>
                <span style={{ fontWeight: 700 }}>{methodCounts.marshal}</span>
              </div>
            </div>
            <span className="attendance-slide-subtext">
              {logs.length} total verification events
            </span>
          </div>

          {/* Slide 3: Session Schedule Window */}
          <div className="attendance-visual-slide">
            <span className="attendance-slide-category">Session Window</span>
            <div className="attendance-slide-big-metric" style={{ fontSize: "1.15rem", fontWeight: 700, paddingTop: 4 }}>
              {session ? formatTime(session.start_time) : "—"}
            </div>
            <span className="attendance-slide-subtext">
              {session ? `Concludes: ${formatTime(session.end_time)}` : "Standby"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. Filter Toolbar & Search ─── */}
      <div className="attendance-toolbar">
        <div className="attendance-filter-chips">
          <button
            type="button"
            className={`attendance-chip-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <span>All</span>
            <span className="attendance-chip-count">{statusCounts.all}</span>
          </button>
          <button
            type="button"
            className={`attendance-chip-btn ${statusFilter === "present" ? "active" : ""}`}
            onClick={() => setStatusFilter("present")}
          >
            <span>Present</span>
            <span className="attendance-chip-count">{statusCounts.present}</span>
          </button>
          <button
            type="button"
            className={`attendance-chip-btn ${statusFilter === "absent" ? "active" : ""}`}
            onClick={() => setStatusFilter("absent")}
          >
            <span>Absent</span>
            <span className="attendance-chip-count">{statusCounts.absent}</span>
          </button>
        </div>

        <Group gap="xs" wrap="wrap" style={{ flexGrow: 1, justifyContent: "flex-end" }}>
          <Select
            size="sm"
            placeholder="All Types"
            data={[
              { value: "", label: "All types" },
              { value: "student", label: "Students" },
              { value: "faculty", label: "Faculty" },
              { value: "staff", label: "Staff" },
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            w={130}
            radius="md"
          />

          {departments.length > 1 && (
            <Select
              size="sm"
              placeholder="All Departments"
              data={departments}
              value={deptFilter}
              onChange={setDeptFilter}
              clearable
              w={170}
              radius="md"
            />
          )}

          <div className="attendance-search-wrap">
            <TextInput
              size="sm"
              placeholder="Search by ID, name, or unit..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              leftSection={<IconSearch size={14} style={{ color: "var(--text-muted)" }} />}
              radius="md"
            />
          </div>
        </Group>
      </div>

      {/* ─── 3. Attendance Ledger Table Card ─── */}
      <div className="attendance-ledger-card">
        <div className="card-header-row">
          <span className="card-heading">
            {statusFilter === "all"
              ? "Comprehensive Attendance Ledger"
              : statusFilter === "present"
                ? "Present Attendees Ledger"
                : "Absent Attendees Ledger"}
          </span>
          <span className="card-meta-count">
            {displayedRows.length} Attendees
          </span>
        </div>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader size="md" />
          </Group>
        ) : displayedRows.length === 0 ? (
          <div className="attendance-empty-state">
            <div className="empty-state-icon">
              <IconUsers size={22} />
            </div>
            <Text fz="0.875rem" fw={600} c="var(--text-primary)">
              No attendees match the selected filters
            </Text>
            <Text fz="0.75rem" c="var(--text-secondary)">
              Try adjusting your search criteria, status filter, or department selection.
            </Text>
          </div>
        ) : (
          <div className="attendance-table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Attendee Name</th>
                  <th>Identifier</th>
                  <th>Unit / Department</th>
                  <th>Role</th>
                  <th>Attendance Status</th>
                  <th>Check-In Time</th>
                  <th>Verification Method</th>
                  <th style={{ textAlign: "right" }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((r) => {
                  const isPresent = r.status === "present";

                  return (
                    <tr key={r.id}>
                      <td>
                        <Text size="xs" c="var(--text-muted)" ff="var(--font-mono, monospace)">
                          {r.index}
                        </Text>
                      </td>
                      <td>
                        <div className="attendance-identity-group">
                          <Avatar radius="xl" size="sm" color="blue">
                            {r.name.split(",")[0]?.[0] || "A"}
                          </Avatar>
                          <div>
                            <div className="attendee-name">{r.name}</div>
                            <div className="attendee-subtext">{r.attendeeType.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Group gap={4} wrap="nowrap">
                          <span className="attendance-id-tag">
                            {shortId(r.identifier)}
                          </span>
                          {r.identifier.length > 18 && (
                            <CopyButton value={r.identifier}>
                              {({ copied, copy }) => (
                                <ActionIcon
                                  variant="subtle"
                                  size="xs"
                                  color={copied ? "green" : "gray"}
                                  onClick={copy}
                                >
                                  <IconCopy size={12} />
                                </ActionIcon>
                              )}
                            </CopyButton>
                          )}
                        </Group>
                      </td>
                      <td>
                        {r.departmentCode ? (
                          <span className="attendance-id-tag" style={{ color: "var(--text-primary)" }}>
                            {r.departmentCode}
                          </span>
                        ) : (
                          <Text size="xs" c="var(--text-secondary)">
                            {r.department}
                          </Text>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.6875rem", textTransform: "capitalize", color: "var(--text-secondary)" }}>
                          {r.attendeeType}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge-pill ${isPresent ? "present" : "absent"}`}>
                          {isPresent ? <IconCheck size={12} /> : null}
                          <span>{isPresent ? "Present" : "Absent"}</span>
                        </span>
                      </td>
                      <td>
                        {r.verifiedAt ? (
                          <Group gap={4} wrap="nowrap" align="center">
                            <IconClock size={12} style={{ color: "var(--text-muted)" }} />
                            <Text size="xs" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono, monospace)" }}>
                              {formatDateTime(r.verifiedAt)}
                            </Text>
                          </Group>
                        ) : (
                          <Text size="xs" c="var(--text-muted)">{MDASH}</Text>
                        )}
                      </td>
                      <td>
                        {r.verificationMethod === "face_recognition" ? (
                          <span className="verification-method-pill face">
                            <IconShieldCheck size={12} />
                            <span>Face ID</span>
                          </span>
                        ) : r.verificationMethod === "qr_code" ? (
                          <span className="verification-method-pill qr">
                            <IconQrcode size={12} />
                            <span>QR Pass</span>
                          </span>
                        ) : r.verificationMethod === "marshal_override" ? (
                          <span className="verification-method-pill marshal">
                            <IconUserCheck size={12} />
                            <span>Marshal</span>
                          </span>
                        ) : (
                          <Text size="xs" c="var(--text-muted)">{MDASH}</Text>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {r.confidenceScore != null ? (
                          <span className="attendance-id-tag" style={{ color: "#10b981", borderColor: "rgba(16, 185, 129, 0.25)" }}>
                            {formatConfidence(r.confidenceScore)}
                          </span>
                        ) : (
                          <Text size="xs" c="var(--text-muted)">{MDASH}</Text>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 4. Hidden Printable Report Sheet ─── */}
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
                {formatTime(session.start_time)} –{" "}
                {formatTime(session.end_time)}
                {session.venue ? ` • ${session.venue}` : ""}
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
    </div>
  );
}
