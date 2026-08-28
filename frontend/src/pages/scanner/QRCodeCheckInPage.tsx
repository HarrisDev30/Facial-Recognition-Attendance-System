import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Title,
  Text,
  Paper,
  TextInput,
  Button,
  Group,
  Alert,
  Stack,
  ActionIcon,
} from "@mantine/core";
import { IconArrowLeft, IconQrcode, IconCheck, IconX } from "@tabler/icons-react";
import { qrCheckIn } from "../../api/scanner";
import { useFormSubmit } from "../../hooks";

export default function QRCodeCheckInPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [attendeeId, setAttendeeId] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    attendee_name?: string;
  } | null>(null);

  const { submit, submitting, error } = useFormSubmit(
    (id: string) => qrCheckIn(sessionId!, id),
    {
      onSuccess: (res: any) => setResult(res),
      showSuccessNotification: false,
      showErrorNotification: false,
    },
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendeeId.trim() || !sessionId) return;
    await submit(attendeeId.trim());
  };

  const handleReset = () => {
    setAttendeeId("");
    setResult(null);
  };

  return (
    <Container size="sm" px="md" py="md">
      {/* Header with back button */}
      <Group mb="lg">
        <ActionIcon variant="subtle" onClick={() => navigate(-1)}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={4}>Manual ID Entry</Title>
      </Group>

      {result ? (
        <Paper p="xl" radius="md" ta="center">
          {result.success ? (
            <>
              <IconCheck size={64} color="green" />
              <Title order={3} c="teal" mt="md">
                Check-in Successful!
              </Title>
              {result.attendee_name && (
                <Text size="lg" fw={500} mt="sm">
                  Welcome, {result.attendee_name}
                </Text>
              )}
              <Text c="dimmed" mt="xs">
                {result.message}
              </Text>
              <Button mt="xl" onClick={handleReset}>
                Check In Another Student
              </Button>
              <Button
                variant="default"
                mt="sm"
                fullWidth
                onClick={() => navigate(-1)}
              >
                Back to Scanner
              </Button>
            </>
          ) : (
            <>
              <IconX size={64} color="red" />
              <Title order={3} c="red" mt="md">
                Check-in Failed
              </Title>
              <Text c="dimmed" mt="sm">
                {result.message}
              </Text>
              <Button mt="xl" onClick={handleReset}>
                Try Again
              </Button>
              <Button
                variant="default"
                mt="sm"
                fullWidth
                onClick={() => navigate(-1)}
              >
                Back to Scanner
              </Button>
            </>
          )}
        </Paper>
      ) : (
        <Paper p="xl" radius="md">
          <Stack>
            <Group mb="md">
              <IconQrcode size={32} />
              <div>
                <Text fw={500}>Manual Attendee ID Entry</Text>
                <Text size="sm" c="dimmed">
                  Enter the attendee's ID number to check them in.
                </Text>
              </div>
            </Group>

            <form onSubmit={handleSubmit}>
              <TextInput
                label="Attendee ID"
                placeholder="e.g. 2024-0001"
                value={attendeeId}
                onChange={(e) => setAttendeeId(e.currentTarget.value)}
                required
                size="lg"
                mb="md"
                autoFocus
              />

              {error && (
                <Alert color="red" mb="md">
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={submitting}
                disabled={!attendeeId.trim()}
              >
                Check In
              </Button>
            </form>
          </Stack>
        </Paper>
      )}
    </Container>
  );
}
