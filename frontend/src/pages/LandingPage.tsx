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
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getInstitutions(true);
        setInstitutions(data);
        if (data.length > 0) {
          setSelectedSlug(data[0].code);
        }
      } catch (err) {
        console.error("Failed to load institutions", err);
      }
    }
    loadData();
  }, []);

  // GSAP Entrance Timeline and Scroll Animations
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(".landing-nav", { y: -20, opacity: 0, duration: 0.6, clearProps: "all" })
        .from(".hero-badge", { y: 20, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.3")
        .from(".hero-title", { y: 30, opacity: 0, duration: 0.7, clearProps: "all" }, "-=0.3")
        .from(".hero-subtitle", { y: 20, opacity: 0, duration: 0.6, clearProps: "all" }, "-=0.4")
        .from(".hero-cta-group", { y: 20, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.3")
        .from(".hero-fast-campus-bar", { y: 15, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.3")
        .from(".hero-product-window-container", { y: 35, opacity: 0, duration: 0.8, clearProps: "all" }, "-=0.4");

      // Staggered reveal for campus directory cards on scroll
      gsap.from(".campus-directory-card", {
        y: 40,
        opacity: 0,
        duration: 0.7,
        stagger: 0.15,
        ease: "power2.out",
        scrollTrigger: {
          trigger: "#campuses",
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });
    },
    { scope: pageRef }
  );

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
            <a href="#privacy" className="nav-link-item">Privacy (DPA)</a>
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
              className="nav-btn-onboard"
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setModalOpened(true)}
              styles={{
                root: {
                  color: theme === "dark" ? "#a1a1a1" : "#4d4d4d",
                  fontWeight: 500,
                },
              }}
            >
              + Onboard Campus
            </Button>
            <Button
              className="nav-cta-primary"
              onClick={() => handleLaunchCampus("cjc")}
              rightSection={<IconArrowRight size={14} />}
            >
              Enter Campus
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
          {institutions.length > 0 && (
            <div className="hero-fast-campus-bar">
              <div className="campus-jump-capsule">
                <div className="campus-jump-label">
                  <IconBuildingArch size={15} className="jump-icon" />
                  <span>Portal Jump:</span>
                </div>
                <Select
                  size="xs"
                  placeholder="Search university or campus..."
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
                />
              </div>
            </div>
          )}

          {/* Hero Centerpiece: Interactive Telemetry Window */}
          <div className="hero-product-window-container">
            <HeroProductWindow />
          </div>
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

      {/* Luminous Section Divider */}
      <div className="section-luminous-divider" />

      {/* Participating Campuses Directory Section */}
      <section id="campuses" className="campuses-directory-section">
        <div className="section-header-center">
          <div className="section-eyebrow">
            <IconBuildingArch size={14} />
            <span>CAMPUS DIRECTORY</span>
          </div>
          <h2 className="section-title">Connected Campus Portals</h2>
          <p className="section-subtitle">
            Select your university to access your official student attendance portal, enroll your biometric profile, or launch entrance scanning gates.
          </p>
        </div>

        <div className="campuses-cards-grid">
          {/* Featured Pilot Campus: Cor Jesu College */}
          <div
            className="campus-directory-card featured"
            role="button"
            tabIndex={0}
            onClick={() => handleLaunchCampus("cjc")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleLaunchCampus("cjc");
            }}
          >
            <div className="campus-card-top">
              <div className="campus-avatar-box">
                <IconBuildingArch size={26} color="#0070f3" />
              </div>
              <Badge color="blue" variant="filled" size="sm" radius="sm">
                PILOT INSTITUTION
              </Badge>
            </div>

            <h3 className="campus-card-name">Cor Jesu College</h3>
            <span className="campus-card-slug">attendify.edu/cjc</span>
            <p className="campus-card-desc">
              Active production pilot deployment featuring automated gate scanners, multi-device marshal scanning, and real-time student check-in records.
            </p>

            <div className="campus-card-footer">
              <span className="footer-status text-emerald">&bull; System Online</span>
              <Button
                size="xs"
                variant="subtle"
                color="blue"
                rightSection={<IconArrowRight size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLaunchCampus("cjc");
                }}
              >
                Launch Portal
              </Button>
            </div>
          </div>

          {/* Sandbox Campus Card: Self-Service Registration */}
          <div
            className="campus-directory-card sandbox"
            role="button"
            tabIndex={0}
            onClick={() => setModalOpened(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setModalOpened(true);
            }}
          >
            <div className="campus-card-top">
              <div className="campus-avatar-box sandbox">
                <IconSparkles size={26} color="#9333ea" />
              </div>
              <Badge color="grape" variant="light" size="sm" radius="sm">
                SELF-SERVICE SETUP
              </Badge>
            </div>

            <h3 className="campus-card-name">Register Your University</h3>
            <span className="campus-card-slug purple">attendify.edu/[your-code]</span>
            <p className="campus-card-desc">
              Create an isolated attendance partition for your institution in under 2 minutes with automated database setup and custom branding.
            </p>

            <div className="campus-card-footer">
              <span className="footer-status text-purple">&bull; Instant Setup</span>
              <Button
                size="xs"
                variant="outline"
                color="grape"
                rightSection={<IconArrowRight size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  setModalOpened(true);
                }}
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

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
