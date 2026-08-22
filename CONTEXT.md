# Facial Recognition Attendance System (Multi-Institution)

A portable, server-side facial recognition attendance monitoring system for institutional events across multiple universities.

## Core Entities

**Institution**:
A top-level university or college entity that owns its users, departments, events, scanner hardware, and attendance data.
_Avoid_: Tenant, School, Client, Account

**Organization**:
An internal department, student club, or academic college unit belonging to a specific Institution.
_Avoid_: Sub-tenant, Division, Chapter

**Attendee**:
An enrolled individual (student, faculty, or staff member) associated with an Institution whose biometric facial embeddings and attendance records are stored.
_Avoid_: Person, Member, Subject

**User**:
An authenticated account holder with 4-tier role-based permissions (`super_admin`, `admin`, `org_admin`, `student` / `staff` / `marshal`).
_Avoid_: Account, Profile, Login

## Biometrics & Hardware

**Facial Embedding**:
A 512-dimensional numerical vector derived from facial features using the InsightFace Buffalo_L model, used for FAISS vector similarity matching.
_Avoid_: Face signature, Face template, Face hash

**Per-Tenant FAISS Index**:
An isolated in-memory vector index instance `Dict[institution_id, FaissIndex]` containing only the face embeddings of Attendees belonging to that specific Institution.
_Avoid_: Global index, Face database

**Scanner Device**:
A dedicated entrance workstation or mobile browser-based camera client bound via 6-digit OTP to an Institution for processing real-time attendance frames.
_Avoid_: Terminal, Station, Node, Kiosk

**Biometric Viewfinder**:
A circular camera reticle surrounded by dynamic radial tick marks that illuminate as the student rotates their face through required biometric angles.
_Avoid_: Camera box, Face frame, Photo uploader

## Attendance & Security Operations

**Attendance Session**:
A time-bounded, active check-in/check-out window within an Event during which Scanners process live camera frames.
_Avoid_: Meeting, Check-in period, Shift

**Tenant Portal Scope**:
The strict binding of JWT session tokens and API queries to the active campus portal URL (`institution_code`). Cross-tenant access returns a generic 401 response without disclosing account existence.
_Avoid_: Domain filter, Access check

**System Settings**:
Persistent database-managed platform maintenance status and campus broadcast configuration.
_Avoid_: Config file, Server RAM dict

**Sandbox Campus**:
A pre-configured, isolated demonstration institution workspace (`/demo` or `/sandbox`) populated with sample events and attendee embeddings, enabling prospective institutions to evaluate live scanning without provisioning credentials.
_Avoid_: Test account, Playground, Mock environment

**Biometric Processing Pipeline**:
The 4-stage sequential server-side verification lifecycle: OpenCV detection zone/size filtering -> InsightFace 512D vector embedding extraction -> Partitioned FAISS similarity search -> Cooldown logging.
_Avoid_: Face flow, Recognition stack, Scanning process

