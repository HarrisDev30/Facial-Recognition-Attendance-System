# ADR 0007: Campus-Locked Registration, Institution Onboarding, and Targeted Banner Visibility

## Context
When students navigate from a campus portal (such as `/cjc` or `cjc.attendify.app`) to register for biometric attendance, presenting a global university dropdown causes confusion and security ambiguity. Furthermore, departments and student organizations must be strictly isolated per institution to avoid cross-campus data leakage.

Additionally, platform maintenance notices and campus-specific announcements must be strictly targeted so that students only see relevant information, while platform Super-Admins remain exempt from intrusive banners.

## Decisions

1. **Campus-Locked Registration Flow (`/:slug/register`)**:
   - The registration page is bound to the campus slug in the route (e.g. `/cjc/register`) or subdomain (`cjc.attendify.app/register`).
   - The user interface is 100% branded with the institution's official name and badge.
   - **No university selector dropdown** is shown to registering students; the institution is immutable in context.
   - The department/college dropdown strictly fetches and displays only organizations where `institution_id == current_institution.id`.

2. **Targeted Banner Visibility & Super-Admin Exemption**:
   - **Super-Admin Immunity**: The `MaintenanceBanner` is never rendered within `/super-admin/*` routes or for users with `UserRole.super_admin`.
   - **Campus-Scoped Match**: When an announcement is targeted to a specific campus (e.g. `cjc`), it is displayed **only** on `/cjc/*`, `cjc.attendify.app`, or for authenticated CJC members. It is strictly hidden on neutral pages (`/`, `/login`) and other campus portals.
   - **Dismissability**: Informational notices feature a close `(X)` button remembered via `localStorage`. Hard system maintenance mode remains pinned.

3. **Public Institution Onboarding Application**:
   - The public landing page (`/`) includes a "Request Campus Portal" action allowing academic institutions to submit an onboarding application (Name, Slug, Contact Email, Administrator Name).
   - Platform Super-Admins review and approve onboarding requests directly within the Super-Admin Command Center (`/super-admin/institutions`).

4. **Database Tenant Clean-Up**:
   - Retain Cor Jesu College (`cjc`) as the primary active institution in the production seed data.
   - Wipe auxiliary test tenants and enforce strict relational cascade.

## Consequences
- Students enjoy a seamless, dedicated campus enrollment experience without cross-university noise.
- Complete data isolation is guaranteed at both UI and API layers.
- System announcements are relevant, dismissable when appropriate, and non-intrusive to platform administrators.
- University onboarding is structured, verifiable, and managed through the Super-Admin command center.
