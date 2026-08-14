import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import {
  Container,
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Text,
  Anchor,
  Stack,
  Box,
} from "@mantine/core";
import { useAuthStore } from "../store/authStore";
import { useFormSubmit } from "../hooks";
import { roleHome } from "../utils/routes";

export default function StudentLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { token, user, login } = useAuthStore();
  const navigate = useNavigate();

  const { submit: doLogin, submitting, error } = useFormSubmit(
    async ({ email, password }: { email: string; password: string }) => {
      await login(email, password);
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        const home = roleHome(currentUser.role);
        navigate(home, { replace: true });
      }
    },
    {
      showSuccessNotification: false,
    },
  );

  if (token && user) {
    const home = roleHome(user.role);
    if (home !== "/login") {
      return <Navigate to={home} replace />;
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin({ email, password });
  };

  return (
    <Box mih="100vh">
      <Container size="xs" py="xl">
        <Stack ta="center" mb="xl" gap={0}>
          <Text
            fw={600}
            size="xl"
            style={{ letterSpacing: "-0.6px" }}
            c="var(--text-primary)"
          >
            Attendance
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            Sign in to your account
          </Text>
        </Stack>

        <Paper
          radius="lg"
          p="xl"
        >
          <form onSubmit={handleSubmit}>
            <TextInput
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              mb="sm"
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              mb="md"
            />
            {error && (
              <Alert color="red" mb="md">
                {error}
              </Alert>
            )}
            <Button type="submit" fullWidth loading={submitting}>
              Sign In
            </Button>
          </form>

          <Text ta="center" mt="md" size="sm" c="dimmed">
            Don't have an account?{" "}
            <Anchor component={Link} to="/register" fw={600} td="underline">
              Sign up
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}
