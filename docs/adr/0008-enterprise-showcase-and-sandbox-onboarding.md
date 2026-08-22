# Enterprise Showcase and Sandbox Onboarding Gateway

We decided to structure the root public landing page as a high-fidelity enterprise showcase featuring a GSAP-choreographed Biometric Processing Pipeline timeline, a live interactive telemetry product window, and a 1-click ephemeral Sandbox Campus (`/demo`) for external university evaluation.

## Context
Visiting evaluators, prospective university coordinators, and capstone review panels need to inspect the system's server-side biometrics and multi-tenant capabilities immediately without creating real database records or undergoing administrative credential provisioning. At the same time, existing students and marshals need direct, instant navigation to their campus portal.

## Considered Options
- **Static Text & Brochure Landing Page**: Minimal text with static screenshot images. (Rejected: fails to convey real-time server-side computer vision dynamics and FAISS matching latency).
- **Mandatory Registration Before Demo**: Requiring university administrators to fill out full verification forms prior to accessing any system UI. (Rejected: introduces heavy friction that deters evaluation).
- **Enterprise Showcase with GSAP Pinned Pipeline + 1-Click Sandbox Campus**:
  - Hero features a 3-tab live telemetry product mockup (Scanner viewport, Session pulse graph, Vector visualizer).
  - Pinned scroll section choreographs the 4-stage verification lifecycle (OpenCV -> InsightFace -> FAISS -> Cooldown logging).
  - 1-click "Explore Sandbox Campus" opens `/demo` with mock events and attendee vector indices.
  - Multi-campus switcher and self-service onboarding modal for new institutions. (Accepted).

## Consequences
- Prospective universities can evaluate scanner performance and administrative dashboards in seconds.
- High-contrast Vercel-style typography and GSAP micro-motion elevate visual credibility.
- Strict isolation is maintained: demo data lives in an isolated sandbox tenant partition.
