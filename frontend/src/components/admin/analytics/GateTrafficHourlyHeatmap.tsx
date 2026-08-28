import { Paper, Title, Text, Group, Box, Badge, Tooltip } from "@mantine/core";
import { IconClock, IconFlame } from "@tabler/icons-react";
import type { HourlyTrafficEntry } from "../../../types/analytics";

interface Props {
  traffic: HourlyTrafficEntry[];
  loading?: boolean;
}

export function GateTrafficHourlyHeatmap({ traffic }: Props) {
  const maxCheckins = Math.max(1, ...traffic.map((t) => t.checkins));
  const peakHour = traffic.reduce((max, curr) => (curr.checkins > max.checkins ? curr : max), traffic[0] || { hour_label: "N/A", checkins: 0 });

  return (
    <Paper p="lg" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
      <Group justify="space-between" mb="md">
        <Box>
          <Group gap="xs">
            <IconClock size={20} color="var(--mantine-color-indigo-filled)" />
            <Title order={4}>Hourly Campus Influx & Gate Congestion Profile</Title>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Real-time passenger flow distribution across campus entry gates & kiosks (7:00 AM - 7:00 PM)
          </Text>
        </Box>
        {peakHour && peakHour.checkins > 0 && (
          <Badge variant="gradient" gradient={{ from: "orange", to: "red" }} size="md" leftSection={<IconFlame size={12} />}>
            Peak: {peakHour.hour_label} ({peakHour.checkins} check-ins)
          </Badge>
        )}
      </Group>

      {/* Hourly Histogram Bars */}
      <Box style={{ display: "grid", gridTemplateColumns: `repeat(${traffic.length}, 1fr)`, gap: "8px", alignItems: "end", height: "180px", paddingTop: "20px" }}>
        {traffic.map((item) => {
          const heightPct = Math.max(8, (item.checkins / maxCheckins) * 100);
          const isPeak = item.hour === peakHour?.hour && item.checkins > 0;
          const bgGradient = isPeak
            ? "linear-gradient(180deg, #f97316 0%, #ea580c 100%)"
            : item.checkins > 0
            ? "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)"
            : "rgba(255, 255, 255, 0.05)";

          return (
            <Tooltip
              key={item.hour}
              label={`${item.hour_label}: ${item.checkins} Total (${item.face_count} Face ID, ${item.qr_count} QR, ${item.marshal_count} Marshal)`}
              position="top"
              withArrow
            >
              <Box style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                <Text size="10px" fw={600} mb={4} c={item.checkins > 0 ? "dimmed" : "transparent"}>
                  {item.checkins}
                </Text>
                <Box
                  style={{
                    width: "100%",
                    height: `${heightPct}%`,
                    background: bgGradient,
                    borderRadius: "6px 6px 2px 2px",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                  }}
                />
                <Text size="10px" c="dimmed" mt={6} style={{ whiteSpace: "nowrap" }}>
                  {item.hour_label.split(" ")[0]}
                </Text>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Methodology Legends */}
      <Group justify="center" gap="xl" mt="lg" pt="sm" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <Group gap={6}>
          <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6" }} />
          <Text size="xs" c="dimmed">Normal Traffic Influx</Text>
        </Group>
        <Group gap={6}>
          <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#f97316" }} />
          <Text size="xs" c="dimmed">Peak Congestion Window</Text>
        </Group>
      </Group>
    </Paper>
  );
}
