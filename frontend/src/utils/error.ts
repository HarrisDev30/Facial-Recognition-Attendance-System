import axios from "axios";

export function getApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail =
      err.response?.data &&
      typeof err.response.data === "object" &&
      "detail" in err.response.data
        ? String((err.response.data as Record<string, unknown>).detail)
        : null;
    if (detail) return detail;
    if (err.response?.status === 404) return "Resource not found";
    if (err.response?.status === 422) return "Validation error: please check your input";
    if (err.response?.status === 409) return "Conflict: resource already exists";
    return `Request failed (${err.response?.status ?? "network error"})`;
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}
