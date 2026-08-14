export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

export function formatConfidence(score: number | null | undefined): string {
  if (score == null) return "\u2014";
  return `${(score * 100).toFixed(1)}%`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} \u2014 ${formatTime(end)}`;
}

export function greeting(name?: string): string {
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : "afternoon";
  return name ? `Good ${period}, ${name}!` : `Good ${period}!`;
}
