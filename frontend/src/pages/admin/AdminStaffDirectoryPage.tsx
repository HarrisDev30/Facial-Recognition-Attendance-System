import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Text,
  Group,
  TextInput,
  Select,
  Avatar,
  Button,
  ActionIcon,
  Tooltip,
  CloseButton,
  CopyButton,
  Pagination,
  Skeleton,
} from "@mantine/core";
import {
  IconSearch,
  IconShield,
  IconUserCheck,
  IconSchool,
  IconId,
  IconPlus,
  IconRefresh,
  IconCheck,
  IconCopy,
  IconArrowUpRight,
  IconUsers,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import client from "../../api/client";
import MarshalCreateModal from "../../components/forms/MarshalCreateModal";
import "./AdminStaffDirectoryPage.css";

interface StaffMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  org_role: string;
  display_role: string;
  is_student_marshal: boolean;
  student_identifier: string | null;
  organization_id: string;
  organization_name: string;
  organization_code: string;
  org_type: string;
}

type RoleFilterType = "all" | "admin" | "student_marshal" | "marshal";

const PAGE_SIZE = 15;

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "OP";
}

export default function AdminStaffDirectoryPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<RoleFilterType>("all");
  const [filterOrg, setFilterOrg] = useState<string | null>("all");
  const [marshalOpened, setMarshalOpened] = useState(false);
  const [page, setPage] = useState(1);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await client.get<StaffMember[]>("/api/organizations/staff/all");
      setStaffList(res.data);
    } catch {
      // Keep empty list on fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  // Unique organizations list for filter dropdown
  const orgOptions = useMemo(() => {
    const orgs = Array.from(new Set(staffList.map((s) => s.organization_name)));
    return [
      { value: "all", label: "All Units & Clubs" },
      ...orgs.map((o) => ({ value: o, label: o })),
    ];
  }, [staffList]);

  // Counts by operational role
  const studentMarshalCount = useMemo(
    () => staffList.filter((s) => s.is_student_marshal).length,
    [staffList],
  );
  const deptAdminCount = useMemo(
    () => staffList.filter((s) => s.org_role === "admin").length,
    [staffList],
  );
  const fieldMarshalCount = useMemo(
    () => staffList.filter((s) => s.org_role === "marshal" && !s.is_student_marshal).length,
    [staffList],
  );

  // Distinct units count
  const uniqueOrgsCount = useMemo(
    () => new Set(staffList.map((s) => s.organization_id)).size,
    [staffList],
  );

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.student_identifier && s.student_identifier.toLowerCase().includes(search.toLowerCase())) ||
        s.organization_name.toLowerCase().includes(search.toLowerCase()) ||
        s.organization_code.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        filterRole === "all" ||
        (filterRole === "student_marshal" && s.is_student_marshal) ||
        (filterRole === "marshal" && !s.is_student_marshal && s.org_role === "marshal") ||
        (filterRole === "admin" && s.org_role === "admin");

      const matchesOrg = !filterOrg || filterOrg === "all" || s.organization_name === filterOrg;

      return matchesSearch && matchesRole && matchesOrg;
    });
  }, [staffList, search, filterRole, filterOrg]);

  // Reset pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [search, filterRole, filterOrg]);

  // Paginated dataset
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const paginatedStaff = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStaff.slice(start, start + PAGE_SIZE);
  }, [filteredStaff, page]);

  return (
    <Container size="xl" pt={0} pb="4xl" className="staff-container">
      {/* ─── 1. Executive Split Header Card (Student Dashboard Parity) ─── */}
      <div className="admin-staff-header-card">
        {/* Left Column: Identity & Direct Actions */}
        <div className="staff-identity-col">
          <div className="staff-title-group">
            <span className="staff-eyebrow">System Operations & Gate Fleet</span>
            <h1 className="staff-title">Operators & Marshals</h1>
            <span className="staff-institution-name">
              {user?.institution_name || "Institutional Campus Portal"} • Authorized Access Roster
            </span>
          </div>

          <div className="staff-credential-stack">
            <span className="staff-tag">
              OPERATORS: {staffList.length}
            </span>
            <span className="staff-status-pill">
              <IconCheck size={12} />
              <span>Active Directory</span>
            </span>
            {uniqueOrgsCount > 0 && (
              <span className="staff-tag">
                {uniqueOrgsCount} Units
              </span>
            )}
          </div>

          <div className="staff-cta-row">
            <Button
              size="xs"
              leftSection={<IconPlus size={15} />}
              onClick={() => setMarshalOpened(true)}
              className="staff-btn-primary"
            >
              Designate Marshal
            </Button>
            <Button
              size="xs"
              leftSection={<IconShield size={15} />}
              onClick={() => navigate("/admin/organizations")}
              className="staff-btn-secondary"
            >
              Assign Unit Admin
            </Button>
            <Tooltip label="Refresh operators directory">
              <ActionIcon
                variant="default"
                size="input-xs"
                loading={loading}
                onClick={loadStaff}
                className="staff-btn-secondary"
                aria-label="Refresh operators"
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {/* Right Column: 3 Visual Telemetry Slides */}
        <div className="staff-visual-frame">
          {/* Slide 1: Department Admins */}
          <div className="staff-visual-slide">
            <span className="staff-slide-category">Unit Administrators</span>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <span className="staff-slide-big-metric" style={{ margin: 0 }}>
                {loading ? <Skeleton height={26} width={48} /> : deptAdminCount}
              </span>
            </div>
            <span className="staff-slide-subtext">College chairs & department admins</span>
          </div>

          {/* Slide 2: Student Marshals */}
          <div className="staff-visual-slide">
            <span className="staff-slide-category">Student Marshals</span>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <span className="staff-slide-big-metric" style={{ margin: 0 }}>
                {loading ? <Skeleton height={26} width={48} /> : studentMarshalCount}
              </span>
            </div>
            <span className="staff-slide-subtext">Appointed student kiosk operators</span>
          </div>

          {/* Slide 3: Field Staff Marshals */}
          <div className="staff-visual-slide">
            <span className="staff-slide-category">Field Marshals</span>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <span className="staff-slide-big-metric" style={{ margin: 0 }}>
                {loading ? <Skeleton height={26} width={48} /> : fieldMarshalCount}
              </span>
            </div>
            <span className="staff-slide-subtext">Dedicated gate scanner personnel</span>
          </div>
        </div>
      </div>

      {/* ─── 2. Filter Tabs & Search Toolbar ─── */}
      <div className="staff-toolbar">
        <div className="staff-tab-group">
          <button
            type="button"
            className={`staff-tab-pill ${filterRole === "all" ? "active" : ""}`}
            onClick={() => setFilterRole("all")}
          >
            <span>All</span>
            <span className="staff-tab-count">{staffList.length}</span>
          </button>
          <button
            type="button"
            className={`staff-tab-pill ${filterRole === "admin" ? "active" : ""}`}
            onClick={() => setFilterRole("admin")}
          >
            <IconShield size={14} />
            <span>Unit Admins</span>
            <span className="staff-tab-count">{deptAdminCount}</span>
          </button>
          <button
            type="button"
            className={`staff-tab-pill ${filterRole === "student_marshal" ? "active" : ""}`}
            onClick={() => setFilterRole("student_marshal")}
          >
            <IconSchool size={14} />
            <span>Student Marshals</span>
            <span className="staff-tab-count">{studentMarshalCount}</span>
          </button>
          <button
            type="button"
            className={`staff-tab-pill ${filterRole === "marshal" ? "active" : ""}`}
            onClick={() => setFilterRole("marshal")}
          >
            <IconUserCheck size={14} />
            <span>Field Marshals</span>
            <span className="staff-tab-count">{fieldMarshalCount}</span>
          </button>
        </div>

        <Group gap="xs" style={{ flexWrap: "wrap" }}>
          {orgOptions.length > 2 && (
            <Select
              size="xs"
              placeholder="All Units & Clubs"
              data={orgOptions}
              value={filterOrg}
              onChange={setFilterOrg}
              w={180}
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

          <div className="staff-search-wrap">
            <TextInput
              size="xs"
              placeholder="Search by name, email, student ID, or unit..."
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

      {/* ─── 3. Staff Ledger Table Card ─── */}
      <div className="staff-ledger-card">
        <div className="staff-card-header-row">
          <span className="staff-card-heading">Authorized Operators Ledger</span>
          <span className="staff-card-meta-count">
            Showing {filteredStaff.length} of {staffList.length} accounts
          </span>
        </div>

        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Operator & Identity</th>
                <th>Assigned Unit / Club</th>
                <th>System Role</th>
                <th>Credentials</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5}>
                      <Skeleton height={20} radius="sm" my={6} />
                    </td>
                  </tr>
                ))
              ) : paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="staff-empty-state">
                      <div className="staff-empty-icon">
                        <IconUsers size={22} />
                      </div>
                      <Text fw={600} size="sm" c="var(--text-primary)">
                        No operators found
                      </Text>
                      <Text size="xs" c="var(--text-muted)" maw={340}>
                        {search || filterRole !== "all" || (filterOrg && filterOrg !== "all")
                          ? "No operators or marshals match your active filter criteria. Try clearing filters or modifying your query."
                          : "No authorized operators have been designated yet. Click 'Designate Marshal' to appoint gate personnel."}
                      </Text>
                      {(search || filterRole !== "all" || (filterOrg && filterOrg !== "all")) && (
                        <Button
                          size="xs"
                          variant="subtle"
                          mt="xs"
                          onClick={() => {
                            setSearch("");
                            setFilterRole("all");
                            setFilterOrg("all");
                          }}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((staff) => {
                  const roleClass = staff.is_student_marshal
                    ? "student-marshal"
                    : staff.org_role === "admin"
                    ? "admin"
                    : "marshal";

                  return (
                    <tr key={staff.id}>
                      {/* Operator Identity */}
                      <td>
                        <div className="staff-identity-group">
                          <Avatar
                            size="sm"
                            radius="xl"
                            color={
                              staff.is_student_marshal
                                ? "teal"
                                : staff.org_role === "admin"
                                ? "blue"
                                : "orange"
                            }
                            variant="light"
                            styles={{
                              placeholder: {
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                              },
                            }}
                          >
                            {getInitials(staff.name)}
                          </Avatar>
                          <div style={{ minWidth: 0 }}>
                            <div className="staff-name">{staff.name}</div>
                            <div className="staff-subtext">{staff.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Unit */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontWeight: 500 }}>{staff.organization_name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className="operator-unit-chip">
                              {staff.organization_code}
                            </span>
                            <Text size="xs" c="dimmed">
                              ({staff.org_type})
                            </Text>
                          </div>
                        </div>
                      </td>

                      {/* System Role Badge */}
                      <td>
                        <span className={`operator-role-badge ${roleClass}`}>
                          {staff.is_student_marshal ? (
                            <>
                              <IconSchool size={12} />
                              <span>Student Marshal</span>
                            </>
                          ) : staff.org_role === "admin" ? (
                            <>
                              <IconShield size={12} />
                              <span>Unit Admin</span>
                            </>
                          ) : (
                            <>
                              <IconUserCheck size={12} />
                              <span>Field Marshal</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Credentials */}
                      <td>
                        {staff.is_student_marshal && staff.student_identifier ? (
                          <Group gap={4} wrap="nowrap" align="center">
                            <span className="operator-id-tag">
                              <IconId size={12} style={{ color: "#10b981" }} />
                              <span>{staff.student_identifier}</span>
                            </span>
                            <CopyButton value={staff.student_identifier}>
                              {({ copied, copy }) => (
                                <Tooltip label={copied ? "Copied!" : "Copy Student ID"}>
                                  <ActionIcon
                                    variant="subtle"
                                    size="xs"
                                    color={copied ? "teal" : "gray"}
                                    onClick={copy}
                                    aria-label="Copy student identifier"
                                  >
                                    {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </CopyButton>
                          </Group>
                        ) : (
                          <span className="operator-id-tag">
                            Faculty / Staff Account
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <Group gap={6} justify="flex-end" wrap="nowrap">
                          <CopyButton value={staff.email}>
                            {({ copied, copy }) => (
                              <Tooltip label={copied ? "Email Copied!" : "Copy Email"}>
                                <button
                                  type="button"
                                  className="operator-action-btn"
                                  onClick={copy}
                                  aria-label={`Copy email for ${staff.name}`}
                                >
                                  {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                                </button>
                              </Tooltip>
                            )}
                          </CopyButton>

                          <Tooltip label="View Organization">
                            <button
                              type="button"
                              className="operator-action-btn"
                              onClick={() => navigate(`/admin/organizations/${staff.organization_id}`)}
                              aria-label={`View ${staff.organization_name}`}
                            >
                              <IconArrowUpRight size={13} />
                            </button>
                          </Tooltip>
                        </Group>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 4. Pagination & Summary Row ─── */}
        {filteredStaff.length > 0 && (
          <div className="staff-pagination-row">
            <span className="staff-count-summary">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filteredStaff.length)} of {filteredStaff.length} operators
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

      {/* ─── 5. Modals ─── */}
      <MarshalCreateModal
        opened={marshalOpened}
        onClose={() => {
          setMarshalOpened(false);
          loadStaff();
        }}
      />
    </Container>
  );
}
