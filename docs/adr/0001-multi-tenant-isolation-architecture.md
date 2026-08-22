# ADR 0001: Multi-Tenant Architecture & Data Isolation

## Status
Accepted

## Context
The Facial Recognition Attendance System serves multiple independent university institutions. To prevent cross-tenant data leaks, maintain high facial recognition match speeds, and withstand peak event check-in volumes across campuses, strict isolation boundaries must be enforced across database queries, authentication sessions, FAISS vector indices, and system broadcasts.

## Decisions

1. **Database Tenant Isolation (SQLAlchemy Automatic Tenant Scoping)**
   - All tenant-scoped database queries for non-super-admins automatically filter by `institution_id`.
   - Every database model associated with a tenant (`Attendee`, `Event`, `ScannerDevice`, `User`, `Organization`) must declare an explicit, indexed `institution_id` foreign key.

2. **Strict Authentication & Campus Portal Binding**
   - JWT tokens include `user.institution_id` and `user.institution_code`.
   - Non-super-admin users attempting to authenticate or access resources on a different campus portal are denied with generic 401 response (`"Invalid email, password, or institution portal."`).
   - The frontend renders an active session notice allowing users to log out and switch accounts.

3. **Per-Tenant Isolated FAISS Index Fleet**
   - Facial recognition vector indices are maintained as an in-memory dictionary `Dict[institution_id, FaissIndex]`.
   - Kiosk scanners from Institution A search ONLY Institution A's vector index, eliminating cross-university face collisions and accelerating vector match speeds.

4. **Persistent System Status & Broadcast Controls**
   - System maintenance status and campus-scoped broadcasts are stored in a persistent database table (`system_settings`) rather than ephemeral server RAM.
   - Global status changes trigger live event dispatches (`system_status_updated`) and lightweight polling to sync open client tabs instantly.

## Consequences
- **Positive**: Guarantees zero cross-tenant data leakage by default; scales vector matching to millions of faces; survives backend process restarts cleanly.
- **Negative**: Requires super-admin explicit override (`is_platform_wide = True`) for cross-institution reporting.
