import { Paper, Title, Text, Group, Box, Badge, Progress, Stack } from "@mantine/core";
import { IconUsers, IconChartBar } from "@tabler/icons-react";
import type { CollegeAttendanceBenchmark } from "../../../types/analytics";

interface Props {
  colleges: CollegeAttendanceBenchmark[];
  loading?: boolean;
}

export function CampusCollegeBenchmarkChart({ colleges }: Props) {
  if (colleges.length === 0) {
    return (
      <Paper p="lg" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
        <Title order={4} mb="xs">
          Academic College Participation & Clearance Benchmark
        </Title>
        <Text c="dimmed" size="sm">
          No college attendance data recorded yet for this semester.
        </Text>
      </Paper>
    );
  }

  // Sort descending by attendance rate
  const sorted = [...colleges].sort((a, b) => b.attendance_rate - a.attendance_rate);

  return (
    <Paper p="lg" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
      <Group justify="space-between" mb="md">
        <Box>
          <Group gap="xs">
            <IconChartBar size={20} color="var(--mantine-color-blue-filled)" />
            <Title order={4}>Inter-College Attendance Benchmark Matrix</Title>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Comparative student compliance rates across academic departments & colleges
          </Text>
        </Box>
        <Badge variant="light" color="blue" size="md">
          {colleges.length} Active Colleges
        </Badge>
      </Group>

      <Stack gap="md">
        {sorted.map((college, idx) => {
          const isTop = idx === 0 && college.attendance_rate > 0;
          const rateColor =
            college.attendance_rate >= 85 ? "teal" : college.attendance_rate >= 70 ? "blue" : college.attendance_rate >= 50 ? "yellow" : "red";

          return (
            <Box key={college.id} p="sm" style={{ borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <Group justify="space-between" mb={6}>
                <Group gap="xs">
                  <Badge size="sm" variant="filled" color={isTop ? "yellow" : "gray"}>
                    #{idx + 1}
                  </Badge>
                  <Text fw={600} size="sm">
                    {college.name}
                  </Text>
                  <Badge size="xs" variant="outline" color="gray">
                    {college.code}
                  </Badge>
                </Group>
                <Group gap="md">
                  <Group gap={4}>
                    <IconUsers size={14} style={{ opacity: 0.6 }} />
                    <Text size="xs" c="dimmed">
                      {college.attended_count} / {college.enrolled_count} Attendees
                    </Text>
                  </Group>
                  <Text fw={700} size="sm" c={rateColor}>
                    {college.attendance_rate}%
                  </Text>
                </Group>
              </Group>

              <Progress
                value={college.attendance_rate}
                color={rateColor}
                size="md"
                radius="xl"
                animated={college.attendance_rate > 0}
              />
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
