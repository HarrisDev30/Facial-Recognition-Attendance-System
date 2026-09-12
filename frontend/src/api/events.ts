import client from "./client";
import type {
  EventCreate,
  EventListResponse,
  EventResponse,
  EventUpdate,
  UpcomingEventPage,
} from "../types/event";

export async function getEvents(
  skip = 0,
  limit = 100,
  organization_id?: string,
): Promise<EventListResponse> {
  const params: Record<string, any> = { skip, limit };
  if (organization_id) params.organization_id = organization_id;
  const { data } = await client.get<EventListResponse>("/events", {
    params,
  });
  return data;
}

export async function createEvent(body: EventCreate): Promise<EventResponse> {
  const { data } = await client.post<EventResponse>("/events", body);
  return data;
}

export async function getEvent(id: string): Promise<EventResponse> {
  const { data } = await client.get<EventResponse>(`/events/${id}`);
  return data;
}

export async function updateEvent(
  id: string,
  body: EventUpdate,
): Promise<EventResponse> {
  const { data } = await client.put<EventResponse>(`/events/${id}`, body);
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  await client.delete(`/events/${id}`);
}

export async function getUpcomingEvents(
  page = 1,
  size = 20,
): Promise<UpcomingEventPage> {
  const { data } = await client.get<UpcomingEventPage>("/events/upcoming", {
    params: { page, size },
  });
  return data;
}

export async function getAllEvents(
  page = 1,
  size = 100,
): Promise<UpcomingEventPage> {
  const { data } = await client.get<UpcomingEventPage>("/events/all", {
    params: { page, size },
  });
  return data;
}

export async function uploadEventPhoto(
  eventId: string,
  file: Blob,
): Promise<{ success: boolean; photo_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post(`/events/${eventId}/photo`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteEventPhoto(
  eventId: string,
): Promise<{ success: boolean }> {
  const { data } = await client.delete(`/events/${eventId}/photo`);
  return data;
}
