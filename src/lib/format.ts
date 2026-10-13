export const CATEGORY_EMOJI: Record<string, string> = {
  Music: "🎵",
  Tech: "💻",
  Sports: "🏅",
  Comedy: "🎙️",
  Theatre: "🎭",
  Food: "🍽️",
  Business: "📊",
  Art: "🎨",
  Wellness: "🌱",
};

export const CATEGORIES = [
  "Music",
  "Tech",
  "Sports",
  "Comedy",
  "Theatre",
  "Food",
  "Business",
  "Art",
  "Wellness",
];

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
export function fmtDateLong(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
export function fmtDateTime(d: string | Date) {
  return `${fmtDate(d)}, ${fmtTime(d)}`;
}
export function timeUntil(d: string | Date) {
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `in ${days} day${days > 1 ? "s" : ""}`;
}
export function countdown(totalSeconds: number) {
  const m = Math.max(0, Math.floor(totalSeconds / 60));
  const s = Math.max(0, totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function statusBadge(status: string): string {
  switch (status) {
    case "PUBLISHED": return "badge-green";
    case "CONFIRMED": return "badge-green";
    case "PENDING_PAYMENT": return "badge-amber";
    case "PAUSED": return "badge-amber";
    case "DRAFT": return "badge-slate";
    case "EXPIRED": return "badge-slate";
    case "CANCELLED": return "badge-red";
    case "REFUNDED": return "badge-red";
    case "REJECTED": return "badge-red";
    case "VERIFIED": return "badge-green";
    case "PENDING": return "badge-amber";
    default: return "badge-slate";
  }
}

export function prettyStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
