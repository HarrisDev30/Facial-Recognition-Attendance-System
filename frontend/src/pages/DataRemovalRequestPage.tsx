import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFormSubmit } from "../hooks";
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Alert,
  Group,
  Checkbox,
  Stack,
  Textarea,
  LoadingOverlay,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { requestDataRemoval } from "../api/attendees";
import PageHeader from "../components/layout/PageHeader";

export default function DataRemovalRequestPage() {
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [understandEmbeddings, setUnderstandEmbeddings] = useState(false);
  const [understandRecords, setUnderstandRecords] = useState(false);
  const [wantProceed, setWantProceed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { submit: doSubmit, submitting } = useFormSubmit(
    (_unused: void) => requestDataRemoval(reason || undefined),
    {
      onSuccess: () => {
        setSubmitted(true);
      },
      successMessage: "Your facial data has been deleted successfully.",
    },
  );

  const canSubmit = understandEmbeddings && understandRecords && wantProceed && !submitting;

  const handleSubmit = () => {
    doSubmit(undefined);
  };

  if (submitted) {
    return (
      <Container size="md" pt={0} pb="4xl">
        <Paper p="lg" radius="md" ta="center">
          <Title order={3} mb="md">Data Deleted</Title>
          <Text c="dimmed" mb="lg">
            Your facial embeddings have been permanently deleted.
            Attendance records are retained for institutional compliance.
          </Text>
          <Button onClick={() => navigate("/profile")}>
            Back to Profile
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="md" pt={0} pb="4xl">
      <LoadingOverlay visible={submitting} />

      <PageHeader title="Delete My Data" />

      <Alert
        color="red"
        icon={<IconAlertTriangle size={16} />}
        mb="md"
      >
        <strong>Warning:</strong> This action is permanent. Once your data
        is deleted, it cannot be recovered.
      </Alert>

      <Paper p="lg" radius="md">
        <Stack>
          <Text size="sm" c="dimmed">
            Delete your facial biometric data from the system. Please note:
          </Text>

          <Text size="sm" component="ul" c="dimmed">
            <li>Your facial embeddings will be permanently deleted</li>
            <li>Attendance records will be kept for institutional compliance</li>
            <li>You will need to re-register if you wish to use the system again</li>
          </Text>

          <Textarea
            label="Reason for removal (optional)"
            placeholder="Tell us why you want your data removed..."
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            minRows={3}
          />

          <Checkbox
            label="I understand that my facial embeddings will be permanently deleted"
            checked={understandEmbeddings}
            onChange={(e) => setUnderstandEmbeddings(e.currentTarget.checked)}
          />
          <Checkbox
            label="I understand that attendance records will be retained for institutional compliance"
            checked={understandRecords}
            onChange={(e) => setUnderstandRecords(e.currentTarget.checked)}
          />
          <Checkbox
            label="I want to proceed with the data removal request"
            checked={wantProceed}
            onChange={(e) => setWantProceed(e.currentTarget.checked)}
          />

          <Group mt="md">
            <Button
              color="red"
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
            >
              Delete My Data
            </Button>
            <Button
              onClick={() => navigate("/profile")}
              disabled={submitting}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}
