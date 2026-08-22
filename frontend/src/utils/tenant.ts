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

const PLATFORM_DOMAINS = [
  "vercel.app",
  "now.sh",
  "netlify.app",
  "onrender.com",
  "pages.dev",
  "railway.app",
  "herokuapp.com",
  "github.io",
  "surge.sh",
  "ngrok-free.app",
  "ngrok.io",
  "loca.lt",
];

export function getTenantSlugFromHostname(): string | null {
  const hostname = window.location.hostname.toLowerCase();

  // Exclude direct IP addresses or plain "localhost"
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === "localhost") {
    return null;
  }

  // Handle localhost subdomains: "cjc.localhost" (length 2)
  if (hostname.endsWith(".localhost")) {
    const parts = hostname.split(".");
    if (parts.length === 2) {
      const candidate = parts[0];
      if (!RESERVED_SLUGS.has(candidate) && /^[a-z0-9_-]+$/.test(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  // Handle public platform domains (e.g. *.vercel.app, *.netlify.app)
  for (const plat of PLATFORM_DOMAINS) {
    if (hostname.endsWith("." + plat)) {
      // e.g. "my-project.vercel.app" -> hostWithoutPlat = "my-project"
      const hostWithoutPlat = hostname.slice(0, -(plat.length + 1));
      const subParts = hostWithoutPlat.split(".");
      // If there is a nested subdomain e.g. "cjc.my-project.vercel.app" -> subParts = ["cjc", "my-project"]
      if (subParts.length > 1) {
        const candidate = subParts[0];
        if (!RESERVED_SLUGS.has(candidate) && /^[a-z0-9_-]+$/.test(candidate)) {
          return candidate;
        }
      }
      return null;
    }
  }

  // Handle custom domain subdomains (e.g. "cjc.attendify.app", "cjc.attendify.edu.ph")
  const parts = hostname.split(".");
  if (parts.length === 3) {
    const candidate = parts[0];
    if (!RESERVED_SLUGS.has(candidate) && /^[a-z0-9_-]+$/.test(candidate)) {
      return candidate;
    }
  } else if (parts.length >= 4) {
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
