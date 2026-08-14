# Graph Report - my-project  (2026-06-09)

## Corpus Check
- 144 files · ~35,743 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 628 nodes · 1498 edges · 48 communities (42 shown, 6 thin omitted)
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 274 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ef725ac8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `User` - 46 edges
2. `AsyncSession` - 28 edges
3. `Student` - 26 edges
4. `AttendanceLog` - 26 edges
5. `VerificationMethod` - 21 edges
6. `AsyncSession` - 19 edges
7. `_get_student_for_user()` - 18 edges
8. `UUID` - 18 edges
9. `Base` - 17 edges
10. `UserRole` - 17 edges

## Surprising Connections (you probably didn't know these)
- `createEvent()` --references--> `EventCreate`  [EXTRACTED]
  frontend/src/api/events.ts → backend/app/api/events.py
- `updateEvent()` --references--> `EventUpdate`  [EXTRACTED]
  frontend/src/api/events.ts → backend/app/api/events.py
- `createSession()` --references--> `SessionCreate`  [EXTRACTED]
  frontend/src/api/sessions.ts → backend/app/api/sessions.py
- `SessionCreate` --uses--> `User`  [INFERRED]
  backend/app/api/sessions.py → backend/app/models/user.py
- `updateSession()` --references--> `SessionUpdate`  [EXTRACTED]
  frontend/src/api/sessions.ts → backend/app/api/sessions.py

## Import Cycles
- 1-file cycle: `backend/app/main.py -> backend/app/main.py`

## Communities (48 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (14): Stat, StatsRowProps, UsePaginationReturn, typeLabels, EVENT_TYPES, Column, DataTableProps, formatConfidence() (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (46): client, RegistrationStatus, create_student(), createStudent(), delete_my_embedding(), delete_student(), deleteStudent(), get_consent_status() (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (36): me(), registerStudent(), getEmbeddings(), seed(), AuditLog, login(), register(), AsyncSession (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (20): Settings, lifespan(), _rebuild_faiss_index_periodically(), SecurityHeadersMiddleware, UUID, BaseHTTPMiddleware, BaseSettings, FastAPI (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (11): Props, navItems, MarshalLayout(), navItems, navItems, App(), roleHome(), RootRedirect() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (44): AttendanceLogResponse, AttendanceSummary, check_in(), CheckInRequest, _get_student_for_user(), getStudentLogs(), list_session_logs(), list_student_logs() (+36 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (39): dependencies, axios, dayjs, @fontsource/inter, @fontsource/jetbrains-mono, @mantine/core, @mantine/dates, @mantine/hooks (+31 more)

### Community 7 - "Community 7"
Cohesion: 0.24
Nodes (25): getUpcomingEvents(), Base, AsyncSession, AttendanceSession, UUID, DeclarativeBase, Event, SessionStatus (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (28): client, ActiveSession, qrCheckIn(), createSession(), deactivateSession(), get_session_route(), list_sessions(), updateSession() (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (19): configure_detection_zone(), device_heartbeat(), get_scanner_device(), getDevice(), list_scanner_devices(), listDevices(), registerDevice(), ScannerDevice (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.44
Nodes (9): AsyncSession, Student, UUID, count_students(), create_student(), delete_student(), get_student(), get_student_by_student_id() (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (39): createEvent(), delete_event(), get_event(), list_events(), list_upcoming_events(), updateEvent(), EmbeddingDeleteResult, EmbeddingInfo (+31 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (40): BaseModel, AttendanceLogResponse, AttendanceSummary, CheckInRequest, EventSessionAttendance, SessionCreate, SessionResponse, SessionUpdate (+32 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (11): StatusBadgeProps, VerificationBadgeProps, EventCreate, EventListResponse, EventResponse, EventUpdate, UpcomingEvent, EVENT_TYPE_COLORS (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.24
Nodes (15): live_stats(), manualOverride(), processFrame(), qr_checkin(), scanner_stream(), AsyncSession, UploadFile, User (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (7): SectionCardProps, useAsync(), UseAsyncReturn, UseAsyncState, UseCameraReturn, UseFormSubmitOptions, getApiError()

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (3): NavItem, UserMenuProps, WordmarkProps

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (3): PageHeaderProps, PolicySection, PrivacyPolicy

### Community 20 - "Community 20"
Cohesion: 0.50
Nodes (3): ndarray, decode_image(), draw_detection_zone()

## Knowledge Gaps
- **106 isolated node(s):** `ConsentRequest`, `UploadFile`, `Student`, `plugin`, `AsyncSession` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AttendanceLog` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 7`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `User` connect `Community 12` to `Community 1`, `Community 2`, `Community 5`, `Community 7`, `Community 8`, `Community 15`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `getSession()` connect `Community 5` to `Community 8`, `Community 2`, `Community 7`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Are the 45 inferred relationships involving `User` (e.g. with `ActiveSessionResponse` and `MarshalOverrideResponse`) actually correct?**
  _`User` has 45 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `AsyncSession` (e.g. with `data_removal_request.py` and `student_consent.py`) actually correct?**
  _`AsyncSession` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `Student` (e.g. with `AsyncSession` and `Student`) actually correct?**
  _`Student` has 25 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `AttendanceLog` (e.g. with `ActiveSessionResponse` and `MarshalOverrideResponse`) actually correct?**
  _`AttendanceLog` has 18 INFERRED edges - model-reasoned connections that need verification._