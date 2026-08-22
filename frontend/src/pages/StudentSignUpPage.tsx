import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link, useParams, useSearchParams, useLocation, Navigate } from "react-router-dom";
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
  Box,
  Select,
  Badge,
  Group,
  Avatar,
} from "@mantine/core";
import { IconBuildingArch, IconArrowLeft, IconAlertCircle } from "@tabler/icons-react";
import { registerStudent } from "../api/auth";
import { getDepartments } from "../api/departments";
import { getInstitutionBySlug, getInstitutions } from "../api/institutions";
import { useFormSubmit } from "../hooks";
import { useAuthStore } from "../store/authStore";
import { getTenantSlugFromHostname, isReservedSlug } from "../utils/tenant";
import type { DepartmentResponse, TokenResponse } from "../types/auth";
import type { InstitutionPublicResponse } from "../types/institution";

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
  const location = useLocation();
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 1. Resolve Campus Slug from Route /:slug/register, Subdomain, query param, or state
  const rawSlug =
    params.slug ||
    getTenantSlugFromHostname() ||
    searchParams.get("campus") ||
    searchParams.get("institution") ||
    (location.state as any)?.institution_code ||
    "";

  const campusSlug = rawSlug && !isReservedSlug(rawSlug) ? rawSlug.toLowerCase() : "";

  const [institutionList, setInstitutionList] = useState<InstitutionPublicResponse[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [institution, setInstitution] = useState<InstitutionPublicResponse | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [loadingInst, setLoadingInst] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
    identifier: "",
    department_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 2. Fetch locked institution information OR list of institutions
  useEffect(() => {
    let active = true;
    if (campusSlug) {
      setLoadingInst(true);
      getInstitutionBySlug(campusSlug)
        .then((inst) => {
          if (!active) return;
          setInstitution(inst);
        })
        .catch((err) => console.error("Failed to load campus", err))
        .finally(() => {
          if (active) setLoadingInst(false);
        });
    } else {
      setLoadingInst(true);
      getInstitutions(true)
        .then((list) => {
          if (!active) return;
          setInstitutionList(list);
          if (list.length > 0) {
            setInstitution(list[0]);
            setSelectedInstId(list[0].id);
          }
        })
        .catch((err) => console.error("Failed to list institutions", err))
        .finally(() => {
          if (active) setLoadingInst(false);
        });
    }
    return () => {
      active = false;
    };
  }, [campusSlug]);

  // 3. Fetch academic college departments strictly filtered for selected institution
  useEffect(() => {
    let active = true;
    const targetSlug = campusSlug;
    const targetId = !campusSlug ? selectedInstId : undefined;

    if (!targetSlug && !targetId) {
      setLoadingDepts(false);
      return;
    }

    setLoadingDepts(true);
    const filterParam = targetSlug
      ? { institution_slug: targetSlug, org_type: "college" }
      : { institution_id: targetId, org_type: "college" };

    getDepartments(filterParam)
      .then((res) => {
        if (!active) return;
        const items = res.items || [];
        setDepartments(items);
        if (items.length > 0) {
          setForm((prev) => ({
            ...prev,
            department_id: prev.department_id || items[0].id,
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            department_id: "",
          }));
        }
      })
      .catch((err) => {
        console.error("Failed to load departments", err);
        if (active) setDepartments([]);
      })
      .finally(() => {
        if (active) setLoadingDepts(false);
      });

    return () => {
      active = false;
    };
  }, [campusSlug, selectedInstId]);

  const instOptions = useMemo(() => {
    return institutionList.map((i) => ({
      value: i.id,
      label: i.name,
    }));
  }, [institutionList]);

  const deptOptions = useMemo(() => {
    return departments.map((d) => ({
      value: d.id,
      label: d.code ? `${d.name} (${d.code})` : d.name,
    }));
  }, [departments]);

  const { submit: doRegister, submitting, error: apiError } = useFormSubmit(
    registerStudent,
    {
      onSuccess: (res: TokenResponse) => {
        setSuccess(true);
        if (res && res.access_token) {
          localStorage.setItem("token", res.access_token);
          useAuthStore.setState({ token: res.access_token, user: res.user, loading: false });
          setTimeout(() => {
            if (mountedRef.current) navigate("/register-biometrics");
          }, 1200);
        } else {
          setTimeout(() => {
            if (mountedRef.current) navigate(campusSlug ? `/${campusSlug}` : "/login");
          }, 1500);
        }
      },
      successMessage: "Registration successful! Redirecting to biometric enrollment...",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.department_id) {
      setError("Please select your department or college program.");
      return;
    }
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

  // If accessed directly without a campus slug, redirect to landing page to pick university
  if (!campusSlug && !loadingInst) {
    return <Navigate to="/" replace />;
  }

  const pwScore = getPasswordStrength(form.password);

  if (success) {
    return (
      <Box mih="100vh">
        <Container size="xs" py="xl">
          <Paper radius="lg" p="xl" ta="center">
            <Title order={3} c="teal">
              Registration Successful!
            </Title>
            <Text mt="md" c="dimmed">Redirecting to biometric enrollment...</Text>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box mih="100vh" py="xl">
      <Container size="xs">
        {/* Back to Campus Portal Link */}
        <Group mb="md">
          <Anchor
            component={Link}
            to={`/${campusSlug}`}
            size="sm"
            c="dimmed"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <IconArrowLeft size={16} /> Back to {institution?.name || campusSlug.toUpperCase()} Portal
          </Anchor>
        </Group>

        {/* Dedicated University Header Banner */}
        <Paper radius="lg" p="lg" withBorder mb="lg" bg="var(--surface-1)">
          <Group gap="md">
            {institution?.logo_url ? (
              <Avatar src={institution.logo_url} size="lg" radius="md" />
            ) : (
              <Avatar color="blue" size="lg" radius="md">
                <IconBuildingArch size={24} />
              </Avatar>
            )}
            <div style={{ flex: 1 }}>
              <Group justify="space-between" align="flex-start">
                <Title order={4} fw={700}>
                  {institution?.name || "Campus Registration"}
                </Title>
                <Badge color="teal" variant="light" size="sm">
                  {campusSlug.toUpperCase()}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" mt={2}>
                Official Student & Staff Biometric Attendance Enrollment
              </Text>
            </div>
          </Group>
        </Paper>

        <Paper radius="lg" p="xl" withBorder>
          <form onSubmit={handleSubmit}>
            <TextInput
              label="Campus Email"
              placeholder={`student@${campusSlug}.edu.ph`}
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              error={emailError}
              required
              mb="sm"
            />
            <PasswordInput
              label="Password"
              placeholder="Minimum 8 characters"
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
              placeholder="Re-type password"
              value={form.password_confirm}
              onChange={handleChange("password_confirm")}
              required
              mb="sm"
            />
            <Group grow mb="sm">
              <TextInput
                label="First Name"
                value={form.first_name}
                onChange={handleChange("first_name")}
                required
              />
              <TextInput
                label="Last Name"
                value={form.last_name}
                onChange={handleChange("last_name")}
                required
              />
            </Group>
            <TextInput
              label="Student / Employee ID"
              placeholder="e.g. 2023-0001"
              value={form.identifier}
              onChange={handleChange("identifier")}
              mb="sm"
            />
            {!campusSlug && instOptions.length > 0 && (
              <Select
                label="Institution / University"
                placeholder="Select your institution"
                data={instOptions}
                value={selectedInstId}
                onChange={(val) => {
                  if (!val) return;
                  setSelectedInstId(val);
                  const chosen = institutionList.find((i) => i.id === val);
                  if (chosen) setInstitution(chosen);
                  setForm((prev) => ({ ...prev, department_id: "" }));
                }}
                required
                searchable
                allowDeselect={false}
                mb="sm"
              />
            )}

            {!loadingDepts && deptOptions.length === 0 ? (
              <Alert icon={<IconAlertCircle size={16} />} title="No College Programs Configured" color="yellow" mb="md">
                No academic departments or college programs are configured for {institution?.name || "this institution"} yet. Please contact your campus administrator to set up academic departments before registering.
              </Alert>
            ) : (
              <Select
                label="Department / College Program"
                placeholder={loadingDepts ? "Loading campus college programs..." : "Select your department or program"}
                value={form.department_id || null}
                onChange={(val) => {
                  setForm((prev) => ({ ...prev, department_id: val || "" }));
                  if (error) setError(null);
                }}
                data={deptOptions}
                required
                searchable
                clearable={false}
                allowDeselect={false}
                maxDropdownHeight={280}
                nothingFoundMessage="No matching department found"
                comboboxProps={{ transitionProps: { transition: "pop", duration: 150 }, shadow: "md", withinPortal: true, zIndex: 1000 }}
                checkIconPosition="right"
                mb="md"
              />
            )}

            {(error || apiError) && (
              <Alert color="red" mb="md">
                {error || apiError}
              </Alert>
            )}
            <Button
              type="submit"
              fullWidth
              loading={submitting}
              disabled={submitting || (!loadingDepts && deptOptions.length === 0)}
            >
              Register for {institution?.name || campusSlug.toUpperCase()}
            </Button>
          </form>

          <Text ta="center" mt="md" size="sm" c="dimmed">
            Already registered?{" "}
            <Anchor component={Link} to={`/${campusSlug}`}>
              Sign in at Campus Portal
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}
