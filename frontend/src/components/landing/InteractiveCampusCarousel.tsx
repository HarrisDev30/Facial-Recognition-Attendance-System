import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@mantine/core";
import {
  IconBuildingArch,
  IconArrowRight,
  IconSparkles,
  IconRosetteDiscountCheckFilled,
  IconSearch,
  IconX,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { InstitutionPublicResponse } from "../../types/institution";
import "./InteractiveCampusCarousel.css";

interface Props {
  institutions: InstitutionPublicResponse[];
  onOnboardClick: () => void;
}

export function InteractiveCampusCarousel({ institutions, onOnboardClick }: Props) {
  const navigate = useNavigate();
  const carouselContainerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = searchQuery.trim().length > 0;

  // Filtered institutions for search mode
  const filteredInstitutions = institutions.filter(
    (inst) =>
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Base list for a single complete marquee set (replicated if count is low to ensure wide density)
  const baseList = useMemo(() => {
    if (institutions.length === 0) return [];
    const reps = Math.max(1, Math.ceil(4 / institutions.length));
    const list: InstitutionPublicResponse[] = [];
    for (let i = 0; i < reps; i++) {
      list.push(...institutions);
    }
    return list;
  }, [institutions]);

  // Continuous Fluid Physics & Gesture State
  const posRef = useRef(0);
  const targetSpeedRef = useRef(-0.75); // Normal passive speed
  const currentSpeedRef = useRef(-0.75);
  const isPointerDown = useRef(false);
  const startX = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocityRef = useRef(0);
  const dragDistance = useRef(0);
  const isVisibleRef = useRef(true);

  const handleLaunch = (code: string, institution: InstitutionPublicResponse) => {
    if (dragDistance.current > 6) return; // Ignore click if user was scrubbing/dragging
    navigate(`/${code.toLowerCase()}`, { state: { institution } });
  };

  const getSetWidth = () => {
    if (!setRef.current) return 0;
    return setRef.current.offsetWidth + 20; // Exact width of Set A + 20px inter-set gap
  };

  // GSAP 60fps Continuous Fluid Engine with Exact Clone Mathematical Wrap
  useGSAP(
    () => {
      if (!trackRef.current || baseList.length === 0 || isSearching) return;

      const track = trackRef.current;

      const updateTicker = () => {
        if (isSearching || !track || !isVisibleRef.current) return;

        const setWidth = getSetWidth();
        if (setWidth <= 0) return;

        if (isPointerDown.current) {
          // Direct tracking happens in pointermove handler
        } else {
          // Inertial velocity decay handoff
          if (Math.abs(velocityRef.current) > 0.05) {
            posRef.current += velocityRef.current;
            velocityRef.current *= 0.92; // Silky fluid decay
          } else {
            // Smoothly interpolate current speed towards target speed
            currentSpeedRef.current +=
              (targetSpeedRef.current - currentSpeedRef.current) * 0.08;
            posRef.current += currentSpeedRef.current;
          }
        }

        // Exact Seamless Clone Wrap (Zero mathematical error, zero jump!)
        while (posRef.current <= -setWidth) {
          posRef.current += setWidth;
        }
        while (posRef.current > 0) {
          posRef.current -= setWidth;
        }

        gsap.set(track, { x: posRef.current });
      };

      gsap.ticker.add(updateTicker);

      // Robust IntersectionObserver with generous 300px margin (works seamlessly on mobile & DevTools resize)
      let observer: IntersectionObserver | null = null;
      if (carouselContainerRef.current && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            isVisibleRef.current = entry.isIntersecting;
          },
          { rootMargin: "300px 0px 300px 0px" },
        );
        observer.observe(carouselContainerRef.current);
      }

      return () => {
        gsap.ticker.remove(updateTicker);
        if (observer) observer.disconnect();
      };
    },
    { scope: carouselContainerRef, dependencies: [baseList.length, isSearching] },
  );

  // Smooth hover deceleration (slows down to a gentle readable pace)
  const handleMouseEnter = () => {
    if (!isSearching && !isPointerDown.current) {
      targetSpeedRef.current = -0.15;
    }
  };

  const handleMouseLeave = () => {
    if (!isSearching && !isPointerDown.current) {
      targetSpeedRef.current = -0.75;
    }
  };

  // 1:1 Tactile Pointer Drag Handling
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSearching || !trackRef.current) return;
    isPointerDown.current = true;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastTime.current = performance.now();
    velocityRef.current = 0;
    dragDistance.current = 0;

    trackRef.current.classList.add("is-dragging");
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown.current || !trackRef.current) return;

    const deltaX = e.clientX - lastX.current;
    const now = performance.now();
    const dt = Math.max(1, now - lastTime.current);

    // Calculate instantaneous release velocity
    velocityRef.current = (deltaX / dt) * 16;
    lastX.current = e.clientX;
    lastTime.current = now;

    dragDistance.current += Math.abs(deltaX);
    posRef.current += deltaX;

    const setWidth = getSetWidth();
    if (setWidth > 0) {
      while (posRef.current <= -setWidth) posRef.current += setWidth;
      while (posRef.current > 0) posRef.current -= setWidth;
    }

    gsap.set(trackRef.current, { x: posRef.current });
  };

  const handlePointerUp = () => {
    if (!isPointerDown.current || !trackRef.current) return;
    isPointerDown.current = false;
    trackRef.current.classList.remove("is-dragging");
  };

  // Step Chevrons (Left / Right Nudge with Spring Physics)
  const handleStep = (direction: "left" | "right") => {
    if (!trackRef.current || isSearching) return;
    const stepDelta = direction === "left" ? 340 : -340;

    gsap.to(posRef, {
      current: posRef.current + stepDelta,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        if (!trackRef.current) return;
        const setWidth = getSetWidth();
        if (setWidth > 0) {
          while (posRef.current <= -setWidth) posRef.current += setWidth;
          while (posRef.current > 0) posRef.current -= setWidth;
        }
        gsap.set(trackRef.current, { x: posRef.current });
      },
    });
  };

  const renderCampusCard = (
    inst: InstitutionPublicResponse,
    key: string,
    isSearchResult = false,
  ) => {
    const brandColor = inst.brand_color || "#0070f3";

    return (
      <div
        key={key}
        className={`campus-pass-card ${isSearchResult ? "is-search-result" : ""}`}
        style={{ "--pass-brand": brandColor } as React.CSSProperties}
        onClick={() => handleLaunch(inst.code, inst)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleLaunch(inst.code, inst);
        }}
      >
        <div className="pass-header-row">
          <div className="pass-crest-box">
            {inst.logo_url ? (
              <img src={inst.logo_url} alt={inst.name} className="pass-crest-img" />
            ) : (
              <div className="pass-monogram">
                <span>{inst.code.slice(0, 3).toUpperCase()}</span>
              </div>
            )}
          </div>

          <div className="pass-status-pill">
            <span className="pulse-dot" />
            <span>Active Node</span>
          </div>
        </div>

        <div className="pass-body">
          <div className="pass-verified-tag">
            <IconRosetteDiscountCheckFilled size={13} color="var(--pass-brand)" />
            <span>Verified Partition</span>
          </div>
          <h3 className="pass-univ-name">{inst.name}</h3>
          <span className="pass-univ-slug">
            attendify.app/<strong>{inst.code.toLowerCase()}</strong>
          </span>
        </div>

        <div className="pass-footer-action">
          <span className="pass-cta-label">Launch Portal</span>
          <div className="pass-arrow-icon">
            <IconArrowRight size={15} />
          </div>
        </div>
      </div>
    );
  };

  const renderOnboardCard = (key: string) => (
    <div
      key={key}
      className="campus-pass-card pass-onboard-card"
      onClick={() => {
        if (dragDistance.current <= 6) onOnboardClick();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOnboardClick();
      }}
    >
      <div className="pass-header-row">
        <div className="pass-crest-box onboard">
          <IconSparkles size={24} color="#a855f7" />
        </div>
        <Badge variant="light" color="grape" size="xs">
          INSTANT SETUP
        </Badge>
      </div>

      <div className="pass-body">
        <span className="pass-verified-tag purple">
          <span>Self-Service Provisioning</span>
        </span>
        <h3 className="pass-univ-name">Register Your University</h3>
        <span className="pass-univ-slug">
          attendify.app/<strong>[your-code]</strong>
        </span>
      </div>

      <div className="pass-footer-action onboard">
        <span className="pass-cta-label">Onboard Campus</span>
        <div className="pass-arrow-icon">
          <IconArrowRight size={15} />
        </div>
      </div>
    </div>
  );

  return (
    <section id="campuses" ref={carouselContainerRef} className="campus-showcase-section">
      <div className="section-header-center">
        <div className="section-eyebrow">
          <IconBuildingArch size={14} />
          <span>ACTIVE CAMPUS NETWORK</span>
        </div>
        <h2 className="section-title">Connected University Portals</h2>
        <p className="section-subtitle">
          Select your institution to access real-time attendance logging, enroll student biometrics, or launch scanner gates.
        </p>

        {/* 🔍 Integrated Search & Navigation Bar */}
        <div className="campus-search-toolbar">
          <div className="campus-search-capsule">
            <IconSearch size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search university by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="campus-search-input"
              aria-label="Search campus portals"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <IconX size={14} />
              </button>
            )}
            <div className="campus-count-badge">
              <span className="count-num">
                {isSearching ? filteredInstitutions.length : institutions.length}
              </span>
              <span className="count-label">
                {isSearching
                  ? " found"
                  : ` Active ${institutions.length === 1 ? "Campus" : "Campuses"}`}
              </span>
            </div>
          </div>

          {/* Desktop Chevrons */}
          {!isSearching && (
            <div className="campus-nav-chevrons">
              <button
                className="chevron-btn"
                onClick={() => handleStep("left")}
                title="Scroll Previous"
                aria-label="Scroll left"
              >
                <IconChevronLeft size={16} />
              </button>
              <button
                className="chevron-btn"
                onClick={() => handleStep("right")}
                title="Scroll Next"
                aria-label="Scroll right"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Search Results Mode ─── */}
      {isSearching ? (
        <div className="campus-search-results-grid">
          {filteredInstitutions.length > 0 ? (
            filteredInstitutions.map((inst) =>
              renderCampusCard(inst, `search-${inst.id}`, true),
            )
          ) : (
            <div className="campus-empty-search-card">
              <div className="empty-icon-box">
                <IconSparkles size={28} color="#a855f7" />
              </div>
              <h3 className="empty-title">University not listed yet?</h3>
              <p className="empty-desc">
                "{searchQuery}" doesn't have an active partition yet. You can provision a self-service tenant in under 2 minutes.
              </p>
              <button className="empty-action-btn" onClick={onOnboardClick}>
                + Onboard "{searchQuery}" Now
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ─── Continuous Marquee & Scrub Track Mode ─── */
        <div
          className="carousel-marquee-wrapper"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div ref={trackRef} className="carousel-marquee-track">
            {/* Primary Set A */}
            <div ref={setRef} className="marquee-set">
              {baseList.map((inst: InstitutionPublicResponse, idx: number) =>
                renderCampusCard(inst, `setA-${inst.id}-${idx}`),
              )}
              {renderOnboardCard("onboard-a")}
            </div>

            {/* Cloned Set B for 100% Mathematically Invisible Seamless Loop */}
            <div className="marquee-set" aria-hidden="true">
              {baseList.map((inst: InstitutionPublicResponse, idx: number) =>
                renderCampusCard(inst, `setB-${inst.id}-${idx}`),
              )}
              {renderOnboardCard("onboard-b")}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
