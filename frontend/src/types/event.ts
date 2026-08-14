export interface EventResponse {
  id: string;
  name: string;
  event_type: string;
  description: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
  status: string;
  department_id: string | null;
  department_code: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  photo_url: string | null;
}

export interface EventCreate {
  name: string;
  event_type: string;
  description?: string | null;
  venue?: string | null;
  start_date: string;
  end_date: string;
  department_id?: string | null;
}

export interface EventUpdate {
  name?: string;
  event_type?: string;
  description?: string | null;
  venue?: string | null;
  start_date?: string;
  end_date?: string;
  status?: string;
  department_id?: string | null;
}

export interface EventListResponse {
  items: EventResponse[];
  total: number;
}

export interface UpcomingEvent {
  id: string;
  name: string;
  event_type: string;
  description: string | null;
  venue: string | null;
  date: string;
  sessions_count: number;
  active_sessions_count: number;
  photo_url: string | null;
}

export interface UpcomingEventPage {
  items: UpcomingEvent[];
  total: number;
  page: number;
  size: number;
}

