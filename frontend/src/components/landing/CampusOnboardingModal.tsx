import React, { useState } from "react";
import { Modal, TextInput, Button, Stack, Text, Group, Alert } from "@mantine/core";
import { IconBuildingArch, IconMail, IconArrowRight, IconSparkles, IconCheck } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

interface CampusOnboardingModalProps {
  opened: boolean;
  onClose: () => void;
}

export const CampusOnboardingModal: React.FC<CampusOnboardingModalProps> = ({ opened, onClose }) => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSlugAutoFill = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 8);
      setSlug(generated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate instant workspace provisioning
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/${slug || "cjc"}`);
      }, 1200);
    }, 900);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSparkles size={20} color="#3b82f6" />
          <Text fw={700} size="md">
            Onboard Your University Workspace
          </Text>
        </Group>
      }
      centered
      radius="md"
      overlayProps={{ backgroundOpacity: 0.65, blur: 8 }}
      styles={{
        header: { backgroundColor: "#171717", borderBottom: "1px solid #262626", color: "#ffffff" },
        content: { backgroundColor: "#171717", color: "#ffffff", border: "1px solid #262626" },
      }}
    >
      {success ? (
        <Alert color="green" icon={<IconCheck size={20} />} title="Campus Workspace Initialized!">
          <Text size="sm">
            Redirecting to your new isolated campus portal at <code style={{ color: "#2563eb" }}>attendify.edu/{slug}</code>...
          </Text>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Provision a dedicated biometric attendance partition for your university or academic institution in seconds.
            </Text>

            <TextInput
              label="University / Institution Name"
              placeholder="e.g. Ateneo de Davao University"
              required
              value={name}
              onChange={(e) => handleSlugAutoFill(e.target.value)}
              leftSection={<IconBuildingArch size={16} />}
            />

            <TextInput
              label="Campus URL Code / Slug"
              description="Used for your students' custom direct link"
              placeholder="e.g. addu"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              rightSection={
                <Text size="xs" c="dimmed" pr="xs">
                  .attendify
                </Text>
              }
            />

            <TextInput
              label="Coordinator / Admin Email"
              placeholder="admin@university.edu.ph"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftSection={<IconMail size={16} />}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" color="gray" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                variant="gradient"
                gradient={{ from: "blue", to: "teal", deg: 105 }}
                rightSection={<IconArrowRight size={16} />}
              >
                Launch Campus Portal
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
};
