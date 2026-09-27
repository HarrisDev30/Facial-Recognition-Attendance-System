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
  Select,
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
  IconInfoCircle,
  IconChecklist,
  IconEye,
  IconCalendarOff,
} from "@tabler/icons-react";
import client from "../../api/client";
import { getApiError } from "../../utils/error";
import type { AttendeeResponse } from "../../api/attendees";
import type { ActiveSession } from "../../api/marshal";
import "./StudentSearchModal.css";

const REASONS = [
  { value: "Physical ID Card Verified", label: "Physical ID Card", icon: IconId },
  { value: "Lighting / Sun Glare", label: "Lighting Glare", icon: IconSun },
  { value: "Face Not Enrolled", label: "Face Not Enrolled", icon: IconUserX },
  { value: "Camera / Hardware Issue", label: "Camera Issue", icon: IconCamera },
  { value: "System Override", label: "System Override", icon: IconShieldCheck },
];

export interface StudentSearchModalProps {
  opened: boolean;
  onClose: () => void;
  attendees: AttendeeResponse[];
  sessionId?: string | null;
  activeSessions?: ActiveSession[];
  onSelectAttendee?: (attendee: AttendeeResponse) => void;
  onSuccess?: () => void;
  zIndex?: number;
}

export default function StudentSearchModal({
  opened,
  onClose,
  attendees,
  sessionId,
  activeSessions,
  onSelectAttendee,
  onSuccess,
  zIndex = 2000,
}: StudentSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<AttendeeResponse | null>(null);
  const [reasonTag, setReasonTag] = useState<string>("Physical ID Card Verified");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Dynamic session targeting state
  const [targetSessionId, setTargetSessionId] = useState<string | null>(sessionId || null);

  // Determine if active sessions exist
  const effectiveSessions = useMemo(() => activeSessions ?? [], [activeSessions]);
  const hasMultipleSessions = effectiveSessions.length > 1;
  const isCheckInAllowed = Boolean(
    targetSessionId || (effectiveSessions.length > 0 && targetSessionId !== null)
  );

  // Sync target session when modal opens or props change
  useEffect(() => {
    if (opened) {
      setQuery("");
      setSelectedStudent(null);
      setReasonTag("Physical ID Card Verified");
      setNotes("");

      if (sessionId) {
        setTargetSessionId(sessionId);
      } else if (effectiveSessions.length > 0) {
        setTargetSessionId(effectiveSessions[0].session_id);
      } else {
        setTargetSessionId(null);
      }
    }
  }, [opened, sessionId, effectiveSessions]);

  // Find active session name for display
  const currentSessionObj = useMemo(() => {
    if (!targetSessionId) return null;
    return effectiveSessions.find((s) => s.session_id === targetSessionId) || null;
  }, [effectiveSessions, targetSessionId]);

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
    if (onSelectAttendee && !isCheckInAllowed) {
      onSelectAttendee(att);
      onClose();
    } else {
      setSelectedStudent(att);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedStudent) return;
    if (!targetSessionId) {
      if (onSelectAttendee) {
        onSelectAttendee(selectedStudent);
      }
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await client.post("/api/marshal/override", {
        session_id: targetSessionId,
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
              {isCheckInAllowed ? "Confirm Manual Check-In" : "Student Details"}
            </Text>
          </Group>
        ) : (
          <Group gap="xs">
            <IconUsers size={20} color="var(--brand-primary, #10b981)" />
            <Text fw={700} size="md">
              {isCheckInAllowed ? "Search & Manual Check-In" : "Student Directory Search"}
            </Text>
            {!isCheckInAllowed && (
              <Badge size="xs" variant="light" color="gray">
                Directory Mode
              </Badge>
            )}
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
          /* ─── Step 2: Student Details & Confirmation / Reason ─── */
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
              <Badge
                color={isCheckInAllowed ? "teal" : "gray"}
                variant="light"
                size="sm"
              >
                {isCheckInAllowed ? "Ready to Verify" : "Directory Record"}
              </Badge>
            </div>

            {/* Profile Meta Details */}
            <div className="student-search-meta-grid">
              <div className="student-search-meta-item">
                <span className="student-search-meta-label">Email</span>
                <span className="student-search-meta-val">{selectedStudent.email || "—"}</span>
              </div>
              <div className="student-search-meta-item">
                <span className="student-search-meta-label">Department</span>
                <span className="student-search-meta-val">
                  {selectedStudent.department_name || selectedStudent.department_code || "General"}
                </span>
              </div>
              <div className="student-search-meta-item">
                <span className="student-search-meta-label">Photo Status</span>
                <span className="student-search-meta-val">
                  {selectedStudent.profile_photo_url ? (
                    <Badge size="xs" color="teal" variant="light">Photo Available</Badge>
                  ) : (
                    <Badge size="xs" color="yellow" variant="light">Pending Photo</Badge>
                  )}
                </span>
              </div>
              <div className="student-search-meta-item">
                <span className="student-search-meta-label">ID Number</span>
                <span className="student-search-meta-val">{selectedStudent.identifier || "N/A"}</span>
              </div>
            </div>

            {isCheckInAllowed ? (
              <>
                {/* Active Session Confirmation Box */}
                {currentSessionObj && (
                  <div className="student-search-target-session-box">
                    <Group justify="space-between" align="center">
                      <div>
                        <Text size="xs" c="dimmed">
                          Checking in to:
                        </Text>
                        <Text size="sm" fw={600} c="var(--text-primary)">
                          {currentSessionObj.session_name} — {currentSessionObj.event_name}
                        </Text>
                      </div>
                      <Badge size="xs" color="teal" variant="dot">
                        Active Gate
                      </Badge>
                    </Group>
                  </div>
                )}

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
              </>
            ) : (
              /* Informational Notice when in Directory Mode */
              <div className="student-search-no-session-notice">
                <IconCalendarOff size={20} color="var(--text-muted)" />
                <div>
                  <Text size="xs" fw={600} c="var(--text-secondary)">
                    No Active Attendance Session
                  </Text>
                  <Text size="xs" c="dimmed">
                    Manual check-in is disabled. Start a scheduled session from the Dashboard or Events page to record attendance.
                  </Text>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  radius="md"
                  mt="sm"
                  onClick={() => setSelectedStudent(null)}
                >
                  ← Back to Search
                </Button>
              </div>
            )}
          </Stack>
        ) : (
          /* ─── Step 1: Spotlight Search List ─── */
          <>
            {/* Context Notice / Mode Bar */}
            {!isCheckInAllowed ? (
              <div className="student-search-mode-banner directory-mode">
                <IconInfoCircle size={16} className="student-search-mode-icon" />
                <div className="student-search-mode-text">
                  <span>
                    <strong>Directory Lookup Mode:</strong> No active event session is currently running.
                  </span>
                </div>
              </div>
            ) : hasMultipleSessions ? (
              /* Session Picker Dropdown when multiple active sessions exist */
              <div className="student-search-session-selector-card">
                <Select
                  label="Target Attendance Session"
                  description="Select which live session to check students into"
                  size="xs"
                  radius="md"
                  data={effectiveSessions.map((s) => ({
                    value: s.session_id,
                    label: `${s.session_name} — ${s.event_name}${s.venue ? ` (${s.venue})` : ""}`,
                  }))}
                  value={targetSessionId}
                  onChange={(val) => setTargetSessionId(val)}
                  leftSection={<IconChecklist size={14} color="var(--brand-primary, #10b981)" />}
                  comboboxProps={{ zIndex: zIndex + 50 }}
                />
              </div>
            ) : currentSessionObj ? (
              /* Single active session live indicator */
              <div className="student-search-active-pill">
                <span className="student-search-pulse-dot" />
                <span className="student-search-pill-label">
                  Target Session: <strong>{currentSessionObj.session_name}</strong> ({currentSessionObj.event_name})
                </span>
              </div>
            ) : null}

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
              <Badge size="xs" variant="light" color={isCheckInAllowed ? "teal" : "gray"}>
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

                      {isCheckInAllowed ? (
                        <Button
                          className="student-search-checkin-btn"
                          leftSection={<IconUserCheck size={14} />}
                          onClick={() => handlePickStudent(att)}
                        >
                          Check In
                        </Button>
                      ) : (
                        <Button
                          className="student-search-details-btn"
                          variant="light"
                          color="gray"
                          size="xs"
                          leftSection={<IconEye size={13} />}
                          onClick={() => handlePickStudent(att)}
                        >
                          View Info
                        </Button>
                      )}
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

