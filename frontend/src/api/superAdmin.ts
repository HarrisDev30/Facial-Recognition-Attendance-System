import client from "./client";

export interface SystemStatus {
  maintenance_mode: boolean;
  announcement: string;
  target_campus?: string;
  banner_type?: string;
  version: string;
  updated_at: string;
}

export interface PlatformTelemetry {
  platform: {
    uptime_seconds: number;
    version: string;
    rss_memory_mb: number;
    cpu_percent: number;
  };
  counts: {
    total_institutions: number;
    active_institutions: number;
    total_attendees: number;
    total_checkins: number;
    total_devices: number;
    online_devices: number;
  };
  vector_engine: {
    active_indices_count: number;
    indices: Array<{
      institution_id: string;
      institution_name: string;
      vector_count: number;
      dimension: number;
      idle_seconds: number;
    }>;
  };
  maintenance: SystemStatus;
}

export interface InstitutionItem {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  brand_color?: string | null;
  is_active: boolean;
  created_at: string;
  attendee_count: number;
  event_count: number;
  device_count: number;
  admin_email: string | null;
}

export interface InstitutionOnboardRequest {
  name: string;
  code: string;
  logo_url?: string;
  brand_color?: string;
  contact_email?: string;
  admin_email: string;
  admin_password: string;
  admin_first_name?: string;
  admin_last_name?: string;
}

export interface GlobalDeviceItem {
  id: string;
  name: string;
  device_type: string;
  location: string | null;
  is_active: boolean;
  last_activity: string | null;
  is_online: boolean;
  institution_id: string;
  institution_name: string;
  institution_code: string;
}

export async function getTelemetry(): Promise<PlatformTelemetry> {
  const { data } = await client.get<PlatformTelemetry>("/api/super-admin/telemetry");
  return data;
}

export async function getSuperAdminInstitutions(): Promise<InstitutionItem[]> {
  const { data } = await client.get<InstitutionItem[]>("/api/super-admin/institutions");
  return data;
}

export async function onboardInstitution(body: InstitutionOnboardRequest): Promise<{ success: boolean; institution_id: string; name: string; code: string; admin_email: string }> {
  const { data } = await client.post("/api/super-admin/institutions", body);
  return data;
}

export async function toggleInstitutionActive(institutionId: string): Promise<{ success: boolean; institution_id: string; is_active: boolean }> {
  const { data } = await client.patch(`/api/super-admin/institutions/${institutionId}/toggle-active`);
  return data;
}

export async function getGlobalDevices(): Promise<GlobalDeviceItem[]> {
  const { data } = await client.get<GlobalDeviceItem[]>("/api/super-admin/devices");
  return data;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const { data } = await client.get<SystemStatus>("/api/public/system-status");
  return data;
}

export async function updateSystemStatus(body: {
  maintenance_mode: boolean;
  announcement: string;
  target_campus?: string;
  banner_type?: string;
}): Promise<SystemStatus> {
  const { data } = await client.post<SystemStatus>("/api/super-admin/system-status", body);
  return data;
}

export interface InstitutionUpdateRequest {
  name: string;
  code: string;
  logo_url?: string | null;
  brand_color?: string | null;
  is_active: boolean;
}

export interface MultiCampusAnalytics {
  daily_attendance: Array<{ date: string; [campusCode: string]: any }>;
  biometric_telemetry: {
    status: string;
    model: string;
    engine: string;
    active_indices: number;
    total_vectors_in_memory: number;
    avg_match_latency_ms: number;
    avg_confidence: number;
  };
  scanner_fleet: {
    total: number;
    online: number;
    offline: number;
  };
  campus_shares: Array<{
    institution_id: string;
    name: string;
    code: string;
    attendees: number;
    events: number;
    devices: number;
    total_scans: number;
    is_active: boolean;
  }>;
}

export async function updateInstitution(
  institutionId: string,
  body: InstitutionUpdateRequest
): Promise<{ id: string; name: string; code: string; logo_url: string | null; is_active: boolean }> {
  const { data } = await client.put(`/api/super-admin/institutions/${institutionId}`, body);
  return data;
}

export async function resetInstitutionAdmin(
  institutionId: string,
  newPassword: string
): Promise<{ success: boolean; email: string; message: string }> {
  const { data } = await client.post(`/api/super-admin/institutions/${institutionId}/reset-admin`, {
    new_password: newPassword,
  });
  return data;
}

export async function getMultiCampusAnalytics(): Promise<MultiCampusAnalytics> {
  const { data } = await client.get<MultiCampusAnalytics>("/api/super-admin/analytics/multi-campus");
  return data;
}

export async function clearSystemStatus(): Promise<SystemStatus> {
  const { data } = await client.post<SystemStatus>("/api/super-admin/system-status/clear");
  return data;
}
