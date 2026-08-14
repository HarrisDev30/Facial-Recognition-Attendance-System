import { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  PasswordInput,
  Stack,
  Group,
  Button,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconX } from "@tabler/icons-react";
import { register } from "../../api/auth";
import { getApiError } from "../../utils/error";

interface MarshalCreateModalProps {
  opened: boolean;
  onClose: () => void;
}

function MarshalCreateModal({
  opened,
  onClose,
}: MarshalCreateModalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      setEmail("");
      setFirstName("");
      setLastName("");
      setPassword("");
      setConfirmPassword("");
    }
  }, [opened]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      notifications.show({
        title: "Passwords do not match",
        message: "Please make sure both passwords match.",
        color: "red",
        icon: <IconX size={16} />,
      });
      return;
    }
    setLoading(true);
    try {
      await register({
        email,
        password,
        role: "marshal",
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });
      notifications.show({
        title: "Marshal created",
        message: `Account created for ${email}. Share credentials with the marshal.`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
      onClose();
    } catch (err) {
      notifications.show({
        title: "Failed to create marshal",
        message: getApiError(err),
        color: "red",
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Marshal Account"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            maxLength={255}
          />
          <TextInput
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.currentTarget.value)}
            maxLength={100}
          />
          <TextInput
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.currentTarget.value)}
            maxLength={100}
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            minLength={8}
          />
          <PasswordInput
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            required
            minLength={8}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} color="orange">
              Create Marshal
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default MarshalCreateModal;
