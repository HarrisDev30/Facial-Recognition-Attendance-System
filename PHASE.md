# Development Phases

## Phase 1 — Foundation (DONE)
- Face recognition attendance (InsightFace + FAISS)
- Events → Sessions → Attendance flow
- Student biometric enrollment (6-angle capture)
- Marshal scanner (web-based, face + manual override)
- Admin CRUD: events, sessions, attendees
- Dark theme UI, card grids, CSV/PDF export
- Departments: model + API (name + code)
- Attendee types: student + staff support

## Phase 2 — Department Scoping (NEXT)
- Department Admin role (each dept has own admin)
- Scope all APIs to user's department_id
- Super Admin manages departments + dept admins
- Marshal invite link (dept-scoped)
- Staff creation: admin quick-create + invite token
- Clearance report per student per department

## Phase 3 — Room/Lab Attendance (FUTURE)
- Staff can create room/lab sessions
- Time-in / Time-out logging
- Staff daily presence tracking
- Extended clearance: events + labs + rooms

## Questions for Professor
1. One department admin per department or multiple?
2. Staff creation: direct (admin sets password) vs invite (staff sets own)?
3. Priority: department scoping first, or room/lab attendance first?
4. Should staff be able to create lab sessions themselves?

## Notification System

### Phase 1 — Active Session Indicator (Now)
- Green dot on bell icon when student has active sessions (live check-in)
- Click bell → jumps to active events or shows mini dropdown with event names
- No backend needed: uses existing activeEvents data from dashboard
- Default: muted gray bell, no dot, no action

### Phase 2 — In-App Notifications (Later)
- New event published for student's department
- Session starting in 15 minutes reminder
- Check-in confirmed with confidence score
- Missed session alert
- WebSocket/SSE real-time push from server
- Mark as read / unread states
- Notification inbox dropdown with timestamps

### Phase 3 — Admin/Marshal Notifications (Later)
- Marshal check-in activity feed
- Low attendance / below-threshold alerts
- System alerts: camera offline, scanner errors
- Department-scoped notification delivery

## Notification System

### Phase 1 — Active Session Indicator (Now)
- Green dot on bell when active sessions exist
- Click → jump to active events or mini dropdown
- No backend: uses existing activeEvents from dashboard

### Phase 2 — In-App Notifications (Later)
- New event published, session starting reminder
- Check-in confirmed, missed session alert
- WebSocket/SSE real-time push
- Notification inbox with timestamps + read states

### Phase 3 — Admin/Marshal Notifications (Later)
- Marshal check-in activity feed
- Low attendance alerts, system errors
- Department-scoped notifications