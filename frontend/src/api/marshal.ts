import client from "./client";

export interface MarshalOverride {
  id: string;
  attendee_name: string | null;
  session_name: string | null;
  event_name: string | null;
  reason: string | null;
  timestamp: string;
}

export interface ActiveSession {
  session_id: string;
  session_name: string;
  event_id: string;
  event_name: string;
  event_type: string | null;
  venue: string | null;
  start_time: string;
  end_time: string;
  checked_in_count: number | null;
  total_registered: number | null;
  organization_id?: string | null;
}

export interface UpcomingSessionItem {
  id: string;
  name: string;
  venue: string | null;
  start_time: string;
  end_time: string;
  status: string;
}

export interface MarshalUpcomingEvent {
  id: string;
  name: string;
  event_type: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
  organization_name: string | null;
  photo_url?: string | null;
  sessions: UpcomingSessionItem[];
}

export async function getMyOverrides(): Promise<MarshalOverride[]> {
  const { data } = await client.get<MarshalOverride[]>("/api/marshal/overrides");
  return data;
}

export async function getActiveSessions(organization_id?: string): Promise<ActiveSession[]> {
  const params: Record<string, any> = {};
  if (organization_id) params.organization_id = organization_id;
  const { data } = await client.get<ActiveSession[]>("/api/marshal/sessions/active", {
    params,
  });
  return data;
}

export async function getMarshalUpcomingEvents(): Promise<MarshalUpcomingEvent[]> {
  const { data } = await client.get<MarshalUpcomingEvent[]>("/api/marshal/events/upcoming");
  return data;
}

export async function activateSession(sessionId: string): Promise<void> {
  await client.patch(`/api/sessions/${sessionId}/activate`);
}

export async function extendSession(sessionId: string, minutes: number = 15): Promise<void> {
  await client.post(`/api/sessions/${sessionId}/extend`, { minutes });
}
