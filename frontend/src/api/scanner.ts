import client from "./client";
import type {
  FrameProcessResponse,
  LiveStats,
  ManualOverrideResponse,
  QRCheckInResponse,
} from "../types/scanner";

export async function processFrame(
  sessionId: string,
  imageBlob: Blob,
): Promise<FrameProcessResponse> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("file", imageBlob, "frame.jpg");
  const { data } = await client.post<FrameProcessResponse>(
    "/scanner/frame",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 15000,
    },
  );
  return data;
}

export async function qrCheckIn(
  sessionId: string,
  attendeeId?: string,
  token?: string,
): Promise<QRCheckInResponse> {
  const { data } = await client.post<QRCheckInResponse>("/scanner/qr-checkin", {
    session_id: sessionId,
    attendee_id: attendeeId,
    token,
  });
  return data;
}

export async function manualOverride(
  sessionId: string,
  attendeeId: string,
  reason?: string,
): Promise<ManualOverrideResponse> {
  const { data } = await client.post<ManualOverrideResponse>(
    "/scanner/manual-override",
    { session_id: sessionId, attendee_id: attendeeId, reason },
  );
  return data;
}

export async function getLiveStats(
  sessionId: string,
): Promise<LiveStats> {
  const { data } = await client.get<LiveStats>(
    `/scanner/${sessionId}/live-stats`,
  );
  return data;
}

export function buildWsUrl(sessionId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const token = localStorage.getItem("token");
  const base = `${proto}//${window.location.host}/api/scanner/${sessionId}/stream`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
