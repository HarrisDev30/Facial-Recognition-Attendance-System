export interface FaceIdentification {
  index: number;
  attendee_id?: string;
  attendee_name?: string;
  confidence_score?: number;
  already_checked_in?: boolean;
  message: string;
  bbox?: number[];
}

export interface FrameProcessResponse {
  face_count: number;
  identified: boolean;
  new_checkin_count: number;
  identifications: FaceIdentification[];
}

export interface QRCheckInResponse {
  success: boolean;
  attendee_name?: string;
  message: string;
}

export interface ManualOverrideResponse {
  success: boolean;
  attendee_name?: string;
  message: string;
}

export interface RecentCheckIn {
  attendee_name: string;
  timestamp: string;
  method: string;
}

export interface LiveStats {
  total_checked_in: number;
  total_registered: number;
  check_in_rate: number;
  recent_check_ins: RecentCheckIn[];
}

export interface WSMessage {
  event: string;
  attendee_name?: string;
  attendee_id?: string;
  confidence_score?: number;
  timestamp?: string;
  verification_method?: string;
  total_attended?: number;
  type?: string;
  message?: string;
}
