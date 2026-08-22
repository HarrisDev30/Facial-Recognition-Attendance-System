# Attendify Branding and Multi-Tenant Integrity Constraints

We selected **Attendify** as the canonical system brand name and established composite key uniqueness for student identifiers per institution.

## Context
When expanding from single-institution Cor Jesu College to multi-institution support, student numbering schemes (e.g., ID format `2021-0001`) can collide across different universities. Furthermore, physical entrance scanners need isolated pairing mechanisms, and the user interface requires unified product branding across headers, student check-in kiosks, and reports.

## Considered Options
- **Global Unique Student IDs**: Enforce globally unique IDs by requiring students/admins to prefix their university code (e.g., `CJC-2021-0001`). (Rejected: friction during CSV/bulk imports from university registrars).
- **Composite Unique Constraint `(institution_id, identifier)`**: Allow universities to keep their native student ID formats without global collision. (Accepted).
- **Branding**: Selected "Attendify" for product identity across web headers, mobile scanner UI, and exportable PDF attendance summaries.

## Consequences
- Schema migration adds `UNIQUE (institution_id, identifier)` to the `attendees` table.
- All hardware scanners register with a 6-digit device pairing code scoped to the active `institution_id`.
