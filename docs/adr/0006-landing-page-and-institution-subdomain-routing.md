# Professional Landing Page and Campus Slug / Subdomain Direct Routing

We decided to build a professional, non-promotional public landing page for Attendify alongside dedicated campus URL routing (`/cjc` or `cjc.attendify.app`) so institutions have direct, custom-branded portals for their students.

## Context
A generic root page either forces students to search through unnecessary marketing or leaves the platform without a public-facing presence. Furthermore, academic capstone defense requires grounded, professional terminology rather than unverified marketing hype (e.g., avoiding unproven "99.8% accuracy" claims).

## Considered Options
- **Marketing-Heavy Landing Page with Promotional Percentages**: Flashy claims of speed and precision. (Rejected: academically unverified and unsuited for thesis defense).
- **No Landing Page (Instant Redirect to Global Login)**: Root `/` redirects to login. (Rejected: provides no platform identity or explanation for new institutions).
- **Professional Academic Landing Page + Dedicated Campus Slug Routing (`/:institution_slug`)**:
  - The root domain presents a clean, professional institutional platform overview (system architecture, Data Privacy Act compliance, biometric pipeline).
  - Each institution is assigned a unique slug/code (e.g. `cjc`).
  - Visiting `/:slug` (e.g. `/cjc` or `cjc.domain.com`) directly loads that university's private, branded portal with their official logo, campus events, and direct login, bypassing the public landing page entirely. (Accepted).

## Consequences
- Students and faculty from a specific school have a direct link (e.g., `attendify.edu/cjc`) that looks and feels like their private campus portal.
- Multi-tenancy works cleanly in development (`localhost:5173/cjc`) and production with or without custom subdomains.
- Public landing page focuses on factual system capabilities (InsightFace Buffalo_L, FAISS vector indexing, Data Privacy Act compliance).
