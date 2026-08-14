import type { ReactNode } from "react";
import { Paper, Text, ThemeIcon } from "@mantine/core";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Paper p="3xl" ta="center" radius="lg" bg="var(--surface-1)" withBorder>
      {icon && (
        <ThemeIcon size={48} radius="xl" variant="light" mb="md" mx="auto" color="gray">
          {icon}
        </ThemeIcon>
      )}
      <Text size="lg" fw={500} c="dimmed">
        {title}
      </Text>
      {description && (
        <Text size="sm" c="dimmed" mt="xs">
          {description}
        </Text>
      )}
      {action && <div style={{ marginTop: "16px" }}>{action}</div>}
    </Paper>
  );
}
