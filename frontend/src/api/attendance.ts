import client from "./client";

export interface AttendanceLogResponse {
  id: string;
  session_id: string;
  attendee_id: string;
  attendee_name: string | null;
  department_name: string | null;
  attendee_type: string | null;
  verified_at: string;
  verification_method: string;
  confidence_score: number | null;
  marshal_id: string | null;
  created_at: string;
}

export interface CheckInRequest {
  session_id: string;
  attendee_id: string;
  verification_method: "face_recognition" | "qr_code" | "marshal_override";
  confidence_score?: number | null;
}

export interface AttendanceSummary {
  session_id: string;
  session_name: string;
  total_attendees: number;
  present_count: number;
  absent_count: number;
}

export async function checkIn(
  body: CheckInRequest,
): Promise<AttendanceLogResponse> {
  const { data } = await client.post<AttendanceLogResponse>(
    "/attendance/check-in",
    body,
  );
  return data;
}

export async function getSessionLogs(
  sessionId: string,
): Promise<AttendanceLogResponse[]> {
  const { data } = await client.get<AttendanceLogResponse[]>(
    `/attendance/sessions/${sessionId}/logs`,
  );
  return data;
}

export async function getAttendeeLogs(
  attendeeId: string,
): Promise<AttendanceLogResponse[]> {
  const { data } = await client.get<AttendanceLogResponse[]>(
    `/attendance/attendees/${attendeeId}/logs`,
  );
  return data;
}

export async function getSessionSummary(
  sessionId: string,
): Promise<AttendanceSummary> {
  const { data } = await client.get<AttendanceSummary>(
    `/attendance/sessions/${sessionId}/summary`,
  );
  return data;
}
