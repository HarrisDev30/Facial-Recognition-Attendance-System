import type { ReactNode } from "react";
import { Paper, Text, Group } from "@mantine/core";

interface SectionCardProps {
  title?: string;
  children: ReactNode;
  mb?: string;
  action?: ReactNode;
}

export default function SectionCard({ title, children, mb, action }: SectionCardProps) {
  return (
    <Paper p="lg" radius="md" mb={mb ?? "lg"}>
      {(title || action) && (
        <Group justify="space-between" mb="sm">
          {title && (
            <Text component="h3" fw={600} size="lg">
              {title}
            </Text>
          )}
          {action}
        </Group>
      )}
      {children}
    </Paper>
  );
}
