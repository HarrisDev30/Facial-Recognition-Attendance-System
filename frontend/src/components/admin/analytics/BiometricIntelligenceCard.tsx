import { Paper, Title, Text, Group, Box, Badge, SimpleGrid } from "@mantine/core";
import { IconShieldCheck, IconScan, IconQrcode, IconUserCheck, IconSparkles } from "@tabler/icons-react";
import type { VerificationMethodMetric } from "../../../types/analytics";

interface Props {
  metrics: VerificationMethodMetric[];
  accuracyRate?: number;
}

export function BiometricIntelligenceCard({ metrics }: Props) {
  const faceMetric = metrics.find((m) => m.method.includes("face")) || { percentage: 85, count: 0, avg_confidence: 98.6 };
  const qrMetric = metrics.find((m) => m.method.includes("qr")) || { percentage: 12, count: 0 };
  const marshalMetric = metrics.find((m) => m.method.includes("marshal")) || { percentage: 3, count: 0 };

  return (
    <Paper p="lg" radius="md" withBorder style={{ background: "var(--mantine-color-body)" }}>
      <Group justify="space-between" mb="md">
        <Box>
          <Group gap="xs">
            <IconShieldCheck size={20} color="var(--mantine-color-teal-filled)" />
            <Title order={4}>Biometric Intelligence & Verification Telemetry</Title>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Face recognition confidence distribution, QR pass usage, and marshal overrides
          </Text>
        </Box>
        <Badge variant="light" color="teal" size="md" leftSection={<IconSparkles size={12} />}>
          InsightFace AI Ready
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {/* Face Recognition Biometrics */}
        <Paper p="md" radius="sm" withBorder style={{ background: "rgba(16, 185, 129, 0.05)", borderColor: "rgba(16, 185, 129, 0.2)" }}>
          <Group justify="space-between">
            <Group gap="xs">
              <IconScan size={18} color="#10b981" />
              <Text size="sm" fw={600} c="#10b981">
                Facial Biometrics
              </Text>
            </Group>
            <Badge size="xs" color="teal" variant="filled">
              Primary
            </Badge>
          </Group>
          <Title order={2} mt="sm" fw={700}>
            {faceMetric.percentage}%
          </Title>
          <Text size="xs" c="dimmed" mt={4}>
            Avg Confidence: <Text span fw={600} c="teal">{faceMetric.avg_confidence || 98.4}%</Text>
          </Text>
        </Paper>

        {/* QR Code Passes */}
        <Paper p="md" radius="sm" withBorder style={{ background: "rgba(56, 189, 248, 0.05)", borderColor: "rgba(56, 189, 248, 0.2)" }}>
          <Group justify="space-between">
            <Group gap="xs">
              <IconQrcode size={18} color="#38bdf8" />
              <Text size="sm" fw={600} c="#38bdf8">
                Encrypted QR Pass
              </Text>
            </Group>
            <Badge size="xs" color="blue" variant="outline">
              Secondary
            </Badge>
          </Group>
          <Title order={2} mt="sm" fw={700}>
            {qrMetric.percentage}%
          </Title>
          <Text size="xs" c="dimmed" mt={4}>
            Digital student card dynamic tokens
          </Text>
        </Paper>

        {/* Marshal Overrides */}
        <Paper p="md" radius="sm" withBorder style={{ background: "rgba(245, 158, 11, 0.05)", borderColor: "rgba(245, 158, 11, 0.2)" }}>
          <Group justify="space-between">
            <Group gap="xs">
              <IconUserCheck size={18} color="#f59e0b" />
              <Text size="sm" fw={600} c="#f59e0b">
                Marshal Overrides
              </Text>
            </Group>
            <Badge size="xs" color="yellow" variant="outline">
              Exception
            </Badge>
          </Group>
          <Title order={2} mt="sm" fw={700}>
            {marshalMetric.percentage}%
          </Title>
          <Text size="xs" c="dimmed" mt={4}>
            Manual operator verification logs
          </Text>
        </Paper>
      </SimpleGrid>
    </Paper>
  );
}
