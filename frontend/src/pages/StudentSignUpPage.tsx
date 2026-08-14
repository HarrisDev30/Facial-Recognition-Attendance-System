import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Container,
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Text,
  Anchor,
  Progress,
  Stack,
  Box,
  Select,
} from "@mantine/core";
import { registerStudent } from "../api/auth";
import { getDepartments } from "../api/departments";
import { useFormSubmit } from "../hooks";
import { getApiError } from "../utils/error";
import { notifications } from "@mantine/notifications";
import type { DepartmentResponse } from "../types/auth";

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (/[a-z]/.test(password)) score += 25;
  if (/[A-Z]/.test(password)) score += 25;
  if (/\d/.test(password)) score += 25;
  return score;
}

function getStrengthColor(score: number) {
  if (score < 50) return "red";
  if (score < 75) return "orange";
  return "teal";
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StudentSignUpPage() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const [form, setForm] = useState({
    email: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
    identifier: "",
    department_id: "",
  });
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getDepartments()
      .then((res) => setDepartments(res.items))
      .catch((err) => {
        notifications.show({
          title: "Error",
          message: getApiError(err) || "Failed to load departments",
          color: "red",
        });
      });
  }, []);
  const { submit: doRegister, submitting, error: apiError } = useFormSubmit(
    registerStudent,
    {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => {
          if (mountedRef.current) navigate("/login");
        }, 2000);
      },
      successMessage: "Registration successful!",
      showErrorNotification: false,
    },
  );
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value;
    setForm((prev) => ({ ...prev, [field]: val }));
    if (field === "email") {
      if (val && !EMAIL_REGEX.test(val)) {
        setEmailError("Invalid email format");
      } else {
        setEmailError(null);
      }
    }
  };

  const handleSelectChange = (field: string) => (val: string | null) => {
    setForm((prev) => ({ ...prev, [field]: val || "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.password_confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!EMAIL_REGEX.test(form.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (getPasswordStrength(form.password) < 50) {
      setError("Password is too weak. Use at least 8 characters with mixed case and numbers.");
      return;
    }

    await doRegister({
      email: form.email,
      password: form.password,
      password_confirm: form.password_confirm,
      first_name: form.first_name,
      last_name: form.last_name,
      identifier: form.identifier || undefined,
      department_id: form.department_id,
    });
  };

  const pwScore = getPasswordStrength(form.password);

  if (success) {
    return (
      <Box mih="100vh">
        <Container size="xs" py="xl">
          <Paper radius="lg" p="xl" ta="center">
            <Title order={3} c="teal">
              Registration Successful!
            </Title>
            <Text mt="md" c="dimmed">Redirecting to login...</Text>
          </Paper>
        </Container>
      </Box>
    );
  }

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
            Create your account
          </Text>
        </Stack>

        <Paper
          radius="lg"
          p="xl"
        >
          <form onSubmit={handleSubmit}>
            <TextInput
              label="Email"
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              error={emailError}
              required
              mb="sm"
            />
            <PasswordInput
              label="Password"
              value={form.password}
              onChange={handleChange("password")}
              required
              mb="xs"
            />
            {form.password && (
              <Progress
                value={pwScore}
                color={getStrengthColor(pwScore)}
                size="xs"
                mb="sm"
              />
            )}
            <PasswordInput
              label="Confirm Password"
              value={form.password_confirm}
              onChange={handleChange("password_confirm")}
              required
              mb="sm"
            />
            <TextInput
              label="First Name"
              value={form.first_name}
              onChange={handleChange("first_name")}
              required
              mb="sm"
            />
            <TextInput
              label="Last Name"
              value={form.last_name}
              onChange={handleChange("last_name")}
              required
              mb="sm"
            />
            <TextInput
              label="Student ID (optional)"
              value={form.identifier}
              onChange={handleChange("identifier")}
              mb="sm"
            />
            <Select
              label="Department"
              value={form.department_id || null}
              onChange={handleSelectChange("department_id")}
              data={departments.map((d) => ({ value: d.id, label: d.name }))}
              required
              searchable
              mb="md"
            />
            {(error || apiError) && (
              <Alert color="red" mb="md">
                {error || apiError}
              </Alert>
            )}
            <Button type="submit" fullWidth loading={submitting}>
              Create Account
            </Button>
          </form>

          <Text ta="center" mt="md" size="sm" c="dimmed">
            Already have an account?{" "}
            <Anchor component={Link} to="/login">
              Sign in
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}
