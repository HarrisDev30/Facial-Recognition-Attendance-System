import React, { useState } from "react";
import {
  Modal,
  TextInput,
  Select,
  Textarea,
  Button,
  Stack,
  Text,
  Group,
  Alert,
  Paper,
  Badge,
  SimpleGrid,
} from "@mantine/core";
import {
  IconCheck,
  IconShieldCheck,
  IconArrowRight,
} from "@tabler/icons-react";

interface CampusOnboardingModalProps {
  opened: boolean;
  onClose: () => void;
}

export const CampusOnboardingModal: React.FC<CampusOnboardingModalProps> = ({ opened, onClose }) => {
  const [institutionName, setInstitutionName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | null>("Dean / Academic Administrator");
  const [campusSize, setCampusSize] = useState<string | null>("2,000 - 10,000 students");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const resetForm = () => {
    setInstitutionName("");
    setContactName("");
    setEmail("");
    setRole("Dean / Academic Administrator");
    setCampusSize("2,000 - 10,000 students");
    setNotes("");
    setSubmitted(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate enterprise lead submission
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      zIndex={2000}
      yOffset="3vh"
      xOffset="12px"
      title={
        <div>
          <Text fw={700} size="md" c="#171717" style={{ letterSpacing: "-0.02em" }}>
            Request Institutional Access
          </Text>
          <Text size="xs" c="#666666">
            Attendify Enterprise Campus Deployment
          </Text>
        </div>
      }
      centered
      size="lg"
      radius="md"
      overlayProps={{ backgroundOpacity: 0.6, blur: 8 }}
      styles={{
        header: {
          borderBottom: "1px solid #ebebeb",
          padding: "16px 20px",
          backgroundColor: "#ffffff",
          color: "#171717",
          flexShrink: 0,
        },
        content: {
          backgroundColor: "#ffffff",
          color: "#171717",
          border: "1px solid #ebebeb",
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.2)",
          borderRadius: "16px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
        body: {
          padding: "16px 20px 20px",
          backgroundColor: "#ffffff",
          color: "#171717",
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        },
        close: {
          color: "#171717",
          "&:hover": {
            backgroundColor: "#f5f5f5",
          },
        },
      }}
    >
      <div style={{ color: "#171717", fontFamily: "Geist, Inter, -apple-system, sans-serif" }}>
        {submitted ? (
          <Stack gap="md" py="xs">
            <Alert
              color="green"
              icon={<IconCheck size={20} />}
              title="Request Successfully Received"
              radius="md"
              styles={{
                root: {
                  backgroundColor: "rgba(34, 197, 94, 0.08)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                },
                title: { fontWeight: 600, color: "#15803d" },
                message: { color: "#166534" },
              }}
            >
              <Text size="sm" mb="xs" c="#166534">
                Thank you, <strong>{contactName || "Representative"}</strong>. Your deployment request for{" "}
                <strong>{institutionName}</strong> has been logged.
              </Text>
              <Text size="xs" c="#4d4d4d">
                Our campus deployment team will reach out to <strong>{email}</strong> within 24 hours with your isolated sandbox credentials.
              </Text>
            </Alert>

            <Paper p="sm" withBorder radius="md" bg="#fafafa" style={{ borderColor: "#ebebeb" }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <IconShieldCheck size={18} color="#0070f3" style={{ flexShrink: 0 }} />
                  <Text size="xs" fw={600} c="#171717">
                    Next Step: Campus Partition Setup
                  </Text>
                </Group>
                <Badge size="xs" variant="light" color="blue">
                  SLA: 24h
                </Badge>
              </Group>
              <Text size="xs" c="#666666" mt={6}>
                We will initialize an isolated FAISS biometric vector index for {institutionName}.
              </Text>
            </Paper>

            <Group justify="flex-end" mt="xs">
              <Button
                variant="default"
                size="sm"
                onClick={handleClose}
                style={{
                  backgroundColor: "#ffffff",
                  color: "#171717",
                  borderColor: "#d4d4d4",
                  borderRadius: "8px",
                }}
              >
                Close
              </Button>
            </Group>
          </Stack>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <Text size="xs" c="#666666">
                Deploy automated biometric attendance across your university gates, convocations, and student organizations.
              </Text>

              <TextInput
                label="University / Institution Name"
                placeholder="e.g. Ateneo de Davao University"
                required
                size="sm"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                styles={{
                  input: {
                    backgroundColor: "#fafafa",
                    borderColor: "#e5e5e5",
                    color: "#171717",
                    borderRadius: "8px",
                    fontSize: "14px",
                  },
                  label: {
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#171717",
                    marginBottom: "4px",
                  },
                }}
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Representative Name"
                  placeholder="Dr. Maria Santos"
                  required
                  size="sm"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  styles={{
                    input: {
                      backgroundColor: "#fafafa",
                      borderColor: "#e5e5e5",
                      color: "#171717",
                      borderRadius: "8px",
                      fontSize: "14px",
                    },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#171717",
                      marginBottom: "4px",
                    },
                  }}
                />

                <TextInput
                  label="Official Institutional Email"
                  placeholder="m.santos@addu.edu.ph"
                  required
                  type="email"
                  size="sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  styles={{
                    input: {
                      backgroundColor: "#fafafa",
                      borderColor: "#e5e5e5",
                      color: "#171717",
                      borderRadius: "8px",
                      fontSize: "14px",
                    },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#171717",
                      marginBottom: "4px",
                    },
                  }}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Select
                  label="Role / Department"
                  data={[
                    "Dean / Academic Administrator",
                    "IT & Systems Director",
                    "Office of Student Affairs (OSA)",
                    "University Registrar",
                    "Campus Security / Marshals",
                    "Student Organization Head",
                  ]}
                  value={role}
                  onChange={setRole}
                  size="sm"
                  allowDeselect={false}
                  comboboxProps={{ zIndex: 2100 }}
                  styles={{
                    input: {
                      backgroundColor: "#fafafa",
                      borderColor: "#e5e5e5",
                      color: "#171717",
                      borderRadius: "8px",
                      fontSize: "14px",
                    },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#171717",
                      marginBottom: "4px",
                    },
                  }}
                />

                <Select
                  label="Estimated Student Population"
                  data={[
                    "< 2,000 students",
                    "2,000 - 10,000 students",
                    "10,000 - 30,000 students",
                    "30,000+ students",
                  ]}
                  value={campusSize}
                  onChange={setCampusSize}
                  size="sm"
                  allowDeselect={false}
                  comboboxProps={{ zIndex: 2100 }}
                  styles={{
                    input: {
                      backgroundColor: "#fafafa",
                      borderColor: "#e5e5e5",
                      color: "#171717",
                      borderRadius: "8px",
                      fontSize: "14px",
                    },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#171717",
                      marginBottom: "4px",
                    },
                  }}
                />
              </SimpleGrid>

              <Textarea
                label="Specific Event or Campus Requirements (Optional)"
                placeholder="e.g. Biometric attendance for our 5,000-seat university gym and departmental convocations..."
                rows={3}
                size="sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                styles={{
                  input: {
                    backgroundColor: "#fafafa",
                    borderColor: "#e5e5e5",
                    color: "#171717",
                    borderRadius: "8px",
                    fontSize: "14px",
                  },
                  label: {
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#171717",
                    marginBottom: "4px",
                  },
                }}
              />

              <Group
                justify="space-between"
                mt="sm"
                pt="xs"
                style={{ borderTop: "1px solid #ebebeb" }}
                wrap="wrap"
                gap="xs"
              >
                <Text size="xs" c="#888888">
                  Compliant with Philippine RA 10173 (DPA).
                </Text>
                <Group gap="xs">
                  <Button
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={handleClose}
                    style={{
                      color: "#666666",
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={loading}
                    size="sm"
                    rightSection={<IconArrowRight size={14} />}
                    style={{
                      backgroundColor: "#171717",
                      color: "#ffffff",
                      borderRadius: "8px",
                      fontWeight: 600,
                    }}
                  >
                    Submit Request
                  </Button>
                </Group>
              </Group>
            </Stack>
          </form>
        )}
      </div>
    </Modal>
  );
};
