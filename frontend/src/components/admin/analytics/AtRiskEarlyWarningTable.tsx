import { Paper, Title, Text, Group, Box, Badge, Table } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { AtRiskStudentEntry } from "../../../types/analytics";

interface Props {
  students: AtRiskStudentEntry[];
  thresholdPct?: number;
  loading?: boolean;
}

export function AtRiskEarlyWarningTable({ students, thresholdPct = 75 }: Props) {
  if (students.length === 0) {
    return (
      <Paper p="lg" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
        <Group justify="space-between">
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-teal-filled)" />
            <Title order={4}>Institutional Clearance & At-Risk Radar</Title>
          </Group>
          <Badge color="teal" variant="light">
            All Cohorts Compliant (&ge; {thresholdPct}%)
          </Badge>
        </Group>
        <Text size="sm" c="dimmed" mt="xs">
          No students are currently flagged below the minimum {thresholdPct}% attendance threshold across campus events.
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="lg" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
      <Group justify="space-between" mb="md">
        <Box>
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-red-filled)" />
            <Title order={4}>Institutional Clearance & At-Risk Radar</Title>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Early warning detection for students falling below the mandatory {thresholdPct}% clearance benchmark
          </Text>
        </Box>
        <Badge variant="light" color="red" size="md">
          {students.length} Flagged for Review
        </Badge>
      </Group>

      <Table.ScrollContainer minWidth={600}>
        <Table verticalSpacing="xs" striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Student Identifier</Table.Th>
              <Table.Th>Student Name</Table.Th>
              <Table.Th>Academic Department</Table.Th>
              <Table.Th>Events Attended</Table.Th>
              <Table.Th>Attendance %</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {students.map((stu) => {
              const rateColor = stu.attendance_rate < 50 ? "red" : "yellow";
              return (
                <Table.Tr key={stu.id}>
                  <Table.Td>
                    <Text fw={600} size="sm" ff="monospace">
                      {stu.identifier}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {stu.first_name} {stu.last_name}
                    </Text>
                    {stu.email && (
                      <Text size="xs" c="dimmed">
                        {stu.email}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="outline" color="blue">
                      {stu.department_code || stu.department_name || "General"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {stu.events_attended} / {stu.events_available}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={rateColor} variant="filled" size="sm">
                      {stu.attendance_rate}%
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="red" variant="light" size="xs">
                      At-Risk (Non-Compliant)
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
