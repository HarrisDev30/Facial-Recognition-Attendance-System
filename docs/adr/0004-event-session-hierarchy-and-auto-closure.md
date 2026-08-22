# Event-Session Hierarchy, Automated Closure, and Session Lifecycles

We decided to retain the hierarchical Event → Session model while introducing automated session expiration, grace period handling, and a quick single-session event creation workflow.

## Context
Institutional events (e.g., University Intramurals, General Assemblies, multi-day seminars) require multiple distinct check-in windows (e.g., Morning Time-In, Afternoon Time-Out). However, sessions previously remained indefinitely active past their scheduled `end_time` because session status depended entirely on manual button clicks without backend time checks or background auto-closure.

## Considered Options
- **Flatten Event & Session into one entity**: Merging event and session into a single model. (Rejected: prevents multi-day events, morning/afternoon check-ins, and distinct entry/exit tracking).
- **Manual-Only Activation/Deactivation**: Requiring Marshals to always manually click deactivate. (Rejected: leads to abandoned active sessions that accept unauthorized scans hours or days later).
- **Hierarchical Model with Auto-Closure & Fast Setup**: Maintain `Event → Sessions` relationship, add automated time boundary checks (`now > end_time + grace_period`), background status reconciliation, and a 1-click single-session setup toggle in the event creator UI. (Accepted).

## Consequences
- Scanner frame processing will immediately reject frames for expired sessions (`Session Expired`).
- Background worker automatically transitions expired active sessions to `completed` and evicts their in-memory FAISS indexes.
- Event creation form provides an "Auto-create Check-In Session" switch for fast event setup.
