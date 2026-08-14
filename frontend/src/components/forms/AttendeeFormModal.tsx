import { useEffect, useState } from "react";
import {
  Modal,
  TextInput,
  Select,
  Stack,
  Group,
  Button,
} from "@mantine/core";
import type { AttendeeResponse, AttendeeCreate } from "../../api/attendees";
import { getDepartments } from "../../api/departments";
import type { DepartmentResponse } from "../../types/auth";

interface AttendeeFormModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: AttendeeCreate) => void;
  initial?: AttendeeResponse | null;
  loading?: boolean;
}

export default function AttendeeFormModal({
  opened,
  onClose,
  onSubmit,
  initial,
  loading,
}: AttendeeFormModalProps) {
  const [identifier, setIdentifier] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [attendeeType, setAttendeeType] = useState("student");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);

  useEffect(() => {
    if (opened) {
      getDepartments().then((res) => setDepartments(res.items));
    }
  }, [opened]);

  useEffect(() => {
    if (opened) {
      setIdentifier(initial?.identifier ?? "");
      setFirstName(initial?.first_name ?? "");
      setLastName(initial?.last_name ?? "");
      setEmail(initial?.email ?? "");
      setAttendeeType(initial?.attendee_type ?? "student");
      setDepartmentId(initial?.department_id ?? null);
    }
  }, [opened, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      identifier,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      attendee_type: attendeeType,
      department_id: departmentId ?? "",
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={initial ? "Edit Attendee" : "Add Attendee"}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.currentTarget.value)}
            required
            maxLength={50}
          />
          <TextInput
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.currentTarget.value)}
            required
            maxLength={100}
          />
          <TextInput
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.currentTarget.value)}
            required
            maxLength={100}
          />
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            maxLength={255}
          />
          <Select
            label="Type"
            value={attendeeType}
            onChange={(v) => setAttendeeType(v ?? "student")}
            data={[
              { value: "student", label: "Student" },
              { value: "staff", label: "Staff" },
            ]}
            required
          />
          <Select
            label="Department"
            value={departmentId}
            onChange={setDepartmentId}
            data={departments.map((d) => ({ value: d.id, label: d.name }))}
            searchable
            required
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {initial ? "Save Changes" : "Add Attendee"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
