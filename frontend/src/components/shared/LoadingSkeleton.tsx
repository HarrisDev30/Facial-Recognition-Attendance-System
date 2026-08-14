import { Skeleton, Stack, Group, Paper } from "@mantine/core";

interface LoadingSkeletonProps {
  type?: "table" | "card" | "stats" | "text";
  rows?: number;
  count?: number;
  lines?: number;
}

export default function LoadingSkeleton({
  type = "text",
  rows = 5,
  count = 3,
  lines = 3,
}: LoadingSkeletonProps) {
  if (type === "table") {
    return (
      <Stack gap="xs">
        {Array.from({ length: rows }).map((_, i) => (
          <Group key={i} gap="md" grow>
            <Skeleton height={32} radius="sm" />
            <Skeleton height={32} radius="sm" />
            <Skeleton height={32} radius="sm" />
            <Skeleton height={32} radius="sm" />
          </Group>
        ))}
      </Stack>
    );
  }

  if (type === "card") {
    return (
      <Group grow>
        {Array.from({ length: count }).map((_, i) => (
          <Paper key={i} p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Skeleton height={20} width="60%" radius="sm" />
              <Skeleton height={14} radius="sm" />
              <Skeleton height={14} width="80%" radius="sm" />
            </Stack>
          </Paper>
        ))}
      </Group>
    );
  }

  if (type === "stats") {
    return (
      <Group grow>
        {Array.from({ length: count }).map((_, i) => (
          <Paper key={i} p="md" radius="md" withBorder>
            <Stack gap="xs" align="center">
              <Skeleton height={12} width="50%" radius="sm" />
              <Skeleton height={28} width="40%" radius="sm" />
            </Stack>
          </Paper>
        ))}
      </Group>
    );
  }

  return (
    <Stack gap="xs">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? "60%" : "100%"}
          radius="sm"
        />
      ))}
    </Stack>
  );
}
