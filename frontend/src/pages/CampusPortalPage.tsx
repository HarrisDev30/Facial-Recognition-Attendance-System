import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Button,
  TextInput,
  PasswordInput,
  Tabs,
  Title,
  Text,
  Badge,
  Group,
  Stack,
  Loader,
  Alert,
} from "@mantine/core";
import {
  IconBuildingArch,
  IconArrowLeft,
  IconAlertCircle,
  IconLock,
  IconMail,
  IconSun,
  IconMoon,
  IconScan,
  IconShieldCheck,
  IconCpu,
  IconArrowRight,
  IconRosetteDiscountCheckFilled,
} from "@tabler/icons-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { getInstitutionBySlug } from "../api/institutions";
import { useAuthStore } from "../store/authStore";
import { roleHome } from "../utils/routes";
import type { InstitutionPublicResponse } from "../types/institution";
import "./CampusPortalPage.css";

gsap.registerPlugin(useGSAP);

export default function CampusPortalPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { login, logout, user } = useAuthStore();
  const pageRef = useRef<HTMLDivElement>(null);

  const [institution, setInstitution] = useState<InstitutionPublicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Dual Theme Engine
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
  };

  // Form State
  const [activeTab, setActiveTab] = useState<string | null>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInstitution() {
      if (!slug) return;
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getInstitutionBySlug(slug);
        setInstitution(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadInstitution();
  }, [slug]);

  // If user is already logged in for THIS campus (or super_admin), route to home
  useEffect(() => {
    if (user) {
      const isSuperAdmin = user.role === "super_admin";
      const matchesCampus = user.institution_code?.toLowerCase() === slug?.toLowerCase();
      if (isSuperAdmin || matchesCampus) {
        navigate(roleHome(user.role), { replace: true });
      }
    }
  }, [user, slug, navigate]);

  // GSAP Entrance Motion
  useGSAP(
    () => {
      if (!loading && institution) {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.from(".campus-portal-nav", { y: -20, opacity: 0, duration: 0.6, clearProps: "all" })
          .from(".campus-info-hero", { x: -30, opacity: 0, duration: 0.7, clearProps: "all" }, "-=0.3")
          .from(".campus-auth-card", { x: 30, opacity: 0, duration: 0.7, clearProps: "all" }, "-=0.5");
      }
    },
    { scope: pageRef, dependencies: [loading, institution] }
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      await login(email, password, slug);
    } catch (err: any) {
      setAuthError(err?.response?.data?.detail || "Invalid email, password, or institution portal credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="campus-portal-container" data-theme={theme} style={{ justifyContent: "center", alignItems: "center" }}>
        <Loader size="lg" color="blue" />
        <Text mt="md" c="dimmed" size="sm" ff="monospace">
          Connecting to isolated campus portal partition...
        </Text>
      </div>
    );
  }

  if (notFound || !institution) {
    return (
      <div className="campus-portal-container" data-theme={theme} style={{ justifyContent: "center", alignItems: "center", padding: "2rem" }}>
        <Stack align="center" gap="md" style={{ maxWidth: 460, textAlign: "center" }}>
          <IconAlertCircle size={48} color="#ef4444" />
          <Title order={3} style={{ color: "var(--text-heading)" }}>
            Campus Portal Not Found
          </Title>
          <Text c="dimmed" size="sm">
            We couldn't find an active institutional partition registered under the code <code style={{ color: "#0070f3" }}>{slug}</code>.
          </Text>
          <Button component={Link} to="/" variant="light" leftSection={<IconArrowLeft size={16} />}>
            Back to Attendify Platform
          </Button>
        </Stack>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="campus-portal-container" data-theme={theme}>
      {/* Background Atmosphere Orbs */}
      <div className="portal-bg-atmosphere" aria-hidden="true">
        <div className="portal-mesh-orb orb-1" />
        <div className="portal-mesh-orb orb-2" />
        <div className="portal-grid-overlay" />
      </div>

      {/* Sticky Navbar */}
      <header className="campus-portal-nav">
        <div className="nav-left">
          <Link to="/" className="portal-brand-link">
            <div className="portal-logo-mark">
              <IconScan size={18} color="#ffffff" stroke={2.5} />
            </div>
            <span className="portal-brand-text">Attendify</span>
          </Link>
          <span className="portal-nav-divider">/</span>
          <span className="portal-campus-code">{institution.code.toUpperCase()}</span>
        </div>

        <div className="nav-right">
          <button
            className="portal-theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            aria-label="Toggle theme mode"
          >
            {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>

          <Button
            component={Link}
            to="/"
            size="xs"
            leftSection={<IconArrowLeft size={14} />}
            className="btn-all-campuses"
          >
            All Campuses
          </Button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="campus-portal-body">
        {user && user.role !== "super_admin" && user.institution_code?.toLowerCase() !== slug?.toLowerCase() && (
          <div className="portal-session-alert">
            <Alert color="orange" title="Active Session Notice" icon={<IconAlertCircle size={16} />}>
              <Group justify="space-between" align="center">
                <Text size="sm">
                  You are currently signed in under <strong>{user.institution_name || user.institution_code?.toUpperCase()}</strong>.
                </Text>
                <Button size="xs" variant="outline" color="orange" onClick={() => logout()}>
                  Sign Out to Switch Account
                </Button>
              </Group>
            </Alert>
          </div>
        )}

        {/* Left: Campus Info Hero */}
        <div className="campus-info-hero">
          <div className="campus-logo-badge">
            {institution.logo_url ? (
              <img src={institution.logo_url} alt={institution.name} />
            ) : (
              <IconBuildingArch size={34} color="#0070f3" />
            )}
          </div>

          <div>
            <div className="campus-eyebrow">
              <IconRosetteDiscountCheckFilled size={15} color="#10b981" />
              <span>OFFICIAL INSTITUTIONAL GATEWAY</span>
            </div>
            <h1 className="campus-portal-title">{institution.name}</h1>
            <p className="campus-portal-subtitle">
              Dedicated server-side biometric attendance and event check-in platform.
            </p>
          </div>

          <div className="campus-status-tags">
            <Badge color="teal" variant="dot" size="md">
              Partition Active
            </Badge>
            <Badge color="blue" variant="dot" size="md">
              InsightFace Buffalo_L
            </Badge>
            <Badge color="cyan" variant="dot" size="md">
              FAISS In-Memory
            </Badge>
          </div>

          <div className="campus-features-box">
            <div className="feature-item">
              <IconCpu size={18} color="#0070f3" />
              <div>
                <span className="feature-title">Zero Raw Facial Storage</span>
                <span className="feature-sub">Ephemeral 512D vector embeddings strictly compliant with RA 10173.</span>
              </div>
            </div>
            <div className="feature-item">
              <IconShieldCheck size={18} color="#10b981" />
              <div>
                <span className="feature-title">Isolated Database Partition</span>
                <span className="feature-sub">Encrypted PostgreSQL tenant schema isolated for {institution.code.toUpperCase()}.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Auth Card */}
        <div className="campus-auth-card">
          <Tabs value={activeTab} onChange={setActiveTab} variant="pills">
            <Tabs.List grow mb="lg">
              <Tabs.Tab value="login">Sign In</Tabs.Tab>
              <Tabs.Tab value="signup">Register</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="login">
              {authError && (
                <Alert icon={<IconAlertCircle size={16} />} title="Authentication Error" color="red" mb="md">
                  {authError}
                </Alert>
              )}

              <form onSubmit={handleLogin}>
                <Stack gap="md">
                  <TextInput
                    label="Institutional Email"
                    placeholder={`student@${institution.code.toLowerCase()}.edu.ph`}
                    required
                    leftSection={<IconMail size={16} />}
                    leftSectionPointerEvents="none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    styles={{
                      input: {
                        paddingLeft: "42px",
                      },
                    }}
                  />

                  <PasswordInput
                    label="Password"
                    placeholder="Enter your security password"
                    required
                    leftSection={<IconLock size={16} />}
                    leftSectionPointerEvents="none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    styles={{
                      innerInput: {
                        paddingLeft: "42px",
                      },
                    }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    loading={submitting}
                    mt="sm"
                    className="btn-portal-submit"
                    rightSection={<IconArrowRight size={16} />}
                  >
                    Sign In to {institution.code.toUpperCase()} Portal
                  </Button>
                </Stack>
              </form>
            </Tabs.Panel>

            <Tabs.Panel value="signup">
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  New student or staff member at {institution.name}? Register your university account to enroll your biometric profile.
                </Text>
                <Button
                  component={Link}
                  to={`/${institution.code}/register`}
                  variant="light"
                  color="blue"
                  fullWidth
                  rightSection={<IconArrowRight size={16} />}
                >
                  Go to Student Registration Form
                </Button>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
