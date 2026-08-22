# Super-Admin Portal, FAISS Index Lifecycle, and Reporting

We decided to implement a dedicated `/super-admin` management portal, an on-demand active session lifecycle for FAISS vector indexes, and dual-format (CSV + PDF) attendance reporting.

## Context
Running multiple universities on a single platform requires clear operational boundaries between platform-wide maintenance (Super-Admin) and campus event coordination (Institution Admin). Furthermore, keeping FAISS vector indexes for all institutions permanently in memory risks resource exhaustion as enrollment scales.

## Considered Options
- **Shared `/admin/*` views with conditional flags**: Embedding Super-Admin functions inside regular University Admin dashboards. (Rejected: creates clutter and permission leak risks).
- **Dedicated `/super-admin` Portal**: An isolated routing prefix (`/super-admin/*`) restricted strictly to `UserRole.super_admin` for managing institutions, platform diagnostics, and system announcements. (Accepted).
- **Permanent Index Preloading**: Preload all university embeddings into FAISS on server startup. (Rejected: high baseline RAM consumption).
- **On-Demand Session Index Caching**: Load an institution's vector index when an attendance session becomes `active` and evict after inactivity. (Accepted).
- **Dual-Format Reporting**: Provide raw CSV exports for data analysis and formatted PDF attendance rosters for institutional archiving. (Accepted).

## Consequences
- Clean separation between Super-Admin infrastructure controls and University Admin event management.
- Scalable memory profile that scales with *active events* rather than total registered universities.
- Full capstone audit and reporting compliance for institutional accreditation.
