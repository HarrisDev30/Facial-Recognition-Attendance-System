# Frontend Overview — Attendance System

> Written for designers. Covers every page, its purpose, the data it displays, user actions, and special UI needs.

---

## Global Notes

- **UI Library**: Mantine v7 (`@mantine/core`, `@mantine/notifications`, `@mantine/hooks`)
- **Icons**: `@tabler/icons-react`
- **Routing**: React Router v6 (`react-router-dom`)
- **State**: Zustand for auth (token + user profile)
- **HTTP**: Axios, base path `/api`, Bearer token auto-attached
- **Roles**: `student`, `marshal`, `admin` — route access is role-gated
- **Auth pages**: No shell, full-screen centred forms
- **Admin pages**: Wrapped in `AdminLayout` (AppShell with left navbar + header)
- **All other pages**: Standalone layout

---

## Page Inventory

### 1. Login (`/login`)

| Attribute | Detail |
|---|---|
| **Purpose** | Authenticate any user (student, marshal, admin) |
| **Data shown** | Username / email field, password field, "Sign in" button |
| **Actions** | Submit credentials → JWT stored in localStorage → redirected to role-based home |
| **Special UI** | Error toast on invalid credentials; loading indicator on submit |
| **Roles** | Public |

---

### 2. Student Registration (`/register`)

| Attribute | Detail |
|---|---|
| **Purpose** | Self-registration for new students |
| **Data shown** | Form: email, password (with strength meter), confirm password, first name, last name, optional student ID |
| **Actions** | Register → success screen → auto-redirect to `/login` after 2 s |
| **Special UI** | Password strength bar (min 50% to enable submit); inline validation errors |
| **Roles** | Public |

---

### 3. Student Dashboard (`/student/dashboard`)

| Attribute | Detail |
|---|---|
| **Purpose** | Student home — attendance stats, log, and upcoming events |
| **Data shown** | **4 stat cards**: Events Attended, Attendance Rate (%), Last Attendance (date), Available Events (count). **3 tabs**: Overview / My Attendance / Upcoming Events |
| **Actions** | View stat cards; browse attendance history table (paginated, 20/page); browse upcoming events grid; click event row → detail modal with session + check-in status |
| **Special UI** | Stat cards with icons and colour accents; verification method badges (Facial/QR/Manual); expandable event detail modal; tabbed layout |
| **Roles** | Student |

---

### 4. Student Profile (`/profile`)

| Attribute | Detail |
|---|---|
| **Purpose** | View/edit profile, manage biometric registration, privacy consent |
| **Data shown** | **Section 1** — Profile info: first name, last name, student ID (editable). **Section 2** — Biometric status: badge (Complete / Partial / Not Registered), embedding count, "Register Biometrics" button. **Section 3** — Consent status: badge (Given / Not Given), "Give Consent" button → opens consent modal |
| **Actions** | Edit name fields inline; navigate to biometric registration; open consent modal; request data removal |
| **Special UI** | Inline edit fields; consent modal with privacy checkboxes; status badges (green/grey/amber) |
| **Roles** | Student |

---

### 5. Biometric Registration (`/register-biometrics`)

| Attribute | Detail |
|---|---|
| **Purpose** | 5-angle facial capture wizard for biometric enrollment |
| **Data shown** | **5-step stepper**: (1) Consent notice + checkboxes (2) Capture instructions (3) Webcam with guided angle prompts (4) Review captured thumbnails (5) Success confirmation |
| **Actions** | Consent → follow angle prompts (frontal, left, right, up/down, natural) → auto-capture each → review grid → submit → done |
| **Special UI** | **`react-webcam`** component; progress tracker (5/5 circles); angle prompt overlay on viewfinder; thumbnail grid with retake button per image; auto-resume (skips consent if already given, skips captured angles) |
| **Roles** | Student |

---

### 6. Attendance History (`/student/attendance`)

| Attribute | Detail |
|---|---|
| **Purpose** | Full paginated attendance log with filters |
| **Data shown** | Table: Event, Session, Date, Check-in Time, Verification Method (badge), Confidence (%) |
| **Actions** | Filter by event type; sort by newest/oldest/by name; paginate (20/page); expand row for venue & method details |
| **Special UI** | Collapsible filter panel; sort dropdown; expandable table rows; method badges |
| **Roles** | Student |

---

### 7. Upcoming Events (`/student/upcoming`)

| Attribute | Detail |
|---|---|
| **Purpose** | Browse upcoming events with card or table views |
| **Data shown** | Events list: name, type, venue, date, session count. Detail modal: full event info + sessions table with check-in status badges |
| **Actions** | Toggle between card grid / table view; click event → detail modal |
| **Special UI** | View toggle (cards ↔ table); card grid with image-less event cards; detail modal |
| **Roles** | Student |

---

### 8. Marshal Dashboard (`/marshal/dashboard`)

| Attribute | Detail |
|---|---|
| **Purpose** | Marshal's home — active sessions, quick scanner access, recent overrides |
| **Data shown** | **Active sessions** — cards showing: session name, event name, venue, time range, checked-in count. **Recent overrides** — cards: student name, event/session label, time ago |
| **Actions** | Per session: launch Scanner (full), Mobile scanner, QR check-in, Manual override (modal). View override history |
| **Special UI** | 4 action buttons per session card (Scanner, Mobile, QR, Manual); manual override modal with student search select + reason dropdown |
| **Roles** | Marshal |

---

### 9. Scanner Display (`/scanner/:sessionId`)

| Attribute | Detail |
|---|---|
| **Purpose** | Full dedicated scanner with WebSocket live feed, face recognition results, and session controls |
| **Data shown** | Session header (name, status badge, elapsed timer). **Stats row**: Checked In, Registered, Check-in Rate (colour-coded), Threshold, Camera status. **Recent Identifications**: animated list of identified students with method badges. **Error log**: collapsible timestamped entries |
| **Actions** | Manual Override button → modal; QR Check-in button; Activate/End Session (admin only); fullscreen toggle; clear error log |
| **Special UI** | **WebSocket connection** with live status indicator (wifi icon + FPS counter); animated identification feed (new entries slide in); fullscreen mode; collapsible error log panel; admin-only bottom controls |
| **Roles** | Admin, Marshal |

---

### 10. Mobile Scanner (`/scanner/mobile/:sessionId`)

| Attribute | Detail |
|---|---|
| **Purpose** | Mobile-optimised scanner using camera capture + continuous polling |
| **Data shown** | Camera preview (~50 vh); stats row (Checked In, Registered, Rate); last identified result card (with fade-in); recent identifications (latest 5) |
| **Actions** | Start/Stop camera; toggle continuous scan (polls `processFrame()` every 3 s); Manual Override; QR Check-in; send heartbeat every 30 s |
| **Special UI** | **`react-webcam`** in mobile viewport; **fixed bottom toolbar** (5 icon buttons: camera toggle, scan toggle, manual override, QR, back); WebSocket for live stats; canvas snapshot for frame capture; device ID stored in `sessionStorage` |
| **Roles** | Admin, Marshal |

---

### 11. QR Check-In (`/scanner/qr-checkin/:sessionId`)

| Attribute | Detail |
|---|---|
| **Purpose** | Manual student ID entry for QR code–style check-in |
| **Data shown** | Student ID text input; success/failure result display with large icon; reset flow |
| **Actions** | Enter student ID → submit → view result → "Check In Another" or "Try Again" |
| **Special UI** | Large success/failure icon (checkmark / cross); back button navigates intelligently based on origin (scanner / mobile / dashboard) |
| **Roles** | Admin, Marshal |

---

### 12. Admin Events (`/admin`)

| Attribute | Detail |
|---|---|
| **Purpose** | Event CRUD — list, create, edit, delete events |
| **Data shown** | Table: Name (linked to sessions), Type, Venue, Start/End Dates, Status badge (draft / active / completed / cancelled), Edit / Delete icon buttons |
| **Actions** | Click event name → navigate to sessions page; Edit → modal pre-filled; Delete → confirm dialog → remove; Create Event → empty modal |
| **Special UI** | **EventFormModal** (create / edit): name, type (select), description (textarea), venue, start/end date (datetime inputs); status badges with distinct colours; window.confirm for delete |
| **Roles** | Admin |

---

### 13. Admin Event Sessions (`/admin/events/:eventId/sessions`)

| Attribute | Detail |
|---|---|
| **Purpose** | Session management for a single event |
| **Data shown** | Table: Name, Start/End Time, Status, Activated At, Deactivated At. Action buttons per row |
| **Actions** | Create Session → modal; Activate (if pending); Deactivate (if active); View Attendance → navigate to attendance page; Open Scanner → navigate to `/scanner/:id` |
| **Special UI** | **SessionFormModal**: name + start/end datetime-local inputs; action buttons colour-coded (green=activate, orange=deactivate) |
| **Roles** | Admin |

---

### 14. Admin Students (`/admin/students`)

| Attribute | Detail |
|---|---|
| **Purpose** | CRUD for student accounts; create marshal accounts |
| **Data shown** | Table: Student ID, First/Last Name, Email, Consent badge (Given / Not Given), Edit / Delete icon buttons. Separate "Create Marshal" button |
| **Actions** | Add/Edit Student → modal; Delete → confirm; Create Marshal → separate modal (email + password + confirm) |
| **Special UI** | Two modal variants: **StudentFormModal** (student_id, first/last name, email) and **MarshalCreateModal** (email, password, confirm); orange "Create Marshal" button to distinguish from student actions |
| **Roles** | Admin |

---

### 15. Admin Session Attendance (`/admin/sessions/:sessionId/attendance`)

| Attribute | Detail |
|---|---|
| **Purpose** | View attendance logs and summary for a single session |
| **Data shown** | **3 summary cards**: Total Students, Present, Absent. **Attendance Logs table**: Student ID, Name, Verified At, Method (badge), Confidence (%). **All Students table**: every registered student with Present/Absent badge |
| **Actions** | Scroll tables; view method type breakdown |
| **Special UI** | Summary stat cards (3 across); method badges colour-coded (face_recognition=blue, qr_code=teal, marshal_override=orange); two tables stacked vertically |
| **Roles** | Admin |

---

### 16. Admin Enrollment (`/admin/enrollment`)

| Attribute | Detail |
|---|---|
| **Purpose** | Admin-driven face enrollment (webcam or file upload) for any student |
| **Data shown** | Student selector (searchable); student detail card with consent toggle. **Two-panel layout**: Left — webcam preview OR file upload + "Upload Embedding" button; Right — saved embeddings table (index, angle, date) |
| **Actions** | Search/select student; toggle consent on/off; capture via webcam or choose image file → upload; view existing embeddings |
| **Special UI** | Side-by-side panels (capture left, list right); `react-webcam` OR file input; consent toggle switch; embedding thumbnail list |
| **Roles** | Admin |

---

### 17. Admin Scanner Devices (`/admin/scanner-devices`)

| Attribute | Detail |
|---|---|
| **Purpose** | List all registered scanner devices |
| **Data shown** | Table: Name, Type (Dedicated Scanner / Mobile), Location, Status badge (active / inactive), Last Activity timestamp |
| **Actions** | Click "Configure" → navigate to detection zone config page for that device |
| **Special UI** | Status badges (green=active, grey=inactive); device type labels |
| **Roles** | Admin |

---

### 18. Detection Zone Config (`/admin/scanner-config/:deviceId`)

| Attribute | Detail |
|---|---|
| **Purpose** | Configure detection zone overlay and face detection parameters for a scanner device |
| **Data shown** | Device info header (name, type, status, location). **Camera Preview**: live video with overlaid detection zone rectangle (canvas drawn on top). **Zone Coordinates**: 4 × NumberInput (X1, Y1, X2, Y2, normalized 0.0 – 1.0). **Detection Settings**: Face size min slider (50 – 500 px), Confidence threshold slider (0.0 – 1.0) |
| **Actions** | Drag / type zone coordinates; adjust sliders; "Test Detection" (mock); "Save Configuration" |
| **Special UI** | **`react-webcam`** with **overlaid `<canvas>`** drawing the detection zone rectangle; dual-range sliders; mock test button |
| **Roles** | Admin |

---

### 19. Privacy Policy (`/privacy`)

| Attribute | Detail |
|---|---|
| **Purpose** | Display data privacy policy (fetched from API) |
| **Data shown** | Table of contents (anchor links); dynamically rendered policy sections |
| **Actions** | Click TOC → scroll to section; Print button |
| **Special UI** | Anchor-linked table of contents; print styles; graceful fallback if API is unavailable |
| **Roles** | Public |

---

### 20. Data Removal Request (`/privacy/data-removal`)

| Attribute | Detail |
|---|---|
| **Purpose** | Student-facing form to request GDPR/RA 10173 data removal |
| **Data shown** | Warning alert about permanence; optional reason textarea; 3 confirmation checkboxes; submit button; success state |
| **Actions** | Check all 3 boxes → submit → confirmation |
| **Special UI** | Danger-themed alert; checkboxes must all be checked to enable submit; success state replaces form |
| **Roles** | Student |

---

### 21. Root Redirect (`/`)

| Attribute | Detail |
|---|---|
| **Purpose** | Auto-redirect based on user role after login |
| **Data shown** | Nothing — instant redirect |
| **Actions** | None |
| **Special UI** | None |
| **Roles** | Any authenticated user |

---

## User Flows

### A. Admin creates event → Marshal scans → Student views history

```
Admin:
  /admin                          → Create event (name, type, dates, venue)
  /admin/events/:id/sessions      → Create session(s) with time windows
  /scanner/:sessionId             → Activate session, start scanner

Marshal:
  /marshal/dashboard              → See active session card
  /scanner/:sessionId             → Run scanner during event (real-time face matching)
  -OR-
  /scanner/mobile/:sessionId      → Mobile-optimised continuous scanning
  -OR-
  /scanner/qr-checkin/:sessionId  → Manual QR code check-in
  /marshal/dashboard              → Manual override if face fails (modal)

Student:
  /student/dashboard              → See attendance stat update in real time
  /student/attendance             → View detailed log with method & confidence
```

### B. Student self-registers and enrolls biometrics

```
/register                         → Create account (email, password, name)
/login                            → Sign in
/student/dashboard                → See "Not Registered" badge on biometric card
/profile                          → Navigate to biometric registration
/register-biometrics              → 5-step wizard (consent → instructions → 5× capture → review → done)
/student/dashboard                → Stats, attendance history, upcoming events
```

### C. Admin manages students and enrollment

```
/admin/students                   → View all students, add/edit/delete
/admin/enrollment                 → Select a student, toggle consent, webcam/file capture
/admin/scanner-devices            → View registered devices
/admin/scanner-config/:deviceId   → Configure detection zone & parameters
```

### D. Data privacy flow

```
/privacy                          → Read privacy policy (RA 10173)
/profile                          → Give consent (modal with 3 checkboxes)
/register-biometrics              → Consent step before capture (if not already given)
/privacy/data-removal             → Request complete data removal
```

---

## Shared / Reusable UI Components

| Component | Location | Used on | Description |
|---|---|---|---|
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | All protected routes | Loading overlay while checking auth; redirects if wrong role |
| `AdminLayout` | `components/AdminLayout.tsx` | All `/admin/*` pages | AppShell with 250 px left navbar + header with user avatar + sign out |
| `EventFormModal` | Inline in `AdminEventsPage` | `/admin` | Create/edit event form in a modal |
| `SessionFormModal` | Inline in `AdminEventSessionsPage` | `/admin/events/:id/sessions` | Create session form in a modal |
| `StudentFormModal` | Inline in `AdminStudentsPage` | `/admin/students` | Add/edit student form in a modal |
| `MarshalCreateModal` | Inline in `AdminStudentsPage` | `/admin/students` | Create marshal form in a modal |
| `MarshalOverride` | `components/MarshalOverride.tsx` | All scanner pages | Modal: student search select + reason dropdown + notes |
| `ConsentForm` | `components/ConsentForm.tsx` | `/profile`, `/register-biometrics` | Modal with 3 privacy checkboxes + accept button |
| **Stat cards** | Inline in pages | Student dashboard, admin session attendance | Summary cards with icon + number + label |
| **Method badges** | Inline in tables | Student dashboard, attendance history, admin attendance | Coloured badges: face_recognition (blue), qr_code (teal), marshal_override (orange) |
| **Status badges** | Inline in tables | Event, session, student tables | Colour-coded status indicators |
| **Upload / Webcam** | Inline / via `react-webcam` | Scanner, biometric registration, admin enrollment | Camera viewfinder with capture logic |

---

## Special UI Requirements Summary

| Requirement | Pages | Notes |
|---|---|---|
| **Webcam** | Scanner, Mobile scanner, Biometric registration, Admin enrollment, Detection zone config | `react-webcam` library; canvas overlay for detection zone |
| **WebSocket** | Scanner display, Mobile scanner | Live stats and identification feed; reconnect logic; FPS display |
| **Fullscreen mode** | Scanner display | Toggle fullscreen for dedicated scanner stations |
| **Stepper / Wizard** | Biometric registration | 5-step stepper with progress, per-step validation, resume support |
| **File upload** | Admin enrollment | Image file input as alternative to webcam capture |
| **Canvas overlay** | Detection zone config | Rectangular zone drawn on top of live camera feed |
| **Live stats polling** | Mobile scanner | `processFrame()` every 3 s; heartbeat every 30 s |
| **Inline editing** | Student profile | Direct edit of name fields |
| **Password strength meter** | Student registration | Visual bar; min 50% required |
| **Responsive / mobile** | Mobile scanner mode | Fixed bottom toolbar, optimised camera height, touch-friendly buttons |
| **Animated feed** | Scanner display | New identifications slide in / fade in |
| **Collapsible panels** | Scanner (error log), Attendance history (filters) | Expand/collapse for secondary content |
