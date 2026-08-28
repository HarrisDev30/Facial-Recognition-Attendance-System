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
  Chip,
  Text,
  Badge,
  Paper,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconShieldCheck,
  IconId,
  IconSun,
  IconUserX,
  IconCamera,
  IconCheck,
} from "@tabler/icons-react";
import client from "../api/client";
import { getAttendees } from "../api/attendees";
import type { AttendeeResponse } from "../api/attendees";
import { getApiError } from "../utils/error";
import ConfirmDialog from "../components/shared/ConfirmDialog";

const QUICK_TAGS = [
  { value: "Physical ID Card Verified", label: "Physical ID Card Verified", icon: IconId, color: "teal" },
  { value: "Lighting / Sun Glare", label: "Lighting / Sun Glare", icon: IconSun, color: "orange" },
  { value: "Face Not Enrolled", label: "Face Not Enrolled", icon: IconUserX, color: "blue" },
  { value: "Camera / Hardware Issue", label: "Camera Issue", icon: IconCamera, color: "grape" },
  { value: "System Override", label: "System Override", icon: IconShieldCheck, color: "yellow" },
];

interface Props {
  opened: boolean;
  onClose: () => void;
  sessionId: string;
  preselectedAttendee?: AttendeeResponse | null;
  onSuccess?: () => void;
}

export default function MarshalOverride({
  opened,
  onClose,
  sessionId,
  preselectedAttendee,
  onSuccess,
}: Props) {
  const [attendees, setAttendees] = useState<AttendeeResponse[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [reasonTag, setReasonTag] = useState<string>("Physical ID Card Verified");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingAttendees, setFetchingAttendees] = useState(false);
  const [attendeeFetchFailed, setAttendeeFetchFailed] = useState(false);
  const [manualIdentifier, setManualIdentifier] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!opened) return;
    if (preselectedAttendee) {
      setSelectedAttendeeId(preselectedAttendee.id);
      setManualIdentifier(preselectedAttendee.identifier || "");
    } else {
      setSelectedAttendeeId(null);
      setManualIdentifier("");
    }
    setReasonTag("Physical ID Card Verified");
    setNotes("");
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
  }, [opened, preselectedAttendee]);

  const selectedObj = preselectedAttendee || attendees.find((a) => a.id === selectedAttendeeId);
  const displayName = selectedObj
    ? `${selectedObj.first_name} ${selectedObj.last_name} (${selectedObj.identifier || "No ID"})`
    : manualIdentifier || "Selected Student";

  const handleSubmit = () => {
    if (!selectedAttendeeId && !manualIdentifier.trim()) {
      notifications.show({
        title: "Student Required",
        message: "Please select or type a student ID number.",
        color: "yellow",
      });
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmedOverride = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      await client.post("/api/marshal/override", {
        session_id: sessionId,
        attendee_id: selectedAttendeeId || undefined,
        student_identifier: manualIdentifier.trim() || undefined,
        reason_tag: reasonTag,
        notes: notes.trim() || undefined,
      });

      notifications.show({
        title: "Manual Check-In Confirmed",
        message: `Verified: ${displayName}`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = getApiError(err);
      notifications.show({
        title: "Override Failed",
        message: msg,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectData = attendees.map((a) => ({
    value: a.id,
    label: `${a.first_name} ${a.last_name} (${a.identifier || "No ID"})${a.department_code ? ` - ${a.department_code}` : ""}`,
  }));

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="xs">
            <IconShieldCheck size={20} color="var(--mantine-color-teal-filled)" />
            <Text fw={600} size="md">Marshal Fast-Triage Manual Override</Text>
          </Group>
        }
        centered
        size="lg"
      >
        <Stack gap="md">
          {preselectedAttendee ? (
            <Paper p="sm" radius="md" withBorder style={{ background: "rgba(16, 185, 129, 0.05)", borderColor: "rgba(16, 185, 129, 0.2)" }}>
              <Group justify="space-between">
                <div>
                  <Text fw={600} size="sm">
                    {preselectedAttendee.first_name} {preselectedAttendee.last_name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ID: {preselectedAttendee.identifier} • {preselectedAttendee.department_name || "General"}
                  </Text>
                </div>
                <Badge color="teal" variant="light">
                  Ready to Verify
                </Badge>
              </Group>
            </Paper>
          ) : (
            <>
              {fetchingAttendees ? (
                <Group justify="center" p="xs">
                  <Loader size="sm" />
                  <Text size="xs" c="dimmed">Loading campus attendee roster...</Text>
                </Group>
              ) : attendeeFetchFailed ? (
                <Alert color="orange" title="Offline Roster Mode" p="xs">
                  <Text size="xs">
                    Could not fetch cloud attendee roster. Please enter the student's ID number below.
                  </Text>
                </Alert>
              ) : (
                <Select
                  label="Search Student Attendee"
                  placeholder="Type name, student ID, or department..."
                  data={selectData}
                  value={selectedAttendeeId}
                  onChange={(val) => {
                    setSelectedAttendeeId(val);
                    setManualIdentifier("");
                  }}
                  searchable
                  clearable
                />
              )}

              <TextInput
                label="Or Direct Student Identifier"
                placeholder="e.g. CCS-2026-001"
                value={manualIdentifier}
                onChange={(e) => {
                  setManualIdentifier(e.currentTarget.value);
                  if (e.currentTarget.value) setSelectedAttendeeId(null);
                }}
              />
            </>
          )}

          {/* Quick-Tag Reason Selector */}
          <div>
            <Text size="xs" fw={600} mb={6}>
              Verification Reason Tag:
            </Text>
            <Chip.Group value={reasonTag} onChange={(val) => setReasonTag(val as string)}>
              <Group gap="xs" wrap="wrap">
                {QUICK_TAGS.map((tag) => (
                  <Chip key={tag.value} value={tag.value} color={tag.color} variant="light" size="xs">
                    {tag.label}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          </div>

          <Textarea
            label="Officer Audit Notes (Optional)"
            placeholder="e.g., Student ID matches matriculation card, granted entrance by marshal."
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />

          <Group justify="flex-end" gap="sm" mt="xs">
            <Button variant="subtle" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleSubmit}
              loading={loading}
              leftSection={<IconCheck size={16} />}
            >
              Confirm 1-Tap Check-In
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDialog
        opened={confirmOpen}
        title="Confirm Manual Attendance Override"
        message={`Authorize manual attendance verification for ${displayName} under tag [${reasonTag}]?`}
        confirmLabel="Verify & Check In"
        color="teal"
        onConfirm={handleConfirmedOverride}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
