import type { ReactNode } from "react";
import { SimpleGrid, Paper, Text, Group, Box } from "@mantine/core";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  trend?: {
    value: number;
    positive: boolean;
  };
  accentColor?: string;
}

interface StatsRowProps {
  stats: StatCardProps[];
  cols?: number;
}

export default function StatsRow({ stats, cols = 4 }: StatsRowProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: cols }}>
      {stats.map((stat) => {
        const accent = stat.accentColor || "var(--text-secondary)";

        return (
          <Paper
            key={stat.label}
            p="md"
            py="sm"
            radius="md"
            bg={`${accent}08`}
          >
            <Group gap="sm" align="flex-start" wrap="nowrap">
              {stat.icon && (
                <Box
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: accent,
                    marginTop: 2,
                  }}
                >
                  {stat.icon}
                </Box>
              )}

              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs" align="baseline" wrap="nowrap">
                  <Text
                    size="3xl"
                    fw={600}
                    c={stat.color || "var(--text-primary)"}
                    style={{ lineHeight: "1.1" }}
                  >
                    {stat.value}
                  </Text>
                  {stat.trend && (
                    <Text
                      size="sm"
                      fw={600}
                      c={
                        stat.trend.positive
                          ? "var(--mantine-color-teal-4)"
                          : "var(--mantine-color-red-4)"
                      }
                      style={{ flexShrink: 0, lineHeight: 1 }}
                    >
                      {stat.trend.positive ? "+" : ""}
                      {stat.trend.value}%
                    </Text>
                  )}
                </Group>

                <Text size="xs" c="var(--text-secondary)" fw={600} mt={2} lh="1.4">
                  {stat.label}
                </Text>
              </Box>
            </Group>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}
