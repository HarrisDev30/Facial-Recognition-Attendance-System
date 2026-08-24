import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link, useParams, useSearchParams, useLocation } from "react-router-dom";
import {
  Title,
  TextInput,
  Button,
  Alert,
  Text,
  Anchor,
  Progress,
  Select,
  Badge,
  Group,
  Avatar,
  Stack,
  Loader,
  ActionIcon,
} from "@mantine/core";
import {
  IconBuildingArch,
  IconArrowLeft,
  IconAlertCircle,
  IconScan,
  IconSun,
  IconMoon,
  IconCheck,
  IconLock,
  IconMail,
  IconId,
  IconSchool,
  IconArrowRight,
  IconRosetteDiscountCheckFilled,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import { registerStudent } from "../api/auth";
import { getDepartments } from "../api/departments";
import { getInstitutionBySlug, getInstitutions } from "../api/institutions";
import { useFormSubmit } from "../hooks";
import { useAuthStore } from "../store/authStore";
import { getTenantSlugFromHostname, isReservedSlug } from "../utils/tenant";
import type { DepartmentResponse, TokenResponse } from "../types/auth";
import type { InstitutionPublicResponse } from "../types/institution";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import "./AuthPages.css";

gsap.registerPlugin(useGSAP);

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

function hexToRgba(hex: string, alpha: number): string {
  let c = (hex || "#0070f3").replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(0, 112, 243, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function StudentSignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const mountedRef = useRef(true);
  const pageRef = useRef<HTMLDivElement>(null);

  // Dual-Theme Engine (matching Landing Page)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("attendify_landing_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("attendify_landing_theme", nextTheme);

    // Smooth GSAP spin & pop on the theme toggle icon
    gsap.fromTo(
      ".auth-theme-toggle svg",
      { rotate: -90, scale: 0.6, opacity: 0 },
      { rotate: 0, scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.6)" },
    );
  };

  // 1. Resolve Campus Slug from Route /:slug/register, Subdomain, query param, or state
  const rawSlug =
    params.slug ||
    getTenantSlugFromHostname() ||
    searchParams.get("campus") ||
    searchParams.get("institution") ||
    (location.state as any)?.institution_code ||
    "";

  const campusSlug = rawSlug && !isReservedSlug(rawSlug) ? rawSlug.toLowerCase() : "";

  // Synchronous State Handoff (Apple Design standard - 0ms instant color & zero flash)
  const initialInstitution: InstitutionPublicResponse | null = useMemo(() => {
    const fromState = (location.state as any)?.institution;
    if (fromState && (!campusSlug || fromState.code?.toLowerCase() === campusSlug)) {
      return fromState;
    }
    if (campusSlug) {
      const cached = sessionStorage.getItem(`attendify_tenant_${campusSlug}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore cache parse error
        }
      }
    }
    return null;
  }, [campusSlug, location.state]);

  const [institutionList, setInstitutionList] = useState<InstitutionPublicResponse[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>(initialInstitution?.id || "");
  const [institution, setInstitution] = useState<InstitutionPublicResponse | null>(initialInstitution);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [loadingInst, setLoadingInst] = useState(!initialInstitution);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".auth-mesh-orb", {
        scale: 0.85,
        opacity: 0,
        duration: 1.0,
        stagger: 0.15,
        ease: "power2.out",
        clearProps: "scale",
      })
        .from(".auth-top-nav", { y: -16, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.8")
        .from(".auth-glass-card", { y: 24, scale: 0.97, opacity: 0, duration: 0.7, clearProps: "all" }, "-=0.5");
    },
    { scope: pageRef, dependencies: [institution?.id] },
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 2. Fetch locked institution information OR list of institutions
  useEffect(() => {
    let active = true;
    if (campusSlug) {
      if (!initialInstitution) {
        setLoadingInst(true);
      }
      getInstitutionBySlug(campusSlug)
        .then((inst) => {
          if (!active) return;
          setInstitution(inst);
          setSelectedInstId(inst.id);
          sessionStorage.setItem(`attendify_tenant_${campusSlug}`, JSON.stringify(inst));
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
  }, [campusSlug, initialInstitution]);

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
            department_id: items[0].id,
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
      label: `${i.name} (${i.code.toUpperCase()})`,
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

  const pwScore = getPasswordStrength(form.password);

  if (success) {
    return (
      <div className="auth-page-container" data-theme={theme}>
        <div className="auth-bg-atmosphere" aria-hidden="true">
          <div className="auth-mesh-orb orb-1" />
          <div className="auth-mesh-orb orb-2" />
        </div>
        <main className="auth-main-content">
          <div className="auth-glass-card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.15)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <IconCheck size={32} color="#10b981" stroke={3} />
            </div>
            <Title order={2} fw={700} style={{ letterSpacing: "-0.6px", color: "var(--auth-text-heading)" }}>
              Registration Successful
            </Title>
            <Text mt="sm" c="dimmed" size="sm">
              Your institutional profile has been established. Redirecting to biometric face enrollment...
            </Text>
            <Loader size="sm" color="teal" mt="xl" />
          </div>
        </main>
      </div>
    );
  }

  const brandColor = institution?.brand_color || "#0070f3";
  const glow = hexToRgba(brandColor, 0.28);
  const subtle = hexToRgba(brandColor, 0.08);

  return (
    <div
      ref={pageRef}
      className="auth-page-container"
      data-theme={theme}
      style={
        {
          "--campus-brand": brandColor,
          "--campus-brand-glow": glow,
          "--campus-brand-subtle": subtle,
        } as React.CSSProperties
      }
    >
      {/* Background Atmosphere Orbs */}
      <div className="auth-bg-atmosphere" aria-hidden="true">
        <div className="auth-mesh-orb orb-1" />
        <div className="auth-mesh-orb orb-2" />
        <div className="auth-grid-overlay" />
      </div>

      {/* Top Navbar */}
      <header className="auth-top-nav">
        <div className="auth-nav-inner">
          <Link to="/" className="landing-brand">
            <div className="brand-logo-mark">
              <IconScan size={20} color="#ffffff" stroke={2.5} />
            </div>
            <span className="brand-title">Attendify</span>
            <span className="brand-version-badge">v2.0</span>
          </Link>

          <button
            className="theme-toggle-btn auth-theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            aria-label="Toggle theme mode"
          >
            {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
          </button>
        </div>
      </header>

      {/* Main Glassmorphic Card with Progressive Flow */}
      <main className="auth-main-content">
        <div className="auth-glass-card card-wide">
          {/* Back Navigation */}
          <Group mb="md">
            <Anchor
              component={Link}
              to={campusSlug ? `/${campusSlug}` : "/login"}
              size="xs"
              c="dimmed"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}
            >
              <IconArrowLeft size={14} /> {campusSlug ? `Back to ${institution?.name || campusSlug.toUpperCase()} Portal` : "Back to Sign In"}
            </Anchor>
          </Group>

          {/* Form Header */}
          <Stack gap={2} mb="lg">
            <Title order={3} fw={700} style={{ letterSpacing: "-0.6px", color: "var(--auth-text-heading)" }}>
              {campusSlug ? `${institution?.name || campusSlug.toUpperCase()} Enrollment` : "Create University Account"}
            </Title>
            <Text size="xs" c="dimmed">
              Biometric attendance profile registration and partition enrollment
            </Text>
          </Stack>

          {/* Branded Institution Status Card (when locked or chosen) */}
          {institution && (
            <div className="campus-header-card">
              {institution.logo_url ? (
                <Avatar src={institution.logo_url} size="md" radius="md" />
              ) : (
                <Avatar color="blue" size="md" radius="md">
                  <IconBuildingArch size={20} />
                </Avatar>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span className="campus-info-title">{institution.name}</span>
                  <Badge color="teal" variant="light" size="xs">
                    {institution.code.toUpperCase()}
                  </Badge>
                </div>
                <div className="campus-info-sub">
                  <IconRosetteDiscountCheckFilled size={13} color="#10b981" />
                  <span>Verified Institutional Partition</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* STEP 1: Academic Partition */}
            <div className="auth-step-divider">
              <span className="auth-step-number">1</span>
              <span className="auth-step-label">Academic Partition</span>
              <div className="auth-step-line" />
            </div>

            <Stack gap="sm">
              {/* Institution Selector (if accessed globally) */}
              {!campusSlug && (
                <Select
                  label="Institution / Campus"
                  placeholder={loadingInst ? "Loading universities..." : "Select your university"}
                  disabled={loadingInst}
                  leftSection={<IconSchool size={16} />}
                  leftSectionPointerEvents="none"
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
                  styles={{
                    input: { paddingLeft: "42px" },
                  }}
                />
              )}

              {/* Department Selector */}
              {!loadingDepts && deptOptions.length === 0 ? (
                <Alert icon={<IconAlertCircle size={16} />} title="No College Programs Configured" color="yellow" radius="md">
                  No departments found for {institution?.name || "this university"}. Contact campus admin.
                </Alert>
              ) : (
                <Select
                  label="College Department / Program"
                  placeholder={loadingDepts ? "Loading programs..." : "Select your academic college program"}
                  disabled={loadingDepts}
                  leftSection={<IconBuildingArch size={16} />}
                  leftSectionPointerEvents="none"
                  rightSection={loadingDepts ? <Loader size={14} color="gray" /> : undefined}
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
                  styles={{
                    input: { paddingLeft: "42px" },
                  }}
                />
              )}

              {/* Student/Staff ID */}
              <TextInput
                label="Student / Employee ID"
                placeholder="e.g. 2024-0192 or EMP-104"
                leftSection={<IconId size={16} />}
                leftSectionPointerEvents="none"
                value={form.identifier}
                onChange={handleChange("identifier")}
                styles={{
                  input: { paddingLeft: "42px" },
                }}
              />
            </Stack>

            {/* STEP 2: Identity & Security Credentials */}
            <div className="auth-step-divider" style={{ marginTop: "1.75rem" }}>
              <span className="auth-step-number">2</span>
              <span className="auth-step-label">Account & Security</span>
              <div className="auth-step-line" />
            </div>

            <Stack gap="sm">
              <Group grow>
                <TextInput
                  label="First Name"
                  placeholder="First name"
                  value={form.first_name}
                  onChange={handleChange("first_name")}
                  required
                />
                <TextInput
                  label="Last Name"
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={handleChange("last_name")}
                  required
                />
              </Group>

              <TextInput
                label="Campus Email"
                placeholder={institution ? `student@${institution.code.toLowerCase()}.edu.ph` : "student@university.edu.ph"}
                type="email"
                leftSection={<IconMail size={16} />}
                leftSectionPointerEvents="none"
                value={form.email}
                onChange={handleChange("email")}
                error={emailError}
                required
                styles={{
                  input: { paddingLeft: "42px" },
                }}
              />

              <TextInput
                type={showPassword ? "text" : "password"}
                label="Password"
                placeholder="••••••••"
                leftSection={<IconLock size={16} />}
                leftSectionPointerEvents="none"
                rightSection={
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{ color: "var(--auth-text-muted, #737373)" }}
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </ActionIcon>
                }
                value={form.password}
                onChange={handleChange("password")}
                required
                styles={{
                  input: { paddingLeft: "42px", paddingRight: "38px" },
                }}
              />
              {form.password && (
                <Progress
                  value={pwScore}
                  color={getStrengthColor(pwScore)}
                  size="xs"
                  radius="xl"
                  animated={pwScore < 100}
                />
              )}

              <TextInput
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm Password"
                placeholder="••••••••"
                leftSection={<IconLock size={16} />}
                leftSectionPointerEvents="none"
                rightSection={
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    style={{ color: "var(--auth-text-muted, #737373)" }}
                  >
                    {showConfirmPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </ActionIcon>
                }
                value={form.password_confirm}
                onChange={handleChange("password_confirm")}
                required
                styles={{
                  input: { paddingLeft: "42px", paddingRight: "38px" },
                }}
              />

              {(error || apiError) && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" mt="xs">
                  {error || apiError}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                loading={submitting}
                mt="md"
                className="auth-btn-submit"
                rightSection={<IconArrowRight size={16} />}
              >
                Complete Registration & Enroll
              </Button>
            </Stack>
          </form>

          <Text ta="center" mt="xl" size="xs" c="dimmed">
            Already have an account?{" "}
            <Anchor component={Link} to={campusSlug ? `/${campusSlug}` : "/login"} fw={600} td="underline" style={{ color: "#0070f3" }}>
              Sign in
            </Anchor>
          </Text>
        </div>
      </main>
    </div>
  );
}
