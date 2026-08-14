import type { ReactNode } from "react";
import { Group, Title, Text, Breadcrumbs, Anchor } from "@mantine/core";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
}

export default function PageHeader({ title, subtitle, children, breadcrumbs }: PageHeaderProps) {
  return (
    <Group justify="space-between" mb="lg" wrap="wrap">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs mb="xs">
            {breadcrumbs.map((crumb, i) =>
              crumb.to && i < breadcrumbs.length - 1 ? (
                <Anchor
                  component={Link}
                  to={crumb.to}
                  size="sm"
                  key={crumb.label}
                >
                  {crumb.label}
                </Anchor>
              ) : (
                <Text size="sm" c="dimmed" key={crumb.label}>
                  {crumb.label}
                </Text>
              ),
            )}
          </Breadcrumbs>
        )}
        <Title order={2}>{title}</Title>
        {subtitle && (
          <Text component="p" size="md" mt="xs" c="dimmed">
            {subtitle}
          </Text>
        )}
      </div>
      {children && <Group gap="sm">{children}</Group>}
    </Group>
  );
}
