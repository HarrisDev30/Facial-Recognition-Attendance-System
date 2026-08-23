import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button, Select, Badge } from "@mantine/core";
import {
  IconScan,
  IconArrowRight,
  IconBuildingArch,
  IconSparkles,
  IconLockCheck,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { getInstitutions } from "../api/institutions";
import type { InstitutionPublicResponse } from "../types/institution";
import { AnimatedBackground } from "../components/landing/AnimatedBackground";
import { InteractiveCampusCarousel } from "../components/landing/InteractiveCampusCarousel";
import { HeroProductWindow } from "../components/landing/HeroProductWindow";
import { ScrollPipelineSection } from "../components/landing/ScrollPipelineSection";
import { MultiDeviceMeshSection } from "../components/landing/MultiDeviceMeshSection";
import { PrivacyVaultSection } from "../components/landing/PrivacyVaultSection";
import { CampusOnboardingModal } from "../components/landing/CampusOnboardingModal";
import "./LandingPage.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function LandingPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const [institutions, setInstitutions] = useState<InstitutionPublicResponse[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>("cjc");
  const [modalOpened, setModalOpened] = useState(false);

  // Theme Engine (Light / Dark mode) with persistence & system preference detection
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
      ".theme-toggle-btn svg",
      { rotate: -90, scale: 0.6, opacity: 0 },
      { rotate: 0, scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.6)" },
    );
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getInstitutions(true);
        setInstitutions(data);
      } catch (err) {
        console.error("Failed to load institutions", err);
      }
    }
    loadData();
  }, []);

  // GSAP Entrance Timeline (Optimized with hardware-accelerated transforms)
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // 1. Seamless Navbar Micro-Elements (Navbar, Version badge, links, and unified action cluster)
      tl.from(".landing-sticky-nav", {
        y: -14,
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
        clearProps: "all",
      })
        .from(
          ".brand-version-badge",
          {
            scale: 0.8,
            opacity: 0,
            duration: 0.35,
            ease: "back.out(1.4)",
            clearProps: "all",
          },
          "-=0.3",
        )
        .from(
          ".nav-link-item",
          {
            y: -6,
            opacity: 0,
            duration: 0.35,
            stagger: 0.03,
            ease: "power2.out",
            clearProps: "all",
          },
          "-=0.25",
        )
        .from(
          ".nav-actions-cluster",
          {
            y: -6,
            opacity: 0,
            duration: 0.38,
            ease: "power2.out",
            clearProps: "all",
          },
          "<",
        )
        // 2. Hero Section Cascading Stagger (Hardware Accelerated)
        .from(".hero-badge", { y: 16, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.25")
        .from(".hero-title", { y: 22, opacity: 0, duration: 0.6, clearProps: "all" }, "-=0.35")
        .from(".hero-subtitle", { y: 16, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.4")
        .from(".hero-cta-group", { y: 16, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.35")
        .from(
          ".hero-fast-campus-bar",
          {
            y: 16,
            scale: 0.98,
            opacity: 0,
            duration: 0.5,
            ease: "power2.out",
            clearProps: "all",
          },
          "-=0.3",
        );
    },
    { scope: pageRef },
  );

  const scrollToCampuses = () => {
    const el = document.getElementById("campuses");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleLaunchCampus = (slugToLaunch?: string) => {
    const target = slugToLaunch || selectedSlug || "cjc";
    navigate(`/${target}`);
  };

  return (
    <div ref={pageRef} className="landing-root-container" data-theme={theme}>
      {/* GSAP Ambient Animated Background */}
      <AnimatedBackground theme={theme} />

      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="nav-inner-container">
          <Link to="/" className="landing-brand">
            <div className="brand-logo-mark">
              <IconScan size={20} color="#ffffff" stroke={2.5} />
            </div>
            <span className="brand-title">Attendify</span>
            <span className="brand-version-badge">v2.0</span>
          </Link>

          {/* Center Navigation Links */}
          <nav className="nav-center-links">
            <a href="#pipeline" className="nav-link-item">Pipeline</a>
            <a href="#hardware" className="nav-link-item">Scanners</a>
            <a href="#privacy" className="nav-link-item">Privacy</a>
            <a href="#campuses" className="nav-link-item">Campuses</a>
          </nav>

          {/* Right Action Cluster */}
          <div className="nav-actions-cluster">
            {/* Theme Switcher Toggle */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              aria-label="Toggle theme mode"
            >
              {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>

            <Button
              component={Link}
              to="/login"
              size="xs"
              className="nav-btn-signin"
            >
              Sign In
            </Button>

            <Button
              className="nav-cta-find-campus"
              size="xs"
              onClick={scrollToCampuses}
              rightSection={<IconBuildingArch size={14} />}
            >
              <span className="nav-btn-find-campus-text">Find Campus</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="hero-section">
        <div className="hero-content-wrapper">
          <div className="hero-badge">
            <IconLockCheck size={15} />
            <span className="eyebrow-main">Server-Side Biometric Intelligence</span>
            <span className="eyebrow-detail"> &bull; Multi-Campus Gateway</span>
          </div>

          <h1 className="hero-title">
            Instant attendance.<br />Zero friction.
          </h1>

          <p className="hero-subtitle">
            Fast, effortless attendance verification for university events. Log thousands of students seamlessly as they walk through campus doors—with zero manual sign-in sheets and zero photo storage.
          </p>

          <div className="hero-cta-group">
            <Button
              className="btn-hero-primary"
              onClick={() => handleLaunchCampus("cjc")}
              rightSection={<IconArrowRight size={16} />}
            >
              Launch Cor Jesu College (Pilot)
            </Button>
            <Button
              className="btn-hero-secondary"
              onClick={() => setModalOpened(true)}
              leftSection={<IconSparkles size={16} />}
            >
              Onboard Your University
            </Button>
          </div>

          {/* Instant Campus Jump Selector */}
          <div className="hero-fast-campus-bar">
            <div className="campus-jump-select-wrapper">
              <Select
                size="sm"
                leftSection={<IconBuildingArch size={16} className="jump-select-icon" />}
                placeholder="Jump directly to campus portal (e.g. CJC)..."
                searchable
                clearable
                data={institutions.map((inst) => ({
                  value: inst.code,
                  label: `${inst.name} (${inst.code.toUpperCase()})`,
                }))}
                value={selectedSlug}
                onChange={(val) => {
                  setSelectedSlug(val);
                  if (val) handleLaunchCampus(val);
                }}
                className="campus-jump-select"
                comboboxProps={{
                  withinPortal: false,
                  transitionProps: { transition: "fade-down", duration: 150 },
                  shadow: "xl",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 🏛️ Interactive Campus Showcase (Gliding tactile passes below Hero) */}
      <InteractiveCampusCarousel
        institutions={institutions}
        onOnboardClick={() => setModalOpened(true)}
      />

      {/* Luminous Section Divider */}
      <div className="section-luminous-divider" />

      {/* 🖥️ Live Telemetry & Scanner Gateway Showcase (Solid Hardware Console) */}
      <section className="product-gateway-showcase-section">
        <div className="hero-product-window-container">
          <HeroProductWindow />
        </div>
      </section>

      {/* Luminous Section Divider */}
      <div className="section-luminous-divider" />

      {/* 4-Stage Biometric Processing Pipeline (GSAP ScrollTrigger Pinned Section) */}
      <ScrollPipelineSection />

      {/* Luminous Section Divider */}
      <div className="section-luminous-divider" />

      {/* Multi-Device Hardware Mesh Section */}
      <MultiDeviceMeshSection />

      {/* Luminous Section Divider */}
      <div className="section-luminous-divider" />

      {/* Privacy Vault Section */}
      <PrivacyVaultSection />

      {/* Global Landing Footer */}
      <footer className="landing-global-footer">
        <div className="footer-inner-content">
          <div className="footer-top-row">
            <div className="footer-brand-col">
              <div className="landing-brand">
                <div className="brand-logo-mark">
                  <IconScan size={18} color="#ffffff" stroke={2.5} />
                </div>
                <span className="brand-title">Attendify</span>
              </div>
              <p className="footer-tagline">
                Automated biometric attendance intelligence for educational institutions. Designed for fast queues, high accuracy, and strict student data privacy.
              </p>
            </div>

            <div className="footer-links-col">
              <span className="footer-col-title">TECHNOLOGY</span>
              <a href="#pipeline">Real-Time Processing</a>
              <a href="#pipeline">High-Speed Lookup</a>
              <a href="#hardware">Multi-Device Mesh</a>
              <a href="#privacy">Anti-Spoofing & Liveness</a>
            </div>

            <div className="footer-links-col">
              <span className="footer-col-title">DATA PRIVACY</span>
              <a href="#privacy">Philippine DPA (RA 10173)</a>
              <a href="#privacy">Zero Photo Storage</a>
              <a href="#privacy">Secure Code Keys</a>
              <a href="#privacy">On-Premises Ready</a>
            </div>
          </div>

          <div className="footer-bottom-row">
            <span className="footer-legal">
              &copy; {new Date().getFullYear()} Attendify Inc. All rights reserved. Capstone Project.
            </span>
            <div className="footer-badges">
              <Badge variant="dot" color="teal">NPC DPA Compliant</Badge>
              <Badge variant="dot" color="blue">Secure In-Memory</Badge>
            </div>
          </div>
        </div>
      </footer>

      {/* Self-Service Campus Onboarding Modal */}
      <CampusOnboardingModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
      />
    </div>
  );
}
