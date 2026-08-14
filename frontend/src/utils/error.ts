import axios from "axios";

export function getApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as Record<string, unknown>).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        if (typeof first === "object" && first && "msg" in first) {
          return String(first.msg);
        }
      }
    }
    if (err.response?.status === 404) return "Resource not found (404)";
    if (err.response?.status === 422) return "Validation error: please check input formatting";
    if (err.response?.status === 409) return "Conflict: resource already registered";
    return `Request failed (${err.response?.status ?? "network error"})`;
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}
