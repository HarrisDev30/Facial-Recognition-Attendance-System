import client from "./client";

export interface ScannerDeviceCreate {
  name: string;
  device_type: "dedicated_scanner" | "mobile_scanner" | "workstation_laptop";
  location?: string;
}

export interface ScannerDevice {
  id: string;
  name: string;
  device_type: string;
  device_token: string;
  location: string | null;
  last_activity: string | null;
  is_active: boolean;
  status: string;
  face_size_min: number;
  confidence_threshold: number;
  detection_zone: Record<string, number> | null;
  created_at: string;
}

export interface ScannerDeviceListItem {
  id: string;
  name: string;
  device_type: string;
  location: string | null;
  last_activity: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PairingCodeResponse {
  code: string;
  expires_at: string;
  expires_in_seconds: number;
}

export interface DevicePairRequest {
  code: string;
  name: string;
  device_type?: string;
  location?: string;
}

export interface DevicePairResponse {
  device_id: string;
  device_token: string;
  name: string;
  device_type: string;
  location: string | null;
  institution_id: string;
  institution_name: string;
  institution_code: string;
}

export async function generatePairingCode(): Promise<PairingCodeResponse> {
  const { data } = await client.post<PairingCodeResponse>("/api/admin/scanner-devices/generate-pairing-code");
  return data;
}

export async function pairDevice(body: DevicePairRequest): Promise<DevicePairResponse> {
  const { data } = await client.post<DevicePairResponse>("/api/devices/pair", body);
  return data;
}

export async function verifyDeviceToken(deviceToken: string): Promise<{
  valid: boolean;
  device_id: string;
  name: string;
  institution_id: string;
  institution_name: string;
  institution_code: string;
}> {
  const { data } = await client.get(`/api/devices/verify-token/${deviceToken}`);
  return data;
}

export async function registerDevice(body: ScannerDeviceCreate): Promise<ScannerDevice> {
  const { data } = await client.post<ScannerDevice>("/api/admin/scanner-devices", body);
  return data;
}

export async function listDevices(): Promise<ScannerDeviceListItem[]> {
  const { data } = await client.get<ScannerDeviceListItem[]>("/api/admin/scanner-devices");
  return data;
}

export async function getDevice(id: string): Promise<ScannerDevice> {
  const { data } = await client.get<ScannerDevice>(`/api/admin/scanner-devices/${id}`);
  return data;
}

export async function updateDetectionZone(
  id: string,
  body: { zone_coordinates?: Record<string, number>; face_size_min?: number; confidence_threshold?: number }
): Promise<ScannerDevice> {
  const { data } = await client.post<ScannerDevice>(`/api/admin/scanner-devices/${id}/detection-zone`, body);
  return data;
}

export async function sendHeartbeat(id: string): Promise<{ success: boolean }> {
  const { data } = await client.put<{ success: boolean }>(`/api/admin/scanner-devices/${id}/heartbeat`);
  return data;
}
