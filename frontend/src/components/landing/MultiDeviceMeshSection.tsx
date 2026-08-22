import React, { useRef } from "react";
import {
  IconDeviceLaptop,
  IconDeviceMobile,
  IconQrcode,
  IconWalk,
  IconKey,
  IconShieldCheck,
  IconArrowsExchange,
} from "@tabler/icons-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export const MultiDeviceMeshSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const cards = [card1Ref.current, card2Ref.current, card3Ref.current];

      // Desktop (>= 769px): 3D Perspective Stagger & Holographic Mouse Tilt
      mm.add("(min-width: 769px)", () => {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 35, rotateX: 8, transformPerspective: 1000 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.7,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 75%",
              toggleActions: "play none none reverse",
            },
          }
        );

        const cleanups: (() => void)[] = [];

        cards.forEach((cardEl) => {
          if (!cardEl) return;

          gsap.set(cardEl, { transformPerspective: 1000, transformStyle: "preserve-3d" });

          const xTo = gsap.quickTo(cardEl, "rotateY", { duration: 0.3, ease: "power2.out" });
          const yTo = gsap.quickTo(cardEl, "rotateX", { duration: 0.3, ease: "power2.out" });
          const liftTo = gsap.quickTo(cardEl, "y", { duration: 0.3, ease: "power2.out" });
          const scaleTo = gsap.quickTo(cardEl, "scale", { duration: 0.3, ease: "power2.out" });

          const handleMouseMove = (e: MouseEvent) => {
            const rect = cardEl.getBoundingClientRect();
            const relX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
            const relY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);

            xTo(relX * 9);
            yTo(-relY * 9);
            liftTo(-10);
            scaleTo(1.03);
          };

          const handleMouseLeave = () => {
            xTo(0);
            yTo(0);
            liftTo(0);
            scaleTo(1);
          };

          cardEl.addEventListener("mousemove", handleMouseMove, { passive: true });
          cardEl.addEventListener("mouseleave", handleMouseLeave);

          cleanups.push(() => {
            cardEl.removeEventListener("mousemove", handleMouseMove);
            cardEl.removeEventListener("mouseleave", handleMouseLeave);
          });
        });

        // SVG Interconnect Line Draw on Scroll
        gsap.fromTo(
          ".mesh-network-line",
          { strokeDashoffset: 600 },
          {
            strokeDashoffset: 0,
            duration: 1.2,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
          }
        );

        return () => {
          cleanups.forEach((c) => c());
        };
      });

      // Mobile (<= 768px): Lightweight Simple Card Slide (Zero Tilt Overhead)
      mm.add("(max-width: 768px)", () => {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 85%",
              toggleActions: "play none none none",
              once: true,
            },
          }
        );
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id="hardware" className="device-mesh-section">
      <div className="section-header-center">
        <div className="section-eyebrow">
          <IconArrowsExchange size={14} />
          <span>HARDWARE FLEXIBILITY</span>
        </div>
        <h2 className="section-title">Deploy with Devices You Already Own</h2>
        <p className="section-subtitle">
          From high-traffic gymnasium entrances to classroom seminars, turn existing laptops, webcams, or smartphones into reliable check-in stations.
        </p>
      </div>

      <div className="device-mesh-container">
        {/* Animated SVG Interconnect Network Lines */}
        <svg className="mesh-network-svg" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 1000 100">
          <defs>
            <linearGradient id="meshGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <path
            d="M 160,50 C 330,20 330,80 500,50 C 670,20 670,80 840,50"
            fill="none"
            stroke="url(#meshGradient)"
            strokeWidth="2"
            strokeDasharray="6 4"
            className="mesh-network-line"
          />
        </svg>

        <div className="device-mesh-grid">
          {/* Card 1: Dedicated Entrance Kiosk */}
          <div ref={card1Ref} className="device-mesh-card card-kiosk">
            <div className="device-card-header">
              <div className="device-icon-pill icon-kiosk">
                <IconDeviceLaptop size={22} />
              </div>
              <span className="device-badge primary">MAIN ENTRANCE GATES</span>
            </div>

            <div className="device-mockup-frame laptop-frame">
              <div className="mockup-screen">
                <div className="mockup-camera-reticle" />
                <div className="mockup-hud-tags">
                  <span className="hud-tag-item">PASSIVE WALKING ACTIVE</span>
                  <span className="hud-tag-item">FPS: 30.0</span>
                </div>
              </div>
            </div>

            <h3 className="device-card-title">Dedicated Entrance Kiosks</h3>
            <p className="device-card-desc">
              Set up standard laptops or desktops with webcams at main venue doors. Students are identified seamlessly as they walk through, keeping entrance lines moving quickly.
            </p>

            <div className="device-feature-bullets">
              <div className="bullet-item">
                <IconWalk size={14} color="#3b82f6" />
                <span>Fast walking-pace check-ins</span>
              </div>
              <div className="bullet-item">
                <IconShieldCheck size={14} color="#3b82f6" />
                <span>Automated doorway focus & filtering</span>
              </div>
            </div>
          </div>

          {/* Card 2: Mobile Secondary Scanner */}
          <div ref={card2Ref} className="device-mesh-card card-mobile">
            <div className="device-card-header">
              <div className="device-icon-pill icon-mobile text-cyan">
                <IconDeviceMobile size={22} />
              </div>
              <span className="device-badge cyan">MOBILE MARSHAL MODE</span>
            </div>

            <div className="device-mockup-frame mobile-frame">
              <div className="mockup-mobile-screen">
                <div className="mobile-reticle" />
                <span className="otp-badge">OTP: 839-204</span>
              </div>
            </div>

            <h3 className="device-card-title">Mobile Handheld Scanners</h3>
            <p className="device-card-desc">
              Turn any smartphone into an authorized mobile scanner in seconds with a secure 6-digit code. Ideal for roaming marshals, side doors, or rapid line management.
            </p>

            <div className="device-feature-bullets">
              <div className="bullet-item">
                <IconKey size={14} color="#06b6d4" />
                <span>Instant 6-digit access code</span>
              </div>
              <div className="bullet-item">
                <IconDeviceMobile size={14} color="#06b6d4" />
                <span>No app install needed • Runs in mobile browser</span>
              </div>
            </div>
          </div>

          {/* Card 3: Contingency & Fallback Layer */}
          <div ref={card3Ref} className="device-mesh-card card-qr">
            <div className="device-card-header">
              <div className="device-icon-pill icon-qr text-emerald">
                <IconQrcode size={22} />
              </div>
              <span className="device-badge emerald">BACKUP & FALLBACK</span>
            </div>

            <div className="device-mockup-frame fallback-frame">
              <div className="mockup-qr-screen">
                <IconQrcode size={48} color="#10b981" />
                <span className="qr-status-tag">QR FALLBACK READY</span>
              </div>
            </div>

            <h3 className="device-card-title">QR Code & Manual Fallback</h3>
            <p className="device-card-desc">
              If a student wears heavy accessories, masks, or experiences adverse lighting, marshals can instantly scan their personal student QR pass or perform an audit-logged check-in.
            </p>

            <div className="device-feature-bullets">
              <div className="bullet-item">
                <IconQrcode size={14} color="#10b981" />
                <span>Personal digital student QR pass</span>
              </div>
              <div className="bullet-item">
                <IconShieldCheck size={14} color="#10b981" />
                <span>Instant fallback with full audit trail</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
