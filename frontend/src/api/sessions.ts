import client from "./client";
import type { SessionCreate, SessionResponse, SessionUpdate } from "../types/session";

export async function getSessions(
  eventId: string,
): Promise<SessionResponse[]> {
  const { data } = await client.get<SessionResponse[]>(
    `/events/${eventId}/sessions`,
  );
  return data;
}

export async function createSession(
  eventId: string,
  body: SessionCreate,
): Promise<SessionResponse> {
  const { data } = await client.post<SessionResponse>(
    `/events/${eventId}/sessions`,
    body,
  );
  return data;
}

export async function getSession(id: string): Promise<SessionResponse> {
  const { data } = await client.get<SessionResponse>(`/sessions/${id}`);
  return data;
}

export async function updateSession(
  id: string,
  body: SessionUpdate,
): Promise<SessionResponse> {
  const { data } = await client.put<SessionResponse>(`/sessions/${id}`, body);
  return data;
}

export async function activateSession(
  id: string,
): Promise<SessionResponse> {
  const { data } = await client.patch<SessionResponse>(
    `/sessions/${id}/activate`,
  );
  return data;
}

export async function deactivateSession(
  id: string,
): Promise<SessionResponse> {
  const { data } = await client.patch<SessionResponse>(
    `/sessions/${id}/deactivate`,
  );
  return data;
}
