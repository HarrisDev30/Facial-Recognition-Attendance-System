export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterAttendeeRequest {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  identifier?: string;
  department_id: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: UserProfileResponse;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  attendee_id: string | null;
  attendee_type: string | null;
  profile_photo_url: string | null;
  assigned_org_ids?: string[];
}

export interface AttendeeProfileResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  identifier: string | null;
  attendee_type: string | null;
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
  created_at: string;
  registration_status: string;
  num_embeddings: number;
  consent_given: boolean;
  profile_photo_url: string | null;
}

export interface ConsentStatusResponse {
  has_consented: boolean;
  consent_date: string | null;
  consent_version: string | null;
}

export interface ConsentRequest {
  consent_given: boolean;
  acknowledge_data_privacy: boolean;
}

export interface DataRemovalRequestResponse {
  success: boolean;
  request_id: string;
}

export interface AttendanceLogEntry {
  id: string;
  event_name: string;
  event_type: string | null;
  session_name: string | null;
  session_date: string | null;
  check_in_time: string;
  verification_method: string;
  confidence_score: number | null;
  venue: string | null;
}

export interface AttendanceLogPage {
  items: AttendanceLogEntry[];
  total: number;
  page: number;
  size: number;
}

export interface AttendanceSummary {
  total_events_attended: number;
  total_events_available: number;
  attendance_rate: number;
  last_attendance: string | null;
  attendance_by_type: Record<string, number>;
}

export interface AdminRegisterRequest {
  email: string;
  password: string;
  role: "marshal" | "admin" | "org_admin";
  first_name?: string;
  last_name?: string;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

export interface EventSessionAttendance {
  session_id: string;
  session_name: string;
  venue: string | null;
  start_time: string;
  end_time: string;
  status: string | null;
  verified_at: string | null;
  verification_method: string | null;
  confidence_score: number | null;
}

export interface AttendeeEventAttendance {
  event_id: string;
  event_name: string;
  event_type: string;
  description: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
  sessions: EventSessionAttendance[];
}

export interface DepartmentResponse {
  id: string;
  name: string;
  code: string;
}

export interface DepartmentListResponse {
  items: DepartmentResponse[];
  total: number;
}
