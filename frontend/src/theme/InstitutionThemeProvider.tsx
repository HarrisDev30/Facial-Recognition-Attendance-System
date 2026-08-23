import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import { getInstitutionBySlug, getInstitutions } from "../api/institutions";
import type { InstitutionPublicResponse } from "../types/institution";
import { getTenantSlugFromHostname, isReservedSlug } from "../utils/tenant";

interface InstitutionThemeContextValue {
  institution: InstitutionPublicResponse | null;
  brandColor: string;
  brandGradient: string;
  brandContrastText: string;
  isLoading: boolean;
  refreshInstitution: () => Promise<void>;
}

const DEFAULT_BRAND_COLOR = "#0070f3"; // High-craft Vercel/Linear Blue fallback

const InstitutionThemeContext = createContext<InstitutionThemeContextValue>({
  institution: null,
  brandColor: DEFAULT_BRAND_COLOR,
  brandGradient: "linear-gradient(135deg, #0070f3 0%, #00dfd8 100%)",
  brandContrastText: "#ffffff",
  isLoading: false,
  refreshInstitution: async () => {},
});

// Helper: Convert Hex color to RGB triplet
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = (hex || DEFAULT_BRAND_COLOR).replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 0, g: 112, b: 243 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Helper: Calculate relative luminance to guarantee WCAG AA text contrast
export function getContrastTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // Calculate relative luminance based on sRGB
  const [lr, lg, lb] = [r, g, b].map((val) => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  return luminance > 0.45 ? "#0a0a0a" : "#ffffff";
}

// Helper: Generate a complementary gradient accent based on hue
export function generateBrandGradient(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // Shift slightly for secondary stop
  const r2 = Math.min(255, Math.floor(r * 0.7 + 50));
  const g2 = Math.min(255, Math.floor(g * 1.1 + 40));
  const b2 = Math.min(255, Math.floor(b * 1.2 + 60));
  return `linear-gradient(135deg, ${hex} 0%, rgb(${r2}, ${g2}, ${b2}) 100%)`;
}

// Injects computed CSS variables to documentElement
export function applyInstitutionCssVariables(brandHex: string, institutionCode?: string | null) {
  const { r, g, b } = hexToRgb(brandHex);
  const contrastText = getContrastTextColor(brandHex);
  const gradient = generateBrandGradient(brandHex);

  const root = document.documentElement;
  root.style.setProperty("--brand-primary", brandHex);
  root.style.setProperty("--brand-primary-rgb", `${r}, ${g}, ${b}`);
  root.style.setProperty("--brand-surface", `rgba(${r}, ${g}, ${b}, 0.08)`);
  root.style.setProperty("--brand-surface-subtle", `rgba(${r}, ${g}, ${b}, 0.04)`);
  root.style.setProperty("--brand-glow", `rgba(${r}, ${g}, ${b}, 0.22)`);
  root.style.setProperty("--brand-border", `rgba(${r}, ${g}, ${b}, 0.32)`);
  root.style.setProperty("--brand-border-strong", `rgba(${r}, ${g}, ${b}, 0.55)`);
  root.style.setProperty("--brand-gradient", gradient);
  root.style.setProperty("--brand-contrast-text", contrastText);

  if (institutionCode) {
    root.setAttribute("data-institution", institutionCode.toLowerCase());
  } else {
    root.removeAttribute("data-institution");
  }
}

export function InstitutionThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [institution, setInstitution] = useState<InstitutionPublicResponse | null>(() => {
    // Synchronous initial cache hydration
    try {
      const cached = sessionStorage.getItem("attendify_active_institution");
      if (cached) return JSON.parse(cached);
    } catch {
      // Ignore sessionStorage parsing errors
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Determine current active brand color
  const brandColor = useMemo(() => {
    return institution?.brand_color || DEFAULT_BRAND_COLOR;
  }, [institution]);

  const brandGradient = useMemo(() => {
    return generateBrandGradient(brandColor);
  }, [brandColor]);

  const brandContrastText = useMemo(() => {
    return getContrastTextColor(brandColor);
  }, [brandColor]);

  // Resolution logic for finding active institution
  const resolveInstitution = useCallback(async () => {
    // 1. If user is authenticated and has institution info
    if (user?.institution_code || user?.institution_id) {
      if (institution?.code?.toLowerCase() === user?.institution_code?.toLowerCase()) {
        return;
      }
      setIsLoading(true);
      try {
        if (user.institution_code) {
          const inst = await getInstitutionBySlug(user.institution_code.toLowerCase());
          setInstitution(inst);
          sessionStorage.setItem("attendify_active_institution", JSON.stringify(inst));
          return;
        }
      } catch {
        // Fallback: search in list
        try {
          const all = await getInstitutions(true);
          const found = all.find((i) => i.id === user.institution_id || i.code.toLowerCase() === user.institution_code?.toLowerCase());
          if (found) {
            setInstitution(found);
            sessionStorage.setItem("attendify_active_institution", JSON.stringify(found));
            return;
          }
        } catch {
          // Ignore
        }
      } finally {
        setIsLoading(false);
      }
    }

    // 2. If on a campus subdomain (e.g. cjc.attendify.app or cjc.localhost)
    const hostSlug = getTenantSlugFromHostname();
    if (hostSlug && !isReservedSlug(hostSlug)) {
      if (institution?.code?.toLowerCase() === hostSlug.toLowerCase()) return;
      setIsLoading(true);
      try {
        const inst = await getInstitutionBySlug(hostSlug.toLowerCase());
        setInstitution(inst);
        sessionStorage.setItem("attendify_active_institution", JSON.stringify(inst));
        return;
      } catch {
        // Ignore
      } finally {
        setIsLoading(false);
      }
    }

    // 3. If on a path-based slug (e.g. /cjc)
    const pathFirstPart = window.location.pathname.split("/")[1]?.toLowerCase();
    if (pathFirstPart && !isReservedSlug(pathFirstPart) && !user) {
      if (institution?.code?.toLowerCase() === pathFirstPart) return;
      setIsLoading(true);
      try {
        const inst = await getInstitutionBySlug(pathFirstPart);
        setInstitution(inst);
        sessionStorage.setItem("attendify_active_institution", JSON.stringify(inst));
        return;
      } catch {
        // Ignore
      } finally {
        setIsLoading(false);
      }
    }

    // 4. Default / Public
    if (!user && !hostSlug) {
      setInstitution(null);
      sessionStorage.removeItem("attendify_active_institution");
    }
  }, [user, institution?.code]);

  useEffect(() => {
    resolveInstitution();
  }, [resolveInstitution]);

  // Synchronize CSS variables with active brand color whenever it changes
  useEffect(() => {
    applyInstitutionCssVariables(brandColor, institution?.code);
  }, [brandColor, institution?.code]);

  return (
    <InstitutionThemeContext.Provider
      value={{
        institution,
        brandColor,
        brandGradient,
        brandContrastText,
        isLoading,
        refreshInstitution: resolveInstitution,
      }}
    >
      {children}
    </InstitutionThemeContext.Provider>
  );
}

export function useInstitutionTheme() {
  const context = useContext(InstitutionThemeContext);
  if (!context) {
    throw new Error("useInstitutionTheme must be used within an InstitutionThemeProvider");
  }
  return context;
}
