import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@mantine/core";
import {
  IconScan,
  IconArrowRight,
  IconBuildingArch,
  IconSparkles,
} from "@tabler/icons-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useGSAP } from "@gsap/react";

import { getInstitutions } from "../../api/institutions";
import type { InstitutionPublicResponse } from "../../types/institution";
import { InteractiveCampusCarousel } from "../../components/landing/InteractiveCampusCarousel";
import { ScrollPipelineSection } from "../../components/landing/ScrollPipelineSection";
import { HardwareCanvasSequence } from "../../components/landing/HardwareCanvasSequence";
import { PrivacyVaultSection } from "../../components/landing/PrivacyVaultSection";
import { CampusOnboardingModal } from "../../components/landing/CampusOnboardingModal";
import "./LandingPage.css";

gsap.registerPlugin(ScrollTrigger, useGSAP, ScrollToPlugin);

export default function LandingPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const [institutions, setInstitutions] = useState<InstitutionPublicResponse[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>("cjc");
  const [modalOpened, setModalOpened] = useState(false);

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
      tl.from(".landing-nav", {
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
        // 2. Hero Section Cascading Stagger (Clean Minimalist Focus)
        .from(".hero-title", { y: 22, opacity: 0, duration: 0.6, clearProps: "all" }, "-=0.25")
        .from(".hero-subtitle", { y: 16, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.35")
        .from(
          ".hero-portal-url-builder-wrapper",
          {
            y: 18,
            scale: 0.98,
            opacity: 0,
            duration: 0.55,
            ease: "power2.out",
            clearProps: "all",
          },
          "-=0.3",
        )
        .from(
          ".hero-enterprise-link-row",
          {
            y: 10,
            opacity: 0,
            duration: 0.4,
            clearProps: "all",
          },
          "-=0.25",
        );
    },
    { scope: pageRef },
  );

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();

    if (id === "hardware") {
      const st = ScrollTrigger.getById("hardware-trigger");
      if (st) {
        gsap.to(window, {
          scrollTo: { y: st.start + 2, autoKill: false },
          duration: 0.7,
          ease: "power2.out",
        });
        return;
      }
    }

    const el = document.getElementById(id);
    if (el) {
      gsap.to(window, {
        scrollTo: { y: el, offsetY: 72, autoKill: false },
        duration: 0.7,
        ease: "power2.out",
      });
    }
  };

  const scrollToCampuses = () => {
    const el = document.getElementById("campuses");
    if (el) {
      gsap.to(window, {
        scrollTo: { y: el, offsetY: 72, autoKill: false },
        duration: 0.7,
        ease: "power2.out",
      });
    }
  };

  const handleLaunchCampus = (slugToLaunch?: string) => {
    const raw = slugToLaunch || selectedSlug || "cjc";
    const clean = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "cjc";
    navigate(`/${clean}`);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLaunchCampus(selectedSlug || "cjc");
  };

  return (
    <div ref={pageRef} className="landing-root-container" data-theme="light">
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
            <a href="#pipeline" className="nav-link-item" onClick={(e) => scrollToSection(e, "pipeline")}>Pipeline</a>
            <a href="#hardware" className="nav-link-item" onClick={(e) => scrollToSection(e, "hardware")}>Scanners</a>
            <a href="#privacy" className="nav-link-item" onClick={(e) => scrollToSection(e, "privacy")}>Privacy</a>
            <a href="#campuses" className="nav-link-item" onClick={(e) => scrollToSection(e, "campuses")}>Campuses</a>
          </nav>

          {/* Right Action Cluster */}
          <div className="nav-actions-cluster">
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
          <h1 className="hero-title">
            Instant attendance.<br />Zero friction.
          </h1>

          <p className="hero-subtitle">
            Fast, effortless attendance verification for university events. Enter your campus code to jump directly into your institutional workspace.
          </p>

          {/* Concept 2: Interactive Portal URL Builder Capsule */}
          <div className="hero-portal-url-builder-wrapper">
            <form onSubmit={handleUrlSubmit} className="hero-portal-url-form">
              <div className="url-builder-capsule">
                <span className="url-prefix-label">attendify.app /</span>
                <input
                  type="text"
                  className="url-slug-input"
                  placeholder="enter campus code (e.g. cjc)"
                  value={selectedSlug || ""}
                  onChange={(e) => setSelectedSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  autoComplete="off"
                  spellCheck="false"
                />
                <Button
                  type="submit"
                  className="url-jump-submit-btn"
                  size="sm"
                  rightSection={<IconArrowRight size={15} />}
                >
                  Jump ↗
                </Button>
              </div>
            </form>

            {/* Quick Suggestions & Enterprise Request Trigger */}
            <div className="hero-enterprise-link-row">
              <span className="quick-tags-label">Quick Jump:</span>
              <button
                type="button"
                className="quick-campus-tag"
                onClick={() => handleLaunchCampus("cjc")}
              >
                CJC (Cor Jesu)
              </button>
              {institutions
                .filter((inst) => inst.code !== "cjc")
                .slice(0, 2)
                .map((inst) => (
                  <button
                    key={inst.code}
                    type="button"
                    className="quick-campus-tag"
                    onClick={() => handleLaunchCampus(inst.code)}
                  >
                    {inst.code.toUpperCase()}
                  </button>
                ))}
              <span className="quick-tag-divider">&bull;</span>
              <button
                type="button"
                className="hero-btn-request-access"
                onClick={() => setModalOpened(true)}
              >
                <IconSparkles size={14} />
                <span>Request Institutional Access</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 🏛️ Interactive Campus Showcase (Gliding tactile passes below Hero) */}
      <InteractiveCampusCarousel
        institutions={institutions}
        onOnboardClick={() => setModalOpened(true)}
      />

      {/* 4-Stage Biometric Processing Pipeline (GSAP ScrollTrigger Pinned Section) */}
      <ScrollPipelineSection />

      {/* Hardware Freedom: 240-Frame Dual-Canvas Scroll Showroom */}
      <HardwareCanvasSequence />

      {/* Privacy Vault Section */}
      <PrivacyVaultSection />

      {/* Global Landing Footer (Minimal, Quiet, Slop-Free) */}
      <footer className="landing-global-footer">
        <div className="footer-inner-content">
          <div className="footer-simple-layout">
            <div className="footer-brand-side">
              <Link to="/" className="landing-brand">
                <div className="brand-logo-mark">
                  <IconScan size={18} color="#ffffff" stroke={2.5} />
                </div>
                <span className="brand-title">Attendify</span>
                <span className="brand-version-badge">v2.0</span>
              </Link>
              <p className="footer-simple-note">
                Frictionless campus attendance & clearance.
              </p>
            </div>

            <nav className="footer-simple-nav">
              <a href="#pipeline" onClick={(e) => scrollToSection(e, "pipeline")}>Pipeline</a>
              <a href="#hardware" onClick={(e) => scrollToSection(e, "hardware")}>Scanners</a>
              <a href="#privacy" onClick={(e) => scrollToSection(e, "privacy")}>Privacy</a>
              <a href="#campuses" onClick={(e) => scrollToSection(e, "campuses")}>Campuses</a>
              <Link to="/login">Sign In</Link>
              <Link to="/privacy">Privacy Policy</Link>
            </nav>
          </div>

          <div className="footer-bottom-simple">
            <span className="footer-legal">
              &copy; {new Date().getFullYear()} Attendify. All rights reserved.
            </span>
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
