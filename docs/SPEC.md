# Specification: Attendify Multi-Institution Biometric Attendance System

## Problem Statement

Educational institutions face severe operational friction, attendance proxy fraud, and long queues during large-scale institutional events (e.g., General Assemblies, Intramurals, Seminars). While single-institution biometric solutions exist, expanding to support multiple universities introduces cross-campus data contamination, false face matches across different schools' student rosters, hardware device provisioning confusion, and violation of the Data Privacy Act of 2012. Furthermore, existing session management lacks automated time-based closure, allowing check-in windows to accept frames long after events conclude, and biometric enrollment experiences are often clunky and frustrating without real-time directional guidance.

## Solution

**Attendify** is an enterprise-grade, multi-institution facial recognition attendance platform that provides:
1. **Multi-Tenant Logical Isolation**: A top-level `Institution` hierarchy with composite key uniqueness `(institution_id, identifier)` ensuring total separation of student rosters, event sessions, and attendance records.
2. **Dedicated Campus Portals & Direct Routing**: Each university receives a dedicated campus route (e.g. `attendify.app/cjc` or `cjc.attendify.app`) with custom logo and direct login, while the root domain hosts a professional institutional overview.
3. **On-Demand Partitioned FAISS Vector Search**: Server-side facial recognition using InsightFace Buffalo_L where vector indexes are loaded strictly per active institution session, eliminating cross-school false positives and optimizing memory.
4. **Dedicated Super-Admin & Institution Admin Portals**: Platform telemetry, global device management, and maintenance mode for Super-Admins; real-time attendance analytics, CSV/PDF report exports, and gate coordination for University Admins.
5. **Automated Session Lifecycle**: Automated time-gated frame rejection and background reconciliation that auto-completes expired sessions when `now > end_time`.
6. **Apple Face ID-Inspired Biometric Registration**: A fluid circular viewfinder with 48 dynamic radial tick marks that physically grow and light up as students turn their heads, hands-free auto-locking, and single-angle retake capability.
7. **Seamless Hardware Scanner Pairing**: 6-digit dynamic pairing codes for instant kiosk authorization without personal account sharing.

---

## User Stories

1. As a **Visitor or Evaluator**, I want to view a professional platform landing page explaining the system architecture, biometric pipeline, and Data Privacy Act compliance, so that I understand Attendify's technical foundation.
2. As a **Student or Faculty Member**, I want to visit my university's direct campus portal (e.g. `attendify.app/cjc`), so that I see only my university's branding, logo, and events without going through a generic homepage.
3. As a **Super-Admin**, I want to onboard a new University (name, institution code/slug, logo, contact details), so that multiple universities can operate independently on Attendify.
4. As a **Super-Admin**, I want to monitor real-time server telemetry (AI frame processing latency in ms, active FAISS indexes, connected WebSockets, and scanner FPS), so that I can ensure platform stability.
5. As a **Super-Admin**, I want to toggle Platform Maintenance Mode with a custom banner, so that I can perform scheduled upgrades without data corruption.
6. As a **University Admin**, I want to manage internal colleges, departments, and clubs (`Organizations`), so that campus events can be targeted by faculty or student body.
7. As a **University Admin**, I want student ID numbers to be unique only within my university, so that registration never fails due to another university using a similar ID numbering scheme.
8. As a **University Admin**, I want to generate a 6-digit scanner pairing code, so that entrance laptop kiosks and mobile scanners can be paired to my campus without logging in with personal credentials.
9. As a **University Admin**, I want to create multi-session events (e.g. Intramurals Day 1 Morning & Afternoon) or use a 1-click single-session setup, so that event configuration is fast and flexible.
10. As a **University Admin**, I want sessions to automatically close when their scheduled end time passes, so that expired sessions no longer accept unauthorized check-ins.
11. As a **University Admin**, I want to export official attendance rosters in both CSV and formatted PDF summary formats, so that I have accredited records for institutional compliance.
12. As a **University Admin**, I want to view visual analytics (check-in velocity curves, verification method breakdown, department turnout percentages), so that I can optimize gate logistics.
13. As a **Marshal**, I want the scanner kiosk HUD to give clear audio and visual cues (Green chime for success, Amber flash for duplicate, Red for unknown), so that I can manage high-traffic crowds quickly.
14. As a **Marshal**, I want to perform manual ID check-ins and authorized Marshal Overrides with audit logging, so that students with temporary biometric issues can still be recorded.
15. As a **Student**, I want an Apple Face ID-style circular viewfinder with dynamic radial tick bars that grow as I turn my head, so that I know exactly how to position my face during biometric registration.
16. As a **Student**, I want hands-free auto-capture across the 6 required facial angles, so that I don't have to awkwardly tap the screen while holding my pose.
17. As a **Student**, I want an interactive thumbnail review tray where I can tap to retake a single bad angle, so that I don't have to restart the entire registration if I blink.
18. As a **Student**, I want to view my historical event attendance logs and manage my Data Privacy Act consent, so that my biometric rights are transparent and protected.

---

## Implementation Decisions

### 1. Multi-Tenant Domain Hierarchy & Schema Evolution
- Add `Institution` top-level entity with `id`, `name`, `code` (unique slug, e.g. `cjc`), `logo_url`, `is_active`, and `created_at`.
- Add `institution_id` foreign key with cascade deletion to: `organizations`, `users`, `attendees`, `events`, `scanner_devices`, and `audit_logs`.
- Alter `attendees` table to replace global unique `identifier` with composite unique constraint `UNIQUE (institution_id, identifier)`.
- Update `UserRole` enum to support `super_admin`, `admin`, `marshal`, `staff`, and `student`.

### 2. Dedicated Campus Portals & Landing Page
- Public root `/` displays a clean, academic landing page detailing the architecture (InsightFace Buffalo_L, FAISS, Data Privacy Act compliance) with a campus search selector.
- Direct campus route `/:slug` (e.g. `/cjc`) dynamically loads that institution's branding, active events, and student/admin sign-in forms.

### 3. On-Demand Partitioned FAISS Vector Lifecycle
- Refactor the singleton FAISS index into an in-memory index dictionary `_indices: dict[uuid.UUID, faiss.Index]` keyed by `institution_id`.
- Vector search queries during frame processing exclusively query the active session's `institution_id` index.
- Index loader pulls embeddings for an institution on-demand when an attendance session starts, and evicts them from RAM when all sessions for that institution complete or become inactive.

### 4. Automated Session Lifecycle & Time-Gating
- In `process_frame`, compare `datetime.now(UTC)` against `session.end_time`. If expired, return immediate HTTP 400 / WS status `"session_expired"`.
- Introduce a lightweight background reconciliation task (every 60s) that automatically updates status to `completed` for sessions past `end_time + grace_period` and notifies active scanners via WebSocket.
- Add an "Extend Session by 15 mins" endpoint for authorized marshals.

### 5. Scanner Hardware Provisioning
- Introduce `ScannerPairingCode` entity with a 6-digit numeric code, 15-minute TTL, and `institution_id` link.
- Add `/api/devices/pair` endpoint: scanner client submits 6-digit code and device name, receives persistent device UUID token scoped to that institution.

### 6. Official Attendance Reporting Engine
- Implement full `report_service.py` with two exporters:
  - **CSV Exporter**: Raw tabular stream of attendee ID, full name, department, session timestamp, verification method, confidence score, and marshal override notes.
  - **PDF Exporter**: Clean, institutional summary with University logo, event metadata, turnout percentage, department breakdown charts, and signatory lines.

### 7. Apple Face ID-Style Biometric Registration UX
- Implement a circular viewfinder with SVG/CSS radial tick array (48 notches).
- As client receives face pose (yaw, pitch, roll) from face preview, radial bars in the target direction dynamically lengthen and transition from translucent grey to glowing emerald/cyan.
- Once pose angle is within tolerance for 400ms, trigger auto-capture flash and advance to next angle.
- Provide bottom 6-thumbnail carousel allowing 1-tap single-pose retakes.

---

## Testing Decisions

### Test Strategy
Tests will verify end-to-end external behavior at the highest available seam:
1. **API End-to-End Integration Seam**:
   - Verify multi-tenant isolation: An Admin from Institution A cannot access, view, or scan students from Institution B.
   - Verify FAISS partitioning: Enrolled student in Institution A produces 0 matches when scanned against a session belonging to Institution B.
   - Verify session auto-expiration: Frames sent to a session where `now > end_time` are rejected with `session_expired`.
   - Verify composite identifier uniqueness: Inserting duplicate student ID `2024-0001` succeeds in different institutions, but fails within the same institution.
2. **Campus Slug Routing & Biometric UI Seam**:
   - Verify visiting `/:slug` correctly binds context and loads institution branding.
   - Verify radial tick bar growth calculation based on yaw/pitch pose inputs.
   - Verify hands-free auto-capture triggers when pose matches target angle.

---

## Out of Scope

- Self-service credit card billing / SaaS subscription gateways (Stripe/PayPal).
- Dynamic multi-institution joint event cross-scanning (deferred to Chapter V Future Recommendations).
- Cloud GPU acceleration clustering (system runs efficiently on standard CPU via FAISS IndexFlatIP / IVFFlat).

---

## Further Notes

- System adheres strictly to the Data Privacy Act of 2012 (biometric embeddings only; raw frames are never stored on disk).
- All changes maintain backwards compatibility with existing single-institution test seeds by seeding "Cor Jesu College" as Default Institution #1 (`cjc`).
