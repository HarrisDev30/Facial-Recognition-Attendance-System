export interface InstitutionSummaryMetrics {
  total_students: number;
  total_faculty: number;
  total_colleges: number;
  total_clubs: number;
  total_events: number;
  active_sessions_count: number;
  active_devices_count: number;
  total_devices_count: number;
  overall_attendance_rate: number;
  biometric_accuracy_rate: number;
  total_checkins: number;
}

export interface CollegeAttendanceBenchmark {
  id: string;
  name: string;
  code: string;
  enrolled_count: number;
  attended_count: number;
  attendance_rate: number;
  total_events_hosted: number;
}

export interface HourlyTrafficEntry {
  hour: string;
  hour_label: string;
  checkins: number;
  face_count: number;
  qr_count: number;
  marshal_count: number;
}

export interface VerificationMethodMetric {
  method: string;
  method_label: string;
  count: number;
  percentage: number;
  avg_confidence: number | null;
}

export interface AtRiskStudentEntry {
  id: string;
  identifier: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department_name: string | null;
  department_code: string | null;
  events_attended: number;
  events_available: number;
  attendance_rate: number;
}
