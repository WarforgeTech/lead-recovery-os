// These run in client components (lead-work-card, imports-list) as well as on
// the server. Intl.DateTimeFormat uses the runtime's local timezone unless one
// is pinned, so an unpinned formatter renders UTC on the server (Vercel) and
// local time in the browser — a guaranteed hydration text mismatch (React #418).
// Pinning the timeZone makes server and client emit identical strings. The data
// is stored/created in UTC, so UTC is the consistent reference.
const TIME_ZONE = "UTC";

export function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}
