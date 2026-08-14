import { useState } from "react";
import { Modal, Stack, Text, Divider, Checkbox, Group, Button } from "@mantine/core";

interface ConsentFormProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (consentChecked: boolean, privacyChecked: boolean) => void;
  loading?: boolean;
}

export default function ConsentForm({ opened, onClose, onConfirm, loading }: ConsentFormProps) {
  const [consentChecked, setConsentChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [raChecked, setRaChecked] = useState(false);

  const handleConfirm = () => {
    onConfirm(consentChecked, privacyChecked);
  };

  const handleClose = () => {
    setConsentChecked(false);
    setPrivacyChecked(false);
    setRaChecked(false);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Biometric Data Consent Form"
      size="lg"
    >
      <Stack>
        <Text size="sm">
          In compliance with the Data Privacy Act (RA 10173), we require your
          consent to collect and process your facial biometric data for
          attendance monitoring purposes.
        </Text>

        <Divider label="Purpose" />
        <Text size="sm">
          Your facial data will be used exclusively for identity verification
          during institutional events. This replaces traditional manual
          attendance checking.
        </Text>

        <Divider label="Collection" />
        <Text size="sm">
          <strong>What will be collected:</strong> Facial embeddings
          (mathematical representations derived from facial images).
          Raw images are <strong>never</strong> stored.
        </Text>

        <Divider label="Usage" />
        <Text size="sm">
          <strong>Purpose:</strong> Attendance verification only.
          Data will not be used for surveillance, tracking, or any
          purpose beyond attendance monitoring.
        </Text>

        <Divider label="Protection" />
        <Text size="sm">
          All data is encrypted in transit (HTTPS) and at rest.
          Access is restricted to authorized personnel only.
        </Text>

        <Divider label="Retention" />
        <Text size="sm">
          Data will be retained for 1 year after graduation or until
          you request removal, whichever comes first.
        </Text>

        <Divider label="Rights" />
        <Text size="sm">
          You have the right to access, correct, or delete your data,
          withdraw consent at any time, and file a complaint with the
          National Privacy Commission.
        </Text>

        <Divider />

        <Checkbox
          label="I consent to the collection and processing of my facial biometric data for attendance purposes"
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.currentTarget.checked)}
        />
        <Checkbox
          label="I acknowledge the data privacy policy and understand how my data will be used, stored, and protected"
          checked={privacyChecked}
          onChange={(e) => setPrivacyChecked(e.currentTarget.checked)}
        />
        <Checkbox
          label="I understand my rights under the Data Privacy Act of 2012 (RA 10173)"
          checked={raChecked}
          onChange={(e) => setRaChecked(e.currentTarget.checked)}
        />

        <Group mt="md">
          <Button
            onClick={handleConfirm}
            disabled={!consentChecked || !privacyChecked || !raChecked}
            loading={loading}
          >
            I Accept
          </Button>
          <Button variant="default" onClick={handleClose}>
            I Decline
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
