/**
 * Extracts the institution tenant slug from the current URL.
 * Supports:
 * 1. Subdomains: "cjc.attendify.app" -> "cjc"
 * 2. Localhost subdomains: "cjc.localhost:5173" -> "cjc"
 * 3. Path-based slugs: "attendify.app/cjc" -> "cjc" (when path matches an institution route)
 */
const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "super-admin",
  "marshal",
  "student",
  "scanner",
  "login",
  "register",
  "profile",
  "privacy",
  "www",
  "app",
  "auth",
  "static",
  "assets",
]);

export function getTenantSlugFromHostname(): string | null {
  const hostname = window.location.hostname.toLowerCase();
  
  // Exclude direct IP addresses or plain "localhost"
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === "localhost") {
    return null;
  }

  const parts = hostname.split(".");
  
  // e.g. "cjc.localhost" (length 2) or "cjc.attendify.app" (length 3)
  if (parts.length >= 2) {
    const candidate = parts[0];
    if (!RESERVED_SLUGS.has(candidate) && /^[a-z0-9_-]+$/.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase().trim());
}
