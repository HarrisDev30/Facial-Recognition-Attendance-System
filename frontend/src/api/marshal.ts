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
}

export async function getMyOverrides(): Promise<MarshalOverride[]> {
  const { data } = await client.get<MarshalOverride[]>("/marshal/overrides");
  return data;
}

export async function getActiveSessions(): Promise<ActiveSession[]> {
  const { data } = await client.get<ActiveSession[]>("/marshal/sessions/active");
  return data;
}
