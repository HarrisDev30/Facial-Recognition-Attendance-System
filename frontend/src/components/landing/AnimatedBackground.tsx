import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface AnimatedBackgroundProps {
  theme?: "light" | "dark";
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ theme = "dark" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const parallaxOrbsRef = useRef<HTMLDivElement>(null);
  const heroLayerRef = useRef<HTMLDivElement>(null);
  const pipelineLayerRef = useRef<HTMLDivElement>(null);
  const hardwareLayerRef = useRef<HTMLDivElement>(null);
  const privacyLayerRef = useRef<HTMLDivElement>(null);
  const campusesLayerRef = useRef<HTMLDivElement>(null);

  // 1. Fluid Velocity-Deforming Liquid Aura & Mouse Parallax (Desktop Only)
  useGSAP(
    () => {
      if (!spotlightRef.current || !parallaxOrbsRef.current) return;

      const mm = gsap.matchMedia();

      // Only enable high-frequency cursor tracking on desktop screens
      mm.add("(min-width: 769px)", () => {
        if (!spotlightRef.current || !parallaxOrbsRef.current) return;

        // Position quickTo tweens
        const posX = gsap.quickTo(spotlightRef.current, "x", { duration: 0.6, ease: "power2.out" });
        const posY = gsap.quickTo(spotlightRef.current, "y", { duration: 0.6, ease: "power2.out" });

        // Fluid Stretch & Velocity Deformation quickTo tweens
        const scaleXTo = gsap.quickTo(spotlightRef.current, "scaleX", { duration: 0.35, ease: "power2.out" });
        const scaleYTo = gsap.quickTo(spotlightRef.current, "scaleY", { duration: 0.35, ease: "power2.out" });
        const rotTo = gsap.quickTo(spotlightRef.current, "rotation", { duration: 0.4, ease: "power2.out" });

        // Parallax Orbs quickTo tweens
        const orbX = gsap.quickTo(parallaxOrbsRef.current, "x", { duration: 0.9, ease: "power2.out" });
        const orbY = gsap.quickTo(parallaxOrbsRef.current, "y", { duration: 0.9, ease: "power2.out" });

        let lastX = 0;
        let lastY = 0;
        let isVisible = false;

        const handleMouseMove = (e: MouseEvent) => {
          if (!isVisible && spotlightRef.current) {
            isVisible = true;
            gsap.to(spotlightRef.current, { opacity: 1, duration: 0.3, overwrite: "auto" });
          }

          const currentX = e.clientX;
          const currentY = e.clientY;

          // Calculate velocity delta
          const dx = currentX - lastX;
          const dy = currentY - lastY;
          const speed = Math.min(Math.sqrt(dx * dx + dy * dy), 80);

          lastX = currentX;
          lastY = currentY;

          // 1. Position tracking
          posX(currentX);
          posY(currentY);

          // 2. Fluid liquid velocity deformation
          if (speed > 2) {
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const stretch = Math.min(1 + speed * 0.005, 1.35);
            const squash = Math.max(1 - speed * 0.0025, 0.8);

            rotTo(angle);
            scaleXTo(stretch);
            scaleYTo(squash);
          } else {
            scaleXTo(1);
            scaleYTo(1);
          }

          // 3. 3D Parallax drift on background layers
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          const deltaX = (currentX - centerX) * -0.02;
          const deltaY = (currentY - centerY) * -0.02;

          orbX(deltaX);
          orbY(deltaY);
        };

        const handleMouseLeave = () => {
          isVisible = false;
          if (spotlightRef.current) {
            gsap.to(spotlightRef.current, { opacity: 0, duration: 0.4, overwrite: "auto" });
          }
        };

        const handleMouseEnter = () => {
          isVisible = true;
          if (spotlightRef.current) {
            gsap.to(spotlightRef.current, { opacity: 1, duration: 0.3, overwrite: "auto" });
          }
        };

        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        document.addEventListener("mouseleave", handleMouseLeave);
        document.addEventListener("mouseenter", handleMouseEnter);

        return () => {
          window.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseleave", handleMouseLeave);
          document.removeEventListener("mouseenter", handleMouseEnter);
        };
      });
    },
    { scope: containerRef }
  );

  // 2. Liquid-Smooth GSAP Scroll Timelines across sections (Both Desktop & Mobile)
  useGSAP(
    () => {
      const hero = document.querySelector(".hero-section");
      const pipeline = document.getElementById("pipeline");
      const hardware = document.getElementById("hardware");
      const privacy = document.getElementById("privacy");
      const campuses = document.getElementById("campuses");
      const footer = document.querySelector(".landing-global-footer");

      // 1. Hero Atmosphere: Smooth fade out on scroll
      if (heroLayerRef.current && hero) {
        gsap.fromTo(
          heroLayerRef.current,
          { opacity: 1, y: 0 },
          {
            opacity: 0,
            y: -40,
            ease: "none",
            force3D: true,
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "bottom top",
              scrub: 0.5,
              invalidateOnRefresh: true,
            },
          }
        );
      }

      // 2. Pipeline Atmosphere: Unified In-Out Timeline
      if (pipelineLayerRef.current && pipeline) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pipeline,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(
          pipelineLayerRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power1.inOut", force3D: true }
        )
          .to(pipelineLayerRef.current, { opacity: 1, duration: 0.2 })
          .to(pipelineLayerRef.current, {
            opacity: 0,
            y: -30,
            duration: 0.4,
            ease: "power1.inOut",
            force3D: true,
          });
      }

      // 3. Hardware Mesh Atmosphere: Unified In-Out Timeline
      if (hardwareLayerRef.current && hardware) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: hardware,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(
          hardwareLayerRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power1.inOut", force3D: true }
        )
          .to(hardwareLayerRef.current, { opacity: 1, duration: 0.2 })
          .to(hardwareLayerRef.current, {
            opacity: 0,
            y: -30,
            duration: 0.4,
            ease: "power1.inOut",
            force3D: true,
          });
      }

      // 4. Privacy Vault Atmosphere: Unified In-Out Timeline
      if (privacyLayerRef.current && privacy) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: privacy,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(
          privacyLayerRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power1.inOut", force3D: true }
        )
          .to(privacyLayerRef.current, { opacity: 1, duration: 0.2 })
          .to(privacyLayerRef.current, {
            opacity: 0,
            y: -30,
            duration: 0.4,
            ease: "power1.inOut",
            force3D: true,
          });
      }

      // 5. Campuses Atmosphere: Smooth In & Sustain Timeline
      if (campusesLayerRef.current && campuses) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: campuses,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(
          campusesLayerRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power1.inOut", force3D: true }
        )
          .to(campusesLayerRef.current, { opacity: 1, duration: 0.4 })
          .to(campusesLayerRef.current, {
            opacity: 0.2,
            y: -20,
            duration: 0.4,
            ease: "power1.inOut",
            force3D: true,
          });
      }

      // 6. Subtle Parallax Orbs Dim at Footer (Keeps cursor spotlight & grid fully active)
      if (parallaxOrbsRef.current && footer) {
        gsap.to(parallaxOrbsRef.current, {
          opacity: 0.15,
          ease: "none",
          force3D: true,
          scrollTrigger: {
            trigger: footer,
            start: "top 95%",
            end: "top 60%",
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        });
      }
    },
    { dependencies: [theme] }
  );

  return (
    <div ref={containerRef} className="animated-bg-container" aria-hidden="true">
      {/* Subtle Coordinate Grid Overlay */}
      <div className="bg-grid-overlay" />

      {/* Fluid Liquid Aura (Velocity-deforming organic shimmer) */}
      <div ref={spotlightRef} className="cursor-fluid-liquid-aura">
        <div className="fluid-inner-core" />
        <div className="fluid-outer-glow" />
      </div>

      {/* Parallax Orbs Wrapper (drifts gently with mouse movement) */}
      <div ref={parallaxOrbsRef} className="parallax-orbs-wrapper">
        {/* Layer 1: Hero Atmosphere */}
        <div ref={heroLayerRef} className="bg-section-layer bg-layer-hero">
          <div className="mesh-orb hero-orb-1" />
          <div className="mesh-orb hero-orb-2" />
          <div className="mesh-orb hero-orb-3" />
        </div>

        {/* Layer 2: Pipeline Atmosphere */}
        <div ref={pipelineLayerRef} className="bg-section-layer bg-layer-pipeline">
          <div className="mesh-orb pipeline-orb-hud" />
        </div>

        {/* Layer 3: Hardware Mesh Atmosphere */}
        <div ref={hardwareLayerRef} className="bg-section-layer bg-layer-hardware">
          <div className="mesh-orb hardware-orb-left" />
          <div className="mesh-orb hardware-orb-right" />
        </div>

        {/* Layer 4: Privacy Vault Atmosphere */}
        <div ref={privacyLayerRef} className="bg-section-layer bg-layer-privacy">
          <div className="mesh-orb privacy-orb-center" />
          <div className="mesh-orb privacy-orb-glow" />
        </div>

        {/* Layer 5: Campuses Atmosphere */}
        <div ref={campusesLayerRef} className="bg-section-layer bg-layer-campuses">
          <div className="mesh-orb campuses-orb-center" />
        </div>
      </div>
    </div>
  );
};
