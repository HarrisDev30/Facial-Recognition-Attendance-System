import { useEffect, useState } from "react";
import {
  Modal,
  Stack,
  Select,
  TextInput,
  Textarea,
  Button,
  Group,
  Alert,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { manualOverride } from "../api/scanner";
import { getAttendees } from "../api/attendees";
import type { AttendeeResponse } from "../api/attendees";
import { getApiError } from "../utils/error";
import ConfirmDialog from "../components/shared/ConfirmDialog";

const OVERRIDE_REASONS = [
  { value: "face_not_detected", label: "Face not detected" },
  { value: "verification_failed", label: "Verification failed" },
  { value: "technical_issue", label: "Technical issue with scanner" },
  { value: "camera_not_working", label: "Camera not working" },
  { value: "student_not_enrolled", label: "Student not enrolled in biometrics" },
  { value: "other", label: "Other" },
];

interface Props {
  opened: boolean;
  onClose: () => void;
  sessionId: string;
  onSuccess?: () => void;
}

export default function MarshalOverride({ opened, onClose, sessionId, onSuccess }: Props) {
  const [attendees, setAttendees] = useState<AttendeeResponse[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingAttendees, setFetchingAttendees] = useState(false);
  const [attendeeFetchFailed, setAttendeeFetchFailed] = useState(false);
  const [manualAttendeeId, setManualAttendeeId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState("");
  const [confirmDisplayName, setConfirmDisplayName] = useState("");

  useEffect(() => {
    if (!opened) return;
    setSelectedAttendeeId(null);
    setReason(null);
    setNotes("");
    setManualAttendeeId("");
    setAttendeeFetchFailed(false);
    setFetchingAttendees(true);
    (async () => {
      try {
        const res = await getAttendees();
        setAttendees(res);
      } catch {
        setAttendeeFetchFailed(true);
      } finally {
        setFetchingAttendees(false);
      }
    })();
  }, [opened]);

  const handleSubmit = () => {
    const targetId = selectedAttendeeId || manualAttendeeId;
    if (!targetId) return;
    const label = selectedAttendeeId
      ? attendees.find((a) => a.identifier === selectedAttendeeId)
      : null;
    const displayName = label
      ? `${label.first_name} ${label.last_name} (${label.identifier})`
      : targetId;
    setConfirmTargetId(targetId);
    setConfirmDisplayName(displayName);
    setConfirmOpen(true);
  };

  const doSubmit = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const combinedReason = [reason, notes].filter(Boolean).join(" — ");
      const result = await manualOverride(
        sessionId,
        confirmTargetId,
        combinedReason || undefined,
      );
      notifications.show({
        title: "Success",
        message: result.message,
        color: "green",
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      notifications.show({
        title: "Error",
        message: getApiError(err),
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!(selectedAttendeeId || manualAttendeeId);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Manual Attendance Override"
      size="md"
    >
      <Stack>
        <Alert color="orange">
          This will log attendance for a student without face recognition.
          Only use when the scanner cannot verify the student.
        </Alert>

        {fetchingAttendees ? (
          <Group py="md">
            <Loader size="sm" />
            Loading attendees...
          </Group>
        ) : attendeeFetchFailed ? (
          <TextInput
            label="Attendee ID"
            placeholder="Enter attendee identifier manually..."
            value={manualAttendeeId}
            onChange={(e) => setManualAttendeeId(e.currentTarget.value)}
            description="Attendee list could not be loaded. Enter ID manually."
          />
        ) : (
          <Select
            label="Search Attendee"
            placeholder="Type to search by Attendee ID or name..."
            data={attendees.map((a) => ({
              value: a.identifier,
              label: `${a.first_name} ${a.last_name} (${a.identifier})`,
            }))}
            value={selectedAttendeeId}
            onChange={setSelectedAttendeeId}
            searchable
            nothingFoundMessage="No attendees found"
            maxDropdownHeight={200}
          />
        )}

        <Select
          label="Override Reason"
          placeholder="Select reason..."
          data={OVERRIDE_REASONS}
          value={reason}
          onChange={setReason}
          clearable
        />

        <Textarea
          label="Notes (optional)"
          placeholder="Additional details..."
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
        />

        <Group mt="md">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={loading}
          >
            Confirm Override
          </Button>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
      <ConfirmDialog
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doSubmit}
        title="Confirm Override"
        message={`Are you sure you want to manually log attendance for ${confirmDisplayName}? This action is audited and cannot be undone.`}
        confirmLabel="Confirm Override"
        color="orange"
        loading={loading}
      />
    </Modal>
  );
}
