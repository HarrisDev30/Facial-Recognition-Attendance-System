import { Modal, Text, Group, Button, Stack } from "@mantine/core";

interface ConfirmDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  color?: string;
  loading?: boolean;
}

export default function ConfirmDialog({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  color = "red",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="sm"
      centered
      radius="lg"
      overlayProps={{
        backgroundOpacity: 0.45,
        blur: 4,
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="var(--text-secondary)" lh={1.5}>
          {message}
        </Text>
        <Group justify="flex-end" gap="xs" mt="xs">
          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            disabled={loading}
            style={{
              borderRadius: "8px",
              fontWeight: 500,
              color: "var(--text-primary)",
              borderColor: "var(--border-subtle)",
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            color={color}
            size="sm"
            onClick={onConfirm}
            loading={loading}
            style={{
              borderRadius: "8px",
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
