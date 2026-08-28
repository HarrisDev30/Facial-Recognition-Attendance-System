import { useMemo, useState } from "react";
import {
  Container,
  Group,
  Button,
  ActionIcon,
  Text,
  Tooltip,
  Badge,
  SegmentedControl,
  Select,
} from "@mantine/core";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconShield,
} from "@tabler/icons-react";
import * as attendeesApi from "../../api/attendees";
import type { AttendeeResponse, AttendeeCreate } from "../../api/attendees";
import { useAsync, useFormSubmit } from "../../hooks";
import DataTable from "../../components/shared/DataTable";
import ConfirmDialog from "../../components/shared/ConfirmDialog";
import AttendeeFormModal from "../../components/forms/AttendeeFormModal";
import MarshalCreateModal from "../../components/forms/MarshalCreateModal";
import PageHeader from "../../components/layout/PageHeader";

type TypeFilter = "all" | "student" | "staff";

function shortId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export default function AdminAttendeesPage() {
  const [editingAttendee, setEditingAttendee] = useState<AttendeeResponse | null>(null);
  const [opened, setOpened] = useState(false);
  const [marshalOpened, setMarshalOpened] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const { data: attendeesData, loading, execute: reload } = useAsync(
    () => attendeesApi.getAttendees(),
    true,
  );

  const attendees = attendeesData ?? [];

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

  const filteredAttendees = useMemo(() => {
    let rows = attendees;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.identifier.toLowerCase().includes(q) ||
          a.first_name.toLowerCase().includes(q) ||
          a.last_name.toLowerCase().includes(q) ||
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

  const typeCounts = useMemo(() => {
    const student = attendees.filter((a) => a.attendee_type === "student").length;
    const staff = attendees.filter((a) => a.attendee_type === "staff").length;
    return { student, staff };
  }, [attendees]);

  const { submit: createSubmit, submitting: creating } = useFormSubmit(
    (data: AttendeeCreate) => attendeesApi.createAttendee(data),
    {
      onSuccess: () => {
        setOpened(false);
        reload();
      },
      successMessage: "Attendee added.",
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
      successMessage: "Attendee saved.",
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

  const columns = [
    {
      key: "identifier",
      label: "ID",
      render: (row: AttendeeResponse) => (
        <Text size="sm" fw={500}>
          {shortId(row.identifier)}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: AttendeeResponse) => (
        <Text size="sm">
          {row.last_name}, {row.first_name}
        </Text>
      ),
    },
    {
      key: "department",
      label: "Department",
      render: (row: AttendeeResponse) => (
        <Text size="sm" c="dimmed">
          {row.department_name ?? "\u2014"}
        </Text>
      ),
    },
    {
      key: "attendee_type",
      label: "Type",
      render: (row: AttendeeResponse) => (
        <span style={{ display: "inline-block", minWidth: 68 }}>
          <Badge
            size="sm"
            variant="light"
            color={row.attendee_type === "student" ? "blue" : "violet"}
          >
            {row.attendee_type}
          </Badge>
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: AttendeeResponse) => (
        <Group gap="xs">
          <Tooltip label="Edit">
            <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(row)}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon variant="subtle" color="red" onClick={() => setDeleteId(row.id)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <Container size="lg" pt={0} pb="4xl">
      <PageHeader title="Attendees">
        <Button
          leftSection={<IconShield size={18} />}
          variant="outline"
          color="orange"
          onClick={() => setMarshalOpened(true)}
        >
          Create Marshal
        </Button>
        <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
          Add Attendee
        </Button>
      </PageHeader>

      <Group justify="space-between" mb="sm" wrap="wrap">
        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            size="sm"
            data={[
              { label: `All (${attendees.length})`, value: "all" },
              { label: `Student (${typeCounts.student})`, value: "student" },
              { label: `Staff (${typeCounts.staff})`, value: "staff" },
            ]}
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
          />
          {departments.length > 0 && (
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
      </Group>

      <DataTable
        columns={columns}
        rows={filteredAttendees}
        loading={loading}
        emptyMessage="No attendees match the selected filters."
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search attendees by ID, name, or department..."
        total={filteredAttendees.length}
      />

      <Text size="sm" c="dimmed" mt="sm">
        Showing {filteredAttendees.length} of {attendees.length} attendee
        {attendees.length !== 1 ? "s" : ""}
      </Text>

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
        title="Delete attendee"
        message="Delete this attendee? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />
    </Container>
  );
}
