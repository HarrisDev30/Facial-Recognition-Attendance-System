import client from "./client";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: "cohost_invite" | "event_announcement" | "attendance_checkin" | "system_announcement";
  is_read: boolean;
  link_url?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
}

export async function getMyNotifications(): Promise<NotificationListResponse> {
  const { data } = await client.get<NotificationListResponse>("/notifications");
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await client.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await client.post("/notifications/read-all");
}
