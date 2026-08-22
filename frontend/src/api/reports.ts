import client from "./client";

export interface SessionAnalytics {
  session_id: string;
  total_checkins: number;
  method_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
  velocity_timeline: Array<{ time: string; count: number }>;
}

export async function getSessionAnalytics(sessionId: string): Promise<SessionAnalytics> {
  const { data } = await client.get<SessionAnalytics>(`/api/reports/sessions/${sessionId}/analytics`);
  return data;
}

export function getSessionCsvDownloadUrl(sessionId: string): string {
  const baseURL = client.defaults.baseURL || "";
  return `${baseURL}/api/reports/sessions/${sessionId}/csv`;
}

export function getSessionPdfDownloadUrl(sessionId: string): string {
  const baseURL = client.defaults.baseURL || "";
  return `${baseURL}/api/reports/sessions/${sessionId}/pdf`;
}

export async function downloadSessionCsv(sessionId: string): Promise<void> {
  const response = await client.get(`/api/reports/sessions/${sessionId}/csv`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `attendance_session_${sessionId.slice(0, 8)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadSessionPdf(sessionId: string): Promise<void> {
  const response = await client.get(`/api/reports/sessions/${sessionId}/pdf`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `attendance_roster_${sessionId.slice(0, 8)}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
