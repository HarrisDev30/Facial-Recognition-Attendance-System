import { useState, useMemo, useEffect } from "react";
import {
  Modal,
  TextInput,
  Text,
  Group,
  Badge,
  Button,
  Box,
  Stack,
  ActionIcon,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconSearch,
  IconUserCheck,
  IconUsers,
  IconX,
  IconArrowLeft,
  IconId,
  IconSun,
  IconUserX,
  IconCamera,
  IconShieldCheck,
  IconCheck,
} from "@tabler/icons-react";
import client from "../../api/client";
import { getApiError } from "../../utils/error";
import type { AttendeeResponse } from "../../api/attendees";
import "./StudentSearchModal.css";

const REASONS = [
  { value: "Physical ID Card Verified", label: "Physical ID Card", icon: IconId },
  { value: "Lighting / Sun Glare", label: "Lighting Glare", icon: IconSun },
  { value: "Face Not Enrolled", label: "Face Not Enrolled", icon: IconUserX },
  { value: "Camera / Hardware Issue", label: "Camera Issue", icon: IconCamera },
  { value: "System Override", label: "System Override", icon: IconShieldCheck },
];

interface StudentSearchModalProps {
  opened: boolean;
  onClose: () => void;
  attendees: AttendeeResponse[];
  sessionId?: string | null;
  onSelectAttendee?: (attendee: AttendeeResponse) => void;
  onSuccess?: () => void;
  zIndex?: number;
}

export default function StudentSearchModal({
  opened,
  onClose,
  attendees,
  sessionId,
  onSelectAttendee,
  onSuccess,
  zIndex = 2000,
}: StudentSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<AttendeeResponse | null>(null);
  const [reasonTag, setReasonTag] = useState<string>("Physical ID Card Verified");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset step on modal open/close
  useEffect(() => {
    if (opened) {
      setQuery("");
      setSelectedStudent(null);
      setReasonTag("Physical ID Card Verified");
      setNotes("");
    }
  }, [opened]);

  const filtered = useMemo(() => {
    if (!query.trim()) return attendees.slice(0, 25);
    const q = query.toLowerCase().trim();
    return attendees.filter(
      (a) =>
        (a.identifier && a.identifier.toLowerCase().includes(q)) ||
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.department_code && a.department_code.toLowerCase().includes(q)) ||
        (a.department_name && a.department_name.toLowerCase().includes(q)),
    );
  }, [attendees, query]);

  const handlePickStudent = (att: AttendeeResponse) => {
    if (onSelectAttendee && !sessionId) {
      onSelectAttendee(att);
      onClose();
    } else {
      setSelectedStudent(att);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedStudent) return;
    if (!sessionId) {
      if (onSelectAttendee) {
        onSelectAttendee(selectedStudent);
      }
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await client.post("/api/marshal/override", {
        session_id: sessionId,
        attendee_id: selectedStudent.id,
        student_identifier: selectedStudent.identifier || undefined,
        reason_tag: reasonTag,
        notes: notes.trim() || undefined,
      });

      notifications.show({
        title: "Manual Check-In Confirmed",
        message: `Verified: ${selectedStudent.first_name} ${selectedStudent.last_name}`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = getApiError(err);
      notifications.show({
        title: "Check-In Failed",
        message: msg,
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      zIndex={zIndex}
      classNames={{ root: "student-search-modal-root" }}
      title={
        selectedStudent ? (
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setSelectedStudent(null)}
              aria-label="Back to search"
            >
              <IconArrowLeft size={16} />
            </ActionIcon>
            <Text fw={700} size="md">
              Confirm Manual Check-In
            </Text>
          </Group>
        ) : (
          <Group gap="xs">
            <IconUsers size={20} color="var(--brand-primary, #10b981)" />
            <Text fw={700} size="md">
              Search & Manual Check-In
            </Text>
          </Group>
        )
      }
      centered
      size="lg"
      radius="lg"
      styles={{
        header: {
          paddingBottom: "8px",
        },
        body: {
          paddingTop: "4px",
        },
      }}
    >
      <div className="student-search-modal-content">
        {selectedStudent ? (
          /* ─── Step 2: Confirmation & Reason Section ─── */
          <Stack gap="md">
            {/* Student Preview Card */}
            <div className="student-search-selected-preview">
              <Group gap="sm">
                <div className="student-search-avatar">
                  {`${selectedStudent.first_name?.[0] || ""}${selectedStudent.last_name?.[0] || ""}`.toUpperCase()}
                </div>
                <div>
                  <Text size="sm" fw={700} c="var(--text-primary)">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </Text>
                  <Group gap={6} mt={2}>
                    <span className="student-search-id">
                      {selectedStudent.identifier || "No ID"}
                    </span>
                    {selectedStudent.department_code && (
                      <Badge size="xs" variant="outline" color="gray">
                        {selectedStudent.department_code}
                      </Badge>
                    )}
                  </Group>
                </div>
              </Group>
              <Badge color="teal" variant="light" size="sm">
                Ready to Verify
              </Badge>
            </div>

            {/* Reason Selection Chips */}
            <div>
              <div className="student-search-reason-label">
                Reason for Manual Check-In
              </div>
              <div className="student-search-reason-grid">
                {REASONS.map((r) => {
                  const Icon = r.icon;
                  const isSelected = reasonTag === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      className={`student-search-reason-chip ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setReasonTag(r.value)}
                    >
                      <Icon size={14} />
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Notes */}
            <Textarea
              label={<span className="student-search-reason-label">Optional Notes</span>}
              placeholder="Add optional incident notes..."
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              rows={2}
              size="xs"
              radius="md"
            />

            {/* Action Buttons */}
            <Group justify="space-between" mt="xs">
              <Button
                variant="default"
                size="sm"
                radius="md"
                onClick={() => setSelectedStudent(null)}
              >
                ← Back
              </Button>
              <Button
                className="student-search-confirm-btn"
                size="sm"
                leftSection={<IconCheck size={16} />}
                loading={submitting}
                onClick={handleConfirmCheckIn}
              >
                Confirm Check-In
              </Button>
            </Group>
          </Stack>
        ) : (
          /* ─── Step 1: Spotlight Search List ─── */
          <>
            <TextInput
              placeholder="Search by student name, ID number, or department..."
              leftSection={<IconSearch size={16} />}
              rightSection={
                query ? (
                  <IconX
                    size={14}
                    style={{ cursor: "pointer", opacity: 0.6 }}
                    onClick={() => setQuery("")}
                  />
                ) : null
              }
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              autoFocus
              radius="md"
              size="md"
            />

            <Group justify="space-between" px={2}>
              <Text size="xs" c="dimmed">
                {query.trim()
                  ? `${filtered.length} student${filtered.length === 1 ? "" : "s"} found`
                  : `Showing ${filtered.length} recent students`}
              </Text>
              <Badge size="xs" variant="light" color="teal">
                {attendees.length} Enrolled
              </Badge>
            </Group>

            <div className="student-search-results-list">
              {filtered.length === 0 ? (
                <div className="student-search-empty-state">
                  <Text size="sm" fw={600} c="var(--text-primary)">
                    No students found
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    No student matched "{query}". Try checking the ID number or spelling.
                  </Text>
                </div>
              ) : (
                filtered.map((att) => {
                  const initials = `${att.first_name?.[0] || ""}${att.last_name?.[0] || ""}`.toUpperCase() || "S";
                  const fullName = `${att.first_name} ${att.last_name}`;

                  return (
                    <div key={att.id} className="student-search-card">
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <div className="student-search-avatar">
                          {initials}
                        </div>
                        <Box style={{ minWidth: 0 }}>
                          <Text className="student-search-name" truncate>
                            {fullName}
                          </Text>
                          <Group gap={6} mt={2} wrap="wrap">
                            <span className="student-search-id">
                              {att.identifier || "No ID"}
                            </span>
                            {att.department_code && (
                              <Badge size="xs" variant="outline" color="gray">
                                {att.department_code}
                              </Badge>
                            )}
                          </Group>
                        </Box>
                      </Group>

                      <Button
                        className="student-search-checkin-btn"
                        leftSection={<IconUserCheck size={14} />}
                        onClick={() => handlePickStudent(att)}
                      >
                        Check In
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
