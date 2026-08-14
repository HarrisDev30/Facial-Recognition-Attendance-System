export const EVENT_TYPE_LABELS: Record<string, string> = {
  intramurals: "Intramurals",
  seminar: "Seminar",
  workshop: "Workshop",
  conference: "Conference",
  campus_activity: "Campus Activity",
  assembly: "Assembly",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  intramurals: "violet",
  seminar: "blue",
  workshop: "cyan",
  conference: "grape",
  campus_activity: "teal",
  assembly: "orange",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "gray",
  active: "green",
  completed: "blue",
  cancelled: "red",
  pending: "gray",
};

export const VERIFICATION_METHOD_LABELS: Record<string, string> = {
  face_recognition: "Facial",
  qr_code: "QR",
  marshal_override: "Manual",
};

export const VERIFICATION_METHOD_COLORS: Record<string, string> = {
  face_recognition: "teal",
  qr_code: "blue",
  marshal_override: "orange",
};
