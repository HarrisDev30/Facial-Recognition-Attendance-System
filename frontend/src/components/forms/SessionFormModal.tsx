import { useEffect, useState } from "react";
import {
  Modal,
  TextInput,
  Stack,
  Group,
  Button,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import type { SessionCreate, SessionResponse } from "../../types/session";

interface SessionFormModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: SessionCreate) => void;
  initial?: SessionResponse | null;
  loading?: boolean;
}

function SessionFormModal({
  opened,
  onClose,
  onSubmit,
  initial,
  loading,
}: SessionFormModalProps) {
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState("10:00");

  useEffect(() => {
    if (opened) {
      setName(initial?.name ?? "");
      setVenue(initial?.venue ?? "");
      if (initial) {
        const s = new Date(initial.start_time);
        const e = new Date(initial.end_time);
        setStartDate(s);
        setStartTime(
          `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`,
        );
        setEndDate(e);
        setEndTime(
          `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`,
        );
      } else {
        setName("");
        setVenue("");
        setStartDate(null);
        setStartTime("09:00");
        setEndDate(null);
        setEndTime("10:00");
      }
    }
  }, [opened, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    const combine = (date: Date, time: string) => {
      const [h, m] = time.split(":");
      const d = new Date(date);
      d.setHours(parseInt(h), parseInt(m), 0, 0);
      return d.toISOString();
    };
    onSubmit({
      name,
      venue: venue || null,
      start_time: combine(startDate, startTime),
      end_time: combine(endDate, endTime),
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={initial ? "Edit Session" : "Create Session"}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            maxLength={200}
            placeholder="e.g. Morning Attendance, Afternoon Session"
          />

          <TextInput
            label="Venue (optional)"
            value={venue}
            onChange={(e) => setVenue(e.currentTarget.value)}
            placeholder="e.g. Court A, Room 201"
            maxLength={200}
          />

          <DatePickerInput
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
            required
            clearable={false}
            popoverProps={{ withinPortal: true, position: "bottom" }}
          />
          <TextInput
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.currentTarget.value)}
            required
          />

          <DatePickerInput
            label="End Date"
            value={endDate}
            onChange={setEndDate}
            required
            clearable={false}
            popoverProps={{ withinPortal: true, position: "bottom" }}
          />
          <TextInput
            label="End Time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.currentTarget.value)}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!startDate || !endDate}>
              {initial ? "Save Changes" : "Create Session"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default SessionFormModal;
