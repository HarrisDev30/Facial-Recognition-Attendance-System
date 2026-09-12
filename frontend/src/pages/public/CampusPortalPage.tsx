import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Button,
  TextInput,
  Title,
  Text,
  Group,
  Stack,
  Loader,
  Alert,
  ActionIcon,
} from "@mantine/core";
import {
  IconBuildingArch,
  IconArrowLeft,
  IconAlertCircle,
  IconLock,
  IconMail,
  IconScan,
  IconArrowRight,
  IconRosetteDiscountCheckFilled,
  IconShieldCheck,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { getInstitutionBySlug } from "../../api/institutions";
import { useAuthStore } from "../../store/authStore";
import { roleHome } from "../../utils/routes";
import type { InstitutionPublicResponse } from "../../types/institution";
import "./CampusPortalPage.css";

gsap.registerPlugin(useGSAP);

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

export default function CampusPortalPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { login, logout, user } = useAuthStore();
  const pageRef = useRef<HTMLDivElement>(null);

  // Synchronous initial cache (eliminates blank loader flash)
  const initialInstitution: InstitutionPublicResponse | null = useMemo(() => {
    if (!slug) return null;
    const cached = sessionStorage.getItem(`attendify_tenant_${slug.toLowerCase()}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore parse error
      }
    }
    return null;
  }, [slug]);

  const [institution, setInstitution] = useState<InstitutionPublicResponse | null>(initialInstitution);
  const [loading, setLoading] = useState(!initialInstitution);
  const [notFound, setNotFound] = useState(false);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInstitution() {
      if (!slug) return;
      if (!initialInstitution) {
        setLoading(true);
      }
      setNotFound(false);
      try {
        const data = await getInstitutionBySlug(slug);
        setInstitution(data);
        sessionStorage.setItem(`attendify_tenant_${slug.toLowerCase()}`, JSON.stringify(data));
      } catch {
        if (!initialInstitution) {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    }
    loadInstitution();
  }, [slug, initialInstitution]);

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

  // Fluid GSAP Entrance Choreography (Seamless Header Transition)
  useGSAP(
    () => {
      if (!loading && institution) {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        // 1. Seamless Header Elements (Badge & All Campuses button glide into persistent navbar)
        tl.from(
          [".portal-nav-divider", ".portal-campus-code"],
          {
            x: -12,
            opacity: 0,
            duration: 0.45,
            ease: "power2.out",
            clearProps: "all",
          },
          0
        )
          .from(
            ".btn-all-campuses",
            {
              opacity: 0,
              scale: 0.96,
              duration: 0.38,
              ease: "power2.out",
              clearProps: "all",
            },
            "<"
          )
          // 2. Campus Hero Branding & Centered Card
          .from(
            ".campus-hero-crest",
            {
              scale: 0.85,
              y: 14,
              opacity: 0,
              duration: 0.55,
              ease: "back.out(1.4)",
              clearProps: "all",
            },
            "-=0.2"
          )
          .from(
            [".campus-hero-badge", ".campus-hero-title", ".campus-hero-subtitle"],
            {
              y: 16,
              opacity: 0,
              duration: 0.5,
              stagger: 0.07,
              clearProps: "all",
            },
            "-=0.35"
          )
          .from(
            ".campus-clean-card",
            {
              y: 20,
              scale: 0.98,
              opacity: 0,
              duration: 0.6,
              clearProps: "all",
            },
            "-=0.35"
          )
          .from(
            ".campus-clean-footer",
            {
              opacity: 0,
              y: 8,
              duration: 0.45,
              clearProps: "all",
            },
            "-=0.25"
          );
      }
    },
    { scope: pageRef, dependencies: [loading, institution?.id] },
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAuthError(null);

    try {
      await login(email.trim(), password, slug);
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        navigate(roleHome(currentUser.role), { replace: true });
      }
    } catch (err: any) {
      setAuthError(
        err.response?.data?.detail || "Invalid credentials. Please verify your campus email and password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !institution) {
    return (
      <div className="campus-portal-container" data-theme="light" style={{ justifyContent: "center", alignItems: "center" }}>
        <Loader size="lg" color="blue" />
        <Text mt="md" c="dimmed" size="sm">
          Loading campus gateway...
        </Text>
      </div>
    );
  }

  if (notFound || !institution) {
    return (
      <div className="campus-portal-container" data-theme="light" style={{ justifyContent: "center", alignItems: "center", padding: "2rem" }}>
        <Stack align="center" gap="md" style={{ maxWidth: 440, textAlign: "center" }}>
          <IconAlertCircle size={44} color="#ef4444" />
          <Title order={3} style={{ color: "var(--portal-text-heading)" }}>
            Campus Gateway Not Found
          </Title>
          <Text c="dimmed" size="sm">
            No institutional partition is active for code <code style={{ color: "#0070f3" }}>{slug}</code>.
          </Text>
          <Button component={Link} to="/" variant="light" leftSection={<IconArrowLeft size={16} />}>
            Return to Attendify Platform
          </Button>
        </Stack>
      </div>
    );
  }

  const brandColor = institution.brand_color || "#0070f3";
  const glow = hexToRgba(brandColor, 0.28);
  const subtle = hexToRgba(brandColor, 0.08);

  return (
    <div
      ref={pageRef}
      className="campus-portal-container"
      data-theme="light"
      style={
        {
          "--campus-brand": brandColor,
          "--campus-brand-glow": glow,
          "--campus-brand-subtle": subtle,
        } as React.CSSProperties
      }
    >
      {/* Sticky Top Navbar (1:1 Pixel-Aligned with Landing Page) */}
      <header className="campus-portal-nav">
        <div className="campus-nav-inner">
          <div className="nav-left">
            <Link to="/" className="landing-brand">
              <div className="brand-logo-mark">
                <IconScan size={20} color="#ffffff" stroke={2.5} />
              </div>
              <span className="brand-title">Attendify</span>
              <span className="brand-version-badge">v2.0</span>
            </Link>
            <span className="portal-nav-divider">/</span>
            <span className="portal-campus-code">{institution.code.toUpperCase()}</span>
          </div>

          <div className="nav-actions-cluster">
            <Link to="/" className="btn-all-campuses">
              <IconArrowLeft size={14} />
              <span className="btn-all-campuses-text">All Campuses</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content: Clean Centered Portal */}
      <main className="campus-portal-clean-layout">
        {user && user.role !== "super_admin" && user.institution_code?.toLowerCase() !== slug?.toLowerCase() && (
          <div style={{ width: "100%", maxWidth: 480, marginBottom: "1rem" }}>
            <Alert color="orange" title="Active Session Notice" icon={<IconAlertCircle size={16} />} radius="md">
              <Group justify="space-between" align="center">
                <Text size="xs">
                  Signed in under <strong>{user.institution_name || user.institution_code?.toUpperCase()}</strong>.
                </Text>
                <Button size="xs" variant="outline" color="orange" onClick={() => logout()}>
                  Sign Out
                </Button>
              </Group>
            </Alert>
          </div>
        )}

        {/* University Hero Branding */}
        <div className="campus-clean-hero">
          <div className="campus-hero-crest">
            {institution.logo_url ? (
              <img src={institution.logo_url} alt={institution.name} />
            ) : (
              <IconBuildingArch size={36} color="var(--campus-brand)" />
            )}
          </div>

          <div className="campus-hero-badge">
            <IconRosetteDiscountCheckFilled size={14} color="var(--campus-brand)" />
            <span>OFFICIAL CAMPUS GATEWAY</span>
          </div>

          <h1 className="campus-hero-title">{institution.name}</h1>
          <p className="campus-hero-subtitle">
            Student & Faculty Attendance Portal
          </p>
        </div>

        {/* Focused Authentication Card */}
        <div className="campus-clean-card">
          <Stack ta="center" mb="md" gap={2}>
            <Text fw={700} size="lg" style={{ color: "var(--portal-text-heading)", letterSpacing: "-0.4px" }}>
              Sign In to Your Account
            </Text>
            <Text size="xs" c="dimmed">
              Use your institutional credentials to access your profile
            </Text>
          </Stack>

          {authError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" mb="sm">
              {authError}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <Stack gap="sm">
              <TextInput
                label="Institutional Email"
                placeholder={`student@${institution.code.toLowerCase()}.edu.ph`}
                required
                leftSection={<IconMail size={16} />}
                leftSectionPointerEvents="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                styles={{
                  input: { paddingLeft: "42px" },
                }}
              />

              <TextInput
                type={showPassword ? "text" : "password"}
                label="Password"
                placeholder="••••••••"
                required
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
                    style={{ color: "var(--text-muted, #737373)" }}
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </ActionIcon>
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                styles={{
                  input: { paddingLeft: "42px", paddingRight: "38px" },
                }}
              />

              <Button
                type="submit"
                fullWidth
                loading={submitting}
                mt="xs"
                className="btn-portal-submit"
                rightSection={<IconArrowRight size={16} />}
              >
                Sign In to {institution.code.toUpperCase()}
              </Button>
            </Stack>
          </form>

          <div className="campus-clean-divider">
            <span />
            <p>or</p>
            <span />
          </div>

          <Button
            component={Link}
            to={`/${institution.code}/register`}
            state={{ institution }}
            variant="default"
            fullWidth
            className="btn-portal-register"
          >
            Create New Student Account
          </Button>
        </div>

        {/* Campus Identity & Support Footer */}
        <footer className="campus-clean-footer">
          <Group gap={6} justify="center" align="center">
            <IconShieldCheck size={14} color="var(--campus-brand)" />
            <Text size="xs" c="dimmed">
              Official {institution.name} Portal
            </Text>
          </Group>
          <Text size="xs" c="dimmed" ta="center" mt={4}>
            Need help signing in? Contact your campus registrar or IT helpdesk.
          </Text>
        </footer>
      </main>
    </div>
  );
}
