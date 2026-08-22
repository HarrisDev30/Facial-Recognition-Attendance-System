# Multi-Tenant Institution Architecture with Partitioned FAISS Indexing

We decided to structure the system as a shared multi-tenant platform centered around a top-level `Institution` model with isolated FAISS vector indexes per institution, unified global authentication, and a `super_admin` role.

## Context
Our initial design targeted a single university (Cor Jesu College). To accommodate multiple universities while maintaining strict Data Privacy Act compliance and sub-second face verification latency, we needed an architectural model that isolates student biometric vectors and attendance records without managing separate server infrastructure for each school.

## Considered Options
- **Multi-Instance (Independent Deployments)**: Deploy separate database instances and backend services per university on distinct subdomains. (Rejected: excessive maintenance overhead and resource duplication for Capstone scope).
- **Global Shared Index with Query Filtering**: A single unified FAISS vector index containing all universities' facial embeddings with post-search filtering. (Rejected: introduces cross-university false positives and potential biometric data leakage).
- **Multi-Tenant Logical Isolation with Partitioned Indexing**: A single backend service with `institution_id` foreign keys and separate FAISS vector indexes loaded per institution session. (Accepted).

## Consequences
- **Biometric Isolation**: FAISS vector similarity queries load and match only against embeddings belonging to the target institution, eliminating cross-campus false matches.
- **Unified Login Flow**: Users log in through a single global login endpoint; their JWT claims include `institution_id` and `role`, routing them directly to their institutional workspace.
- **Super-Admin Control**: A `super_admin` role enables platform-wide onboarding and monitoring of institutions, while `admin` users remain strictly scoped to their own institution.
