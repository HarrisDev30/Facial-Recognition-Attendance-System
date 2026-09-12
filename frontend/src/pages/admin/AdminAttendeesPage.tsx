import { useMemo, useState, useEffect } from "react";
import {
  Container,
  Group,
  Button,
  ActionIcon,
  Text,
  Tooltip,
  Select,
  TextInput,
  CloseButton,
  Avatar,
  CopyButton,
  Pagination,
  Skeleton,
} from "@mantine/core";
import { Sparkline } from "@mantine/charts";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconShield,
  IconShieldCheck,
  IconShieldX,
  IconSearch,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import * as attendeesApi from "../../api/attendees";
import type { AttendeeResponse, AttendeeCreate } from "../../api/attendees";
import { useAsync, useFormSubmit } from "../../hooks";
import ConfirmDialog from "../../components/shared/ConfirmDialog";
import AttendeeFormModal from "../../components/forms/AttendeeFormModal";
import MarshalCreateModal from "../../components/forms/MarshalCreateModal";
import "./AdminAttendeesPage.css";

type TypeFilter = "all" | "student" | "staff";

const PAGE_SIZE = 15;

function shortId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function getInitials(first: string, last: string): string {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "ID";
}

export default function AdminAttendeesPage() {
  const { user } = useAuthStore();
  const [editingAttendee, setEditingAttendee] = useState<AttendeeResponse | null>(null);
  const [opened, setOpened] = useState(false);
  const [marshalOpened, setMarshalOpened] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: attendeesData, loading, execute: reload } = useAsync(
    () => attendeesApi.getAttendees(),
    true,
  );

  const attendees = useMemo(() => attendeesData ?? [], [attendeesData]);

  // Distinct department options for filter dropdown
  const departments = useMemo(() => {
    const deptMap = new Map<string, string>();
    for (const a of attendees) {
      if (a.department_code && a.department_id) {
        deptMap.set(a.department_id, a.department_code);
      }
    }
    return Array.from(deptMap.entries()).map(([id, code]) => ({
      value: id,
      label: code,
    }));
  }, [attendees]);

  // Counts by attendee type
  const typeCounts = useMemo(() => {
    const student = attendees.filter((a) => a.attendee_type === "student").length;
    const staff = attendees.filter((a) => a.attendee_type === "staff").length;
    return { student, staff };
  }, [attendees]);

  // Biometric enrollment metrics
  const biometricCount = useMemo(
    () => attendees.filter((a) => a.consent_given).length,
    [attendees],
  );

  const biometricPercent = useMemo(
    () => (attendees.length > 0 ? Math.round((biometricCount / attendees.length) * 100) : 0),
    [attendees.length, biometricCount],
  );

  const studentSharePercent = useMemo(
    () => (attendees.length > 0 ? Math.round((typeCounts.student / attendees.length) * 100) : 0),
    [attendees.length, typeCounts.student],
  );

  // Filtered dataset
  const filteredAttendees = useMemo(() => {
    let rows = attendees;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.identifier.toLowerCase().includes(q) ||
          a.first_name.toLowerCase().includes(q) ||
          a.last_name.toLowerCase().includes(q) ||
          (a.email ?? "").toLowerCase().includes(q) ||
          (a.department_name ?? "").toLowerCase().includes(q) ||
          (a.department_code ?? "").toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") {
      rows = rows.filter((a) => a.attendee_type === typeFilter);
    }
    if (deptFilter) {
      rows = rows.filter((a) => a.department_id === deptFilter);
    }
    return rows;
  }, [attendees, search, typeFilter, deptFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, deptFilter]);

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(filteredAttendees.length / PAGE_SIZE));
  const paginatedAttendees = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAttendees.slice(start, start + PAGE_SIZE);
  }, [filteredAttendees, page]);

  // Form submit hooks
  const { submit: createSubmit, submitting: creating } = useFormSubmit(
    (data: AttendeeCreate) => attendeesApi.createAttendee(data),
    {
      onSuccess: () => {
        setOpened(false);
        reload();
      },
      successMessage: "Attendee registered.",
    },
  );

  const { submit: updateSubmit, submitting: updating } = useFormSubmit(
    (data: AttendeeCreate) => {
      if (!editingAttendee) return Promise.reject(new Error("No attendee to edit"));
      return attendeesApi.updateAttendee(editingAttendee.id, data);
    },
    {
      onSuccess: () => {
        setEditingAttendee(null);
        setOpened(false);
        reload();
      },
      successMessage: "Attendee profile updated.",
    },
  );

  const { submit: deleteSubmit, submitting: deleting } = useFormSubmit(
    (id: string) => attendeesApi.deleteAttendee(id),
    {
      onSuccess: () => {
        setDeleteId(null);
        reload();
      },
      successMessage: "The attendee has been removed.",
      errorMessage: "Failed to delete attendee.",
    },
  );

  const submitting = creating || updating || deleting;

  const openEdit = (attendee: AttendeeResponse) => {
    setEditingAttendee(attendee);
    setOpened(true);
  };

  const openCreate = () => {
    setEditingAttendee(null);
    setOpened(true);
  };

  // Sparklines for visual telemetry slides
  const rosterSparkline =
    attendees.length > 0
      ? [
          Math.max(1, Math.round(attendees.length * 0.85)),
          Math.max(1, Math.round(attendees.length * 0.92)),
          attendees.length,
        ]
      : [0, 0, 0];

  const biometricSparkline =
    biometricPercent > 0
      ? [Math.max(0, biometricPercent - 6), Math.max(0, biometricPercent - 2), biometricPercent]
      : [0, 0, 0];

  return (
    <Container size="xl" pt={0} pb="4xl" className="attendees-container">
      {/* ─── 1. Executive Split Header Card (Student Dashboard Parity) ─── */}
      <div className="admin-attendees-header-card">
        {/* Left Column: Identity, Status, and Direct Actions */}
        <div className="attendees-identity-col">
          <div className="attendees-title-group">
            <span className="attendees-eyebrow">Campus Identity Registry</span>
            <h1 className="attendees-title">Attendees Directory</h1>
            <span className="attendees-institution-name">
              {user?.institution_name || "Institutional Campus Portal"} • Central Biometric & Attendance Roster
            </span>
          </div>

          <div className="attendees-credential-stack">
            <span className="attendees-tag">
              ENROLLED: {attendees.length}
            </span>
            <span className="attendees-status-pill">
              <IconCheck size={12} />
              <span>Active Directory</span>
            </span>
            {departments.length > 0 && (
              <span className="attendees-tag">
                {departments.length} Units
              </span>
            )}
          </div>

          <div className="attendees-cta-row">
            <Button
              size="xs"
              leftSection={<IconPlus size={15} />}
              onClick={openCreate}
              className="attendees-btn-primary"
            >
              Add Attendee
            </Button>
            <Button
              size="xs"
              leftSection={<IconShield size={15} />}
              onClick={() => setMarshalOpened(true)}
              className="attendees-btn-secondary"
            >
              Designate Marshal
            </Button>
            <Tooltip label="Refresh roster directory">
              <ActionIcon
                variant="default"
                size="input-xs"
                loading={loading}
                onClick={reload}
                className="attendees-btn-secondary"
                aria-label="Refresh roster"
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {/* Right Column: 3 Visual Telemetry Slides */}
        <div className="attendees-visual-frame">
          {/* Slide 1: Total Enrolled Roster */}
          <div className="attendees-visual-slide">
            <span className="attendees-slide-category">Total Roster</span>
            <div style={{ flex: 1, minHeight: 38, display: "flex", alignItems: "center" }}>
              <Sparkline
                w="100%"
                h={36}
                data={rosterSparkline}
                color="blue.6"
                fillOpacity={0.16}
                curveType="natural"
              />
            </div>
            <div className="attendees-slide-big-metric">
              {loading ? <Skeleton height={26} width={48} /> : attendees.length}
            </div>
            <span className="attendees-slide-subtext">Active identity records</span>
          </div>

          {/* Slide 2: Student Registry Share */}
          <div className="attendees-visual-slide">
            <span className="attendees-slide-category">Student Share</span>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
              <span className="attendees-slide-big-metric" style={{ margin: 0 }}>
                {loading ? <Skeleton height={26} width={48} /> : `${studentSharePercent}%`}
              </span>
            </div>
            <div className="attendees-slide-big-metric" style={{ display: "none" }} />
            <span className="attendees-slide-subtext">
              {typeCounts.student} students • {typeCounts.staff} faculty & personnel
            </span>
          </div>

          {/* Slide 3: Biometric Coverage */}
          <div className="attendees-visual-slide">
            <span className="attendees-slide-category">Face ID Enrolled</span>
            <div style={{ flex: 1, minHeight: 38, display: "flex", alignItems: "center" }}>
              <Sparkline
                w="100%"
                h={36}
                data={biometricSparkline}
                color="teal.6"
                fillOpacity={0.18}
                curveType="natural"
              />
            </div>
            <div className="attendees-slide-big-metric">
              {loading ? <Skeleton height={26} width={48} /> : `${biometricPercent}%`}
            </div>
            <span className="attendees-slide-subtext">{biometricCount} face verified</span>
          </div>
        </div>
      </div>

      {/* ─── 2. Filter Tabs & Search Toolbar ─── */}
      <div className="attendees-toolbar">
        <div className="attendees-tab-group">
          <button
            type="button"
            className={`attendees-tab-pill ${typeFilter === "all" ? "active" : ""}`}
            onClick={() => setTypeFilter("all")}
          >
            <span>All</span>
            <span className="attendees-tab-count">{attendees.length}</span>
          </button>
          <button
            type="button"
            className={`attendees-tab-pill ${typeFilter === "student" ? "active" : ""}`}
            onClick={() => setTypeFilter("student")}
          >
            <span>Students</span>
            <span className="attendees-tab-count">{typeCounts.student}</span>
          </button>
          <button
            type="button"
            className={`attendees-tab-pill ${typeFilter === "staff" ? "active" : ""}`}
            onClick={() => setTypeFilter("staff")}
          >
            <span>Faculty & Personnel</span>
            <span className="attendees-tab-count">{typeCounts.staff}</span>
          </button>
        </div>

        <Group gap="xs" style={{ flexWrap: "wrap" }}>
          {departments.length > 0 && (
            <Select
              size="xs"
              placeholder="All Departments"
              data={departments}
              value={deptFilter}
              onChange={setDeptFilter}
              clearable
              w={170}
              styles={{
                input: {
                  background: "var(--surface-0)",
                  borderColor: "var(--border-subtle)",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                },
              }}
            />
          )}

          <div className="attendees-search-wrap">
            <TextInput
              size="xs"
              placeholder="Search by ID, name, or department..."
              leftSection={<IconSearch size={14} style={{ color: "var(--text-muted)" }} />}
              rightSection={
                search ? (
                  <CloseButton size="xs" onClick={() => setSearch("")} aria-label="Clear search" />
                ) : null
              }
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              styles={{
                input: {
                  background: "var(--surface-0)",
                  borderColor: "var(--border-subtle)",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                },
              }}
            />
          </div>
        </Group>
      </div>

      {/* ─── 3. Attendee Ledger Table Card ─── */}
      <div className="attendees-ledger-card">
        <div className="card-header-row">
          <span className="card-heading">Roster Registry</span>
          <span className="card-meta-count">
            Showing {filteredAttendees.length} of {attendees.length} records
          </span>
        </div>

        <div className="attendees-table-wrap">
          <table className="attendees-table">
            <thead>
              <tr>
                <th>Attendee</th>
                <th>Institutional ID</th>
                <th>Department</th>
                <th>Classification</th>
                <th>Biometric Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAttendees.map((row) => (
                <tr key={row.id}>
                  {/* Attendee Identity with Initials Avatar */}
                  <td>
                    <div className="attendee-identity-group">
                      <Avatar
                        size="sm"
                        radius="xl"
                        src={row.profile_photo_url || (row.consent_given ? `/api/attendees/${row.id}/profile-photo` : null)}
                        color={row.attendee_type === "student" ? "blue" : "violet"}
                        variant="light"
                        styles={{
                          placeholder: {
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                          },
                        }}
                      >
                        {getInitials(row.first_name, row.last_name)}
                      </Avatar>
                      <div style={{ minWidth: 0 }}>
                        <div className="attendee-name">
                          {row.last_name}, {row.first_name}
                        </div>
                        <div className="attendee-subtext">
                          {row.email || row.department_name || "General Roster"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Institutional Identifier with Tabular Monospace & Copy */}
                  <td>
                    <Group gap={4} wrap="nowrap" align="center">
                      <span className="attendee-id-tag">{shortId(row.identifier)}</span>
                      <CopyButton value={row.identifier}>
                        {({ copied, copy }) => (
                          <Tooltip label={copied ? "Copied!" : "Copy full ID"}>
                            <ActionIcon
                              variant="subtle"
                              size="xs"
                              color={copied ? "teal" : "gray"}
                              onClick={copy}
                              aria-label="Copy identifier"
                            >
                              {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </Group>
                  </td>

                  {/* Department */}
                  <td>
                    {row.department_code ? (
                      <Tooltip label={row.department_name ?? row.department_code}>
                        <span className="attendees-tag">{row.department_code}</span>
                      </Tooltip>
                    ) : (
                      <Text size="xs" c="dimmed">
                        —
                      </Text>
                    )}
                  </td>

                  {/* Classification Type */}
                  <td>
                    <span
                      className={`attendee-type-badge ${
                        row.attendee_type === "student" ? "student" : "staff"
                      }`}
                    >
                      {row.attendee_type === "student" ? "Student" : "Faculty & Personnel"}
                    </span>
                  </td>

                  {/* Biometric Status */}
                  <td>
                    {row.consent_given ? (
                      <span className="biometric-status-pill enrolled">
                        <IconShieldCheck size={12} />
                        <span>Face ID Enrolled</span>
                      </span>
                    ) : (
                      <span className="biometric-status-pill pending">
                        <IconShieldX size={12} />
                        <span>Photo Pending</span>
                      </span>
                    )}
                  </td>

                  {/* Tactile Actions */}
                  <td style={{ textAlign: "right" }}>
                    <Group gap={6} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Edit profile">
                        <button
                          type="button"
                          className="tactile-action-btn"
                          onClick={() => openEdit(row)}
                          aria-label={`Edit ${row.first_name} ${row.last_name}`}
                        >
                          <IconPencil size={13} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete attendee">
                        <button
                          type="button"
                          className="tactile-action-btn delete"
                          onClick={() => setDeleteId(row.id)}
                          aria-label={`Delete ${row.first_name} ${row.last_name}`}
                        >
                          <IconTrash size={13} />
                        </button>
                      </Tooltip>
                    </Group>
                  </td>
                </tr>
              ))}

              {filteredAttendees.length === 0 && !loading && (
                <tr>
                  <td colSpan={6}>
                    <div className="attendees-empty-state">
                      <div className="empty-state-icon">
                        <IconUsers size={22} />
                      </div>
                      <Text fw={600} size="sm" c="var(--text-primary)">
                        No attendees found
                      </Text>
                      <Text size="xs" c="var(--text-muted)" maw={340}>
                        {search || typeFilter !== "all" || deptFilter
                          ? "No attendees match your active search or filter criteria. Try clearing filters or modifying your query."
                          : "Your identity directory is currently empty. Click 'Add Attendee' above to enroll your first student or faculty member."}
                      </Text>
                      {(search || typeFilter !== "all" || deptFilter) && (
                        <Button
                          size="xs"
                          variant="subtle"
                          mt="xs"
                          onClick={() => {
                            setSearch("");
                            setTypeFilter("all");
                            setDeptFilter(null);
                          }}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 4. Pagination & Summary Row ─── */}
        {filteredAttendees.length > 0 && (
          <div className="attendees-pagination-row">
            <span className="attendees-count-summary">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filteredAttendees.length)} of {filteredAttendees.length}{" "}
              attendees
            </span>
            {totalPages > 1 && (
              <Pagination
                value={page}
                onChange={setPage}
                total={totalPages}
                size="sm"
                radius="md"
              />
            )}
          </div>
        )}
      </div>

      {/* ─── 5. Modals & Dialogs ─── */}
      <AttendeeFormModal
        opened={opened}
        onClose={() => {
          setEditingAttendee(null);
          setOpened(false);
        }}
        onSubmit={editingAttendee ? updateSubmit : createSubmit}
        initial={editingAttendee}
        loading={submitting}
      />

      <MarshalCreateModal
        opened={marshalOpened}
        onClose={() => setMarshalOpened(false)}
      />

      <ConfirmDialog
        opened={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteSubmit(deleteId)}
        title="Delete Attendee"
        message="Are you sure you want to remove this attendee from the directory? This will remove all associated biometric credentials and cannot be undone."
        confirmLabel="Delete Attendee"
        loading={deleting}
      />
    </Container>
  );
}
