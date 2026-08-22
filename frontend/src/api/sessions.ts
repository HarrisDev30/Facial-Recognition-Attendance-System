import client from "./client";
import type { SessionCreate, SessionResponse, SessionUpdate } from "../types/session";

export async function getSessions(
  eventId: string,
): Promise<SessionResponse[]> {
  const { data } = await client.get<SessionResponse[]>(
    `/api/events/${eventId}/sessions`,
  );
  return data;
}

export async function createSession(
  eventId: string,
  body: SessionCreate,
): Promise<SessionResponse> {
  const { data } = await client.post<SessionResponse>(
    `/api/events/${eventId}/sessions`,
    body,
  );
  return data;
}

export async function getSession(id: string): Promise<SessionResponse> {
  const { data } = await client.get<SessionResponse>(`/api/sessions/${id}`);
  return data;
}

export async function updateSession(
  id: string,
  body: SessionUpdate,
): Promise<SessionResponse> {
  const { data } = await client.put<SessionResponse>(`/api/sessions/${id}`, body);
  return data;
}

export async function activateSession(
  id: string,
): Promise<SessionResponse> {
  const { data } = await client.patch<SessionResponse>(
    `/api/sessions/${id}/activate`,
  );
  return data;
}

export async function deactivateSession(
  id: string,
): Promise<SessionResponse> {
  const { data } = await client.patch<SessionResponse>(
    `/api/sessions/${id}/deactivate`,
  );
  return data;
}

export async function extendSession(
  id: string,
  minutes: number = 15,
): Promise<SessionResponse> {
  const { data } = await client.post<SessionResponse>(
    `/api/sessions/${id}/extend`,
    { minutes },
  );
  return data;
}
