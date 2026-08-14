export interface SessionResponse {
  id: string;
  event_id: string;
  name: string;
  venue: string | null;
  start_time: string;
  end_time: string;
  status: string;
  confidence_threshold: number;
  detection_zone: Record<string, unknown> | null;
  activated_at: string | null;
  deactivated_at: string | null;
  created_at: string;
}

export interface SessionCreate {
  name: string;
  venue?: string | null;
  start_time: string;
  end_time: string;
  confidence_threshold?: number;
  detection_zone?: Record<string, unknown> | null;
}

export interface SessionUpdate {
  name?: string;
  venue?: string | null;
  start_time?: string;
  end_time?: string;
  status?: string;
  confidence_threshold?: number;
  detection_zone?: Record<string, unknown> | null;
}
