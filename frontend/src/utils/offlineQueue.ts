/**
 * Offline Influx Queue & Resilient Auto-Sync Engine (codebase-design)
 * Deep module that abstracts browser storage, queue buffering, deduplication,
 * and automatic synchronization over flaky campus gate Wi-Fi / cellular.
 */
import client from "../api/client";

export interface QueuedScanItem {
  id: string; // Unique client UUID
  session_id: string;
  attendee_id: string;
  student_name?: string;
  student_identifier?: string;
  verification_method: "face_recognition" | "qr_code" | "marshal_override";
  confidence_score?: number;
  verified_at: string;
  reason?: string;
  queued_at: string;
}

const STORAGE_KEY = "attendify_offline_scans_queue";

export function getOfflineQueue(): QueuedScanItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getPendingQueueCount(): number {
  return getOfflineQueue().length;
}

export function enqueueOfflineScan(scan: Omit<QueuedScanItem, "id" | "queued_at">): QueuedScanItem {
  const queue = getOfflineQueue();
  
  // Deduplicate against local queue for same session + attendee
  const existing = queue.find(
    (item) => item.session_id === scan.session_id && item.attendee_id === scan.attendee_id
  );
  if (existing) {
    return existing;
  }

  const newItem: QueuedScanItem = {
    ...scan,
    id: `queued_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    queued_at: new Date().toISOString(),
  };

  queue.push(newItem);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Local storage quota fallback
  }

  window.dispatchEvent(new CustomEvent("attendify_offline_queue_changed", { detail: { count: queue.length } }));
  return newItem;
}

export function removeQueuedScans(idsToRemove: string[]): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter((item) => !idsToRemove.includes(item.id));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
  window.dispatchEvent(new CustomEvent("attendify_offline_queue_changed", { detail: { count: filtered.length } }));
}

export async function flushOfflineQueue(): Promise<{ synced: number; duplicate: number; remaining: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, duplicate: 0, remaining: 0 };
  }

  if (!navigator.onLine) {
    return { synced: 0, duplicate: 0, remaining: queue.length };
  }

  try {
    const payload = {
      scans: queue.map((q) => ({
        session_id: q.session_id,
        attendee_id: q.attendee_id,
        verification_method: q.verification_method,
        confidence_score: q.confidence_score,
        verified_at: q.verified_at,
        reason: q.reason,
      })),
    };

    const res = await client.post<{ synced_count: number; duplicate_count: number }>("/api/marshal/sync-batch", payload);

    // On successful sync, clear the processed scans
    removeQueuedScans(queue.map((q) => q.id));

    return {
      synced: res.data.synced_count,
      duplicate: res.data.duplicate_count,
      remaining: getPendingQueueCount(),
    };
  } catch {
    return { synced: 0, duplicate: 0, remaining: queue.length };
  }
}

/**
 * Initializes automatic background synchronization when internet connection is restored.
 */
export function initOfflineSyncWatcher(onStatusChange?: (count: number, isOnline: boolean) => void): () => void {
  const handleOnline = () => {
    if (onStatusChange) onStatusChange(getPendingQueueCount(), true);
    flushOfflineQueue().then((res) => {
      if (onStatusChange) onStatusChange(res.remaining, true);
    });
  };

  const handleOffline = () => {
    if (onStatusChange) onStatusChange(getPendingQueueCount(), false);
  };

  const handleQueueChange = (e: any) => {
    if (onStatusChange) onStatusChange(e.detail?.count ?? getPendingQueueCount(), navigator.onLine);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  window.addEventListener("attendify_offline_queue_changed", handleQueueChange);

  // Initial trigger
  if (onStatusChange) onStatusChange(getPendingQueueCount(), navigator.onLine);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("attendify_offline_queue_changed", handleQueueChange);
  };
}
