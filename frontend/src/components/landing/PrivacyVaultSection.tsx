import React, { useRef } from "react";
import {
  IconShieldLock,
  IconDatabaseOff,
  IconUserCheck,
  IconTrashX,
  IconServer,
  IconShieldCheck,
  IconRosetteDiscountCheckFilled,
} from "@tabler/icons-react";
import { Badge } from "@mantine/core";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export const PrivacyVaultSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const shieldPathRef = useRef<SVGPathElement>(null);

  useGSAP(
    () => {
      // 1. Animated SVG Shield Outline Draw on Scroll
      if (shieldPathRef.current) {
        const length = shieldPathRef.current.getTotalLength();
        gsap.set(shieldPathRef.current, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });

        gsap.to(shieldPathRef.current, {
          strokeDashoffset: 0,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
        });
      }

      // 2. Card Fan-Out Dealing Animation
      const cards = gsap.utils.toArray<HTMLElement>(".privacy-pillar-card");
      const fanAngles = [-3, -1, 1, 3];

      cards.forEach((card, i) => {
        gsap.fromTo(
          card,
          {
            opacity: 0,
            y: 40,
            rotation: fanAngles[i] || 0,
            scale: 0.95,
          },
          {
            opacity: 1,
            y: 0,
            rotation: 0,
            scale: 1,
            duration: 0.7,
            delay: i * 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // 3. Scanline sweep on trust seal bar
      gsap.fromTo(
        ".privacy-trust-seal-bar",
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay: 0.4,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 65%",
            toggleActions: "play none none reverse",
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id="privacy" className="privacy-vault-section">
      <div className="section-header-center">
        {/* Animated Security Vault Shield Emblem */}
        <div className="vault-shield-emblem">
          <svg className="vault-shield-svg" width="48" height="54" viewBox="0 0 48 54" fill="none">
            <path
              ref={shieldPathRef}
              d="M24 3L6 11V25C6 37 14 47 24 51C34 47 42 37 42 25V11L24 3Z"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="24" r="6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="section-eyebrow">
          <IconShieldLock size={14} />
          <span>DATA PRIVACY ACT OF 2012 COMPLIANT (RA 10173)</span>
        </div>
        <h2 className="section-title">Student Privacy by Design</h2>
        <p className="section-subtitle">
          Engineered from the ground up to protect student identity and data rights. We store mathematical code keys, never permanent facial photos.
        </p>
      </div>

      <div className="privacy-pillars-grid">
        {/* Pillar 1 */}
        <div className="privacy-pillar-card">
          <div className="pillar-icon-wrapper cyan">
            <IconDatabaseOff size={24} />
          </div>
          <h4 className="pillar-title">Zero Raw Photos on Disk</h4>
          <p className="pillar-desc">
            Camera video is processed in temporary server memory and discarded instantly. No facial pictures or video recordings are ever stored on database drives.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="privacy-pillar-card">
          <div className="pillar-icon-wrapper emerald">
            <IconUserCheck size={24} />
          </div>
          <h4 className="pillar-title">Explicit Informed Consent</h4>
          <p className="pillar-desc">
            Biometric enrollment is 100% voluntary and authenticated with an official institutional student ID and transparent privacy agreements.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="privacy-pillar-card">
          <div className="pillar-icon-wrapper rose">
            <IconTrashX size={24} />
          </div>
          <h4 className="pillar-title">Complete Right to Erasure</h4>
          <p className="pillar-desc">
            Students have full control to remove their biometric profile from the university database at any time with a single click in their student portal.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="privacy-pillar-card">
          <div className="pillar-icon-wrapper purple">
            <IconServer size={24} />
          </div>
          <h4 className="pillar-title">On-Premises Campus Server Ready</h4>
          <p className="pillar-desc">
            The platform can run entirely within the university's local network, ensuring student data stays on campus servers without relying on third-party cloud vendors.
          </p>
        </div>
      </div>

      {/* Regulatory Trust Seal Card */}
      <div className="privacy-trust-seal-bar">
        <div className="seal-scanline" />
        <div className="seal-left">
          <div className="seal-icon-badge">
            <IconShieldCheck size={26} />
          </div>
          <div className="seal-text-group">
            <div className="seal-heading-row">
              <span className="seal-heading">Philippine National Privacy Commission (NPC) Standards</span>
              <IconRosetteDiscountCheckFilled size={18} color="#10b981" />
            </div>
            <span className="seal-sub">
              Engineered in strict accordance with Republic Act No. 10173 (Data Privacy Act of 2012) — featuring
              strict data minimization, ephemeral in-memory processing, and transparent student data control.
            </span>
          </div>
        </div>
        <div className="seal-badges-group">
          <Badge variant="light" color="teal" size="sm" radius="sm">
            RA 10173
          </Badge>
          <Badge variant="filled" color="teal" size="sm" radius="sm">
            NPC DPA COMPLIANT
          </Badge>
        </div>
      </div>
    </section>
  );
};
