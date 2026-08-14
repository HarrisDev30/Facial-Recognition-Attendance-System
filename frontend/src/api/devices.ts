import client from "./client";

export interface ScannerDeviceCreate {
  name: string;
  device_type: "dedicated_scanner" | "mobile_scanner";
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

export async function registerDevice(body: ScannerDeviceCreate): Promise<ScannerDevice> {
  const { data } = await client.post<ScannerDevice>("/admin/scanner-devices", body);
  return data;
}

export async function listDevices(): Promise<ScannerDeviceListItem[]> {
  const { data } = await client.get<ScannerDeviceListItem[]>("/admin/scanner-devices");
  return data;
}

export async function getDevice(id: string): Promise<ScannerDevice> {
  const { data } = await client.get<ScannerDevice>(`/admin/scanner-devices/${id}`);
  return data;
}

export async function updateDetectionZone(
  id: string,
  body: { zone_coordinates?: Record<string, number>; face_size_min?: number; confidence_threshold?: number }
): Promise<ScannerDevice> {
  const { data } = await client.post<ScannerDevice>(`/admin/scanner-devices/${id}/detection-zone`, body);
  return data;
}

export async function sendHeartbeat(id: string): Promise<{ success: boolean }> {
  const { data } = await client.put<{ success: boolean }>(`/admin/scanner-devices/${id}/heartbeat`);
  return data;
}
