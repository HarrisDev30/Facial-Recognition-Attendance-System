import client from "./client";
import type {
  AttendeeProfileResponse,
  ConsentStatusResponse,
  ConsentRequest,
  DataRemovalRequestResponse,
  AttendanceLogPage,
  AttendanceSummary,
  AttendeeEventAttendance,
} from "../types/auth";

export async function getMyProfile(): Promise<AttendeeProfileResponse> {
  const { data } = await client.get<AttendeeProfileResponse>(
    "/attendees/me/profile",
  );
  return data;
}

export async function updateMyProfile(body: {
  first_name?: string;
  last_name?: string;
  identifier?: string;
}): Promise<AttendeeProfileResponse> {
  const { data } = await client.put<AttendeeProfileResponse>(
    "/attendees/me/profile",
    body,
  );
  return data;
}

export async function giveConsent(
  body: ConsentRequest,
): Promise<{ success: boolean; consent_id: string; consent_date: string }> {
  const { data } = await client.post<{
    success: boolean;
    consent_id: string;
    consent_date: string;
  }>("/attendees/me/consent", body);
  return data;
}

export async function getConsentStatus(): Promise<ConsentStatusResponse> {
  const { data } = await client.get<ConsentStatusResponse>(
    "/attendees/me/consent",
  );
  return data;
}

export async function requestDataRemoval(
  reason?: string,
): Promise<DataRemovalRequestResponse> {
  const { data } = await client.post<DataRemovalRequestResponse>(
    "/attendees/me/data-removal",
    { reason: reason || null },
  );
  return data;
}

export async function uploadProfilePhoto(
  file: Blob,
): Promise<{ success: boolean; profile_photo_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<{
    success: boolean;
    profile_photo_url: string;
  }>("/attendees/me/profile-photo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteProfilePhoto(): Promise<{ success: boolean }> {
  const { data } = await client.delete<{ success: boolean }>(
    "/attendees/me/profile-photo",
  );
  return data;
}

export async function getMyAttendanceLogs(params?: {
  page?: number;
  size?: number;
  sort?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
}): Promise<AttendanceLogPage> {
  const { data } = await client.get<AttendanceLogPage>(
    "/attendance/attendees/me/logs",
    { params },
  );
  return data;
}

export async function getMyAttendanceSummary(): Promise<AttendanceSummary> {
  const { data } = await client.get<AttendanceSummary>(
    "/attendance/attendees/me/summary",
  );
  return data;
}

export async function getMyEventAttendance(
  eventId: string,
): Promise<AttendeeEventAttendance> {
  const { data } = await client.get<AttendeeEventAttendance>(
    `/attendance/attendees/me/events/${eventId}`,
  );
  return data;
}

export interface AttendeeResponse {
  id: string;
  identifier: string;
  first_name: string;
  last_name: string;
  email: string | null;
  attendee_type: string;
  department_id: string;
  department_name: string | null;
  department_code: string | null;
  consent_given: boolean;
  consent_given_at: string | null;
  created_at: string;
}

export interface AttendeeCreate {
  identifier: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  department_id: string;
  attendee_type: string;
}

export async function getAttendees(): Promise<AttendeeResponse[]> {
  const { data } = await client.get<AttendeeResponse[]>("/attendees");
  return data;
}

export async function createAttendee(
  body: AttendeeCreate,
): Promise<AttendeeResponse> {
  const { data } = await client.post<AttendeeResponse>("/attendees", body);
  return data;
}

export async function updateAttendee(
  id: string,
  body: AttendeeCreate,
): Promise<AttendeeResponse> {
  const { data } = await client.put<AttendeeResponse>(`/attendees/${id}`, body);
  return data;
}

export async function deleteAttendee(id: string): Promise<void> {
  await client.delete(`/attendees/${id}`);
}
