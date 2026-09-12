import { useState, useRef } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import {
  TextInput,
  Button,
  Alert,
  Text,
  Anchor,
  Stack,
  ActionIcon,
} from "@mantine/core";
import {
  IconScan,
  IconMail,
  IconLock,
  IconArrowRight,
  IconArrowLeft,
  IconAlertCircle,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuthStore } from "../../store/authStore";
import { useFormSubmit } from "../../hooks";
import { roleHome } from "../../utils/routes";
import "./AuthPages.css";

gsap.registerPlugin(useGSAP);

export default function LoginPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { token, user, login } = useAuthStore();
  const navigate = useNavigate();

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".auth-top-nav", { y: -16, opacity: 0, duration: 0.5, clearProps: "all" })
        .from(".auth-nav-inner > *", { scale: 0.96, opacity: 0, duration: 0.35, stagger: 0.05, ease: "power2.out", clearProps: "all" }, "-=0.3")
        .from(".auth-glass-card", { y: 20, scale: 0.98, opacity: 0, duration: 0.6, ease: "power3.out", clearProps: "all" }, "-=0.3");
    },
    { scope: pageRef },
  );

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
    <div ref={pageRef} className="auth-page-container" data-theme="light">
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

          <Link to="/" className="auth-nav-back-btn">
            <IconArrowLeft size={15} />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Glassmorphic Card */}
      <main className="auth-main-content">
        <div className="auth-glass-card">
          <Stack ta="center" mb="lg" gap={4}>
            <Text fw={700} size="xl" style={{ letterSpacing: "-0.6px", color: "var(--auth-text-heading)" }}>
              Welcome back
            </Text>
            <Text size="sm" c="dimmed">
              Enter your credentials to continue
            </Text>
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email address"
                placeholder="name@university.edu"
                leftSection={<IconMail size={16} />}
                leftSectionPointerEvents="none"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                styles={{
                  input: {
                    paddingLeft: "42px",
                  },
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
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                styles={{
                  input: {
                    paddingLeft: "42px",
                    paddingRight: "38px",
                  },
                }}
              />
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
                  {error}
                </Alert>
              )}
              <Button
                type="submit"
                fullWidth
                loading={submitting}
                mt="xs"
                className="auth-btn-submit"
                rightSection={<IconArrowRight size={16} />}
              >
                Sign In
              </Button>
            </Stack>
          </form>

          <Text ta="center" mt="xl" size="sm" c="dimmed">
            Don't have an account?{" "}
            <Anchor component={Link} to="/register" fw={600} td="underline" style={{ color: "#0070f3" }}>
              Create an account
            </Anchor>
          </Text>
        </div>
      </main>
    </div>
  );
}
