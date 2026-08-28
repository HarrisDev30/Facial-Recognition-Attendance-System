import { useState, useMemo } from "react";
import {
  Drawer,
  TextInput,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Paper,
  Avatar,
  Box,
  ScrollArea,
} from "@mantine/core";
import {
  IconSearch,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { AttendeeResponse } from "../../api/attendees";

interface Props {
  opened: boolean;
  onClose: () => void;
  attendees: AttendeeResponse[];
  onSelectAttendee: (attendee: AttendeeResponse) => void;
}

export function RapidRosterTriageDrawer({
  opened,
  onClose,
  attendees,
  onSelectAttendee,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return attendees.slice(0, 30);
    const q = query.toLowerCase().trim();
    return attendees.filter(
      (a) =>
        (a.identifier && a.identifier.toLowerCase().includes(q)) ||
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.department_code && a.department_code.toLowerCase().includes(q)) ||
        (a.department_name && a.department_name.toLowerCase().includes(q))
    );
  }, [attendees, query]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Group gap="xs">
          <IconUsers size={20} color="var(--brand-primary, #10b981)" />
          <Text fw={700}>Search Students</Text>
        </Group>
      }
    >
      <Stack gap="md" style={{ height: "calc(100vh - 100px)" }}>
        <TextInput
          placeholder="Search by student name, ID number, or department..."
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          autoFocus
        />

        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {filtered.length} student{filtered.length === 1 ? "" : "s"} found
          </Text>
          <Badge size="xs" variant="light" color="teal">
            {attendees.length} Enrolled
          </Badge>
        </Group>

        <ScrollArea style={{ flex: 1 }}>
          <Stack gap="xs">
            {filtered.length === 0 ? (
              <Paper p="lg" radius="md" withBorder style={{ textAlign: "center" }}>
                <Text size="sm" c="dimmed">
                  No students found matching "{query}".
                </Text>
              </Paper>
            ) : (
              filtered.map((att) => (
                <Paper
                  key={att.id}
                  p="sm"
                  radius="md"
                  withBorder
                  style={{
                    background: "var(--mantine-color-body)",
                    transition: "border-color 0.2s ease",
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Avatar size="md" radius="xl" color="teal">
                        {att.first_name?.[0]}
                        {att.last_name?.[0]}
                      </Avatar>
                      <Box style={{ minWidth: 0 }}>
                        <Text fw={600} size="sm" truncate>
                          {att.first_name} {att.last_name}
                        </Text>
                        <Group gap={6} mt={2}>
                          <Text size="xs" ff="monospace" fw={500} c="teal">
                            {att.identifier || "No ID"}
                          </Text>
                          {att.department_code && (
                            <Badge size="xs" variant="outline" color="gray">
                              {att.department_code}
                            </Badge>
                          )}
                        </Group>
                      </Box>
                    </Group>

                    <Button
                      size="xs"
                      color="teal"
                      variant="light"
                      leftSection={<IconUserCheck size={14} />}
                      onClick={() => {
                        onSelectAttendee(att);
                        onClose();
                      }}
                    >
                      Check In
                    </Button>
                  </Group>
                </Paper>
              ))
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Drawer>
  );
}
