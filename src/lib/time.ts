import { formatInTimeZone } from "date-fns-tz";

export const PH_TIME_ZONE = "Asia/Manila";

/** Formats a UTC ISO timestamp as Philippine local time, e.g. "August 18, 2026 · 5:42 PM". */
export function formatPhTime(isoUtc: string): string {
  return formatInTimeZone(new Date(isoUtc), PH_TIME_ZONE, "MMMM d, yyyy '·' h:mm a");
}

/** Short form for cards, e.g. "5:42 PM". */
export function formatPhTimeShort(isoUtc: string): string {
  return formatInTimeZone(new Date(isoUtc), PH_TIME_ZONE, "h:mm a");
}

/** Relative "x minutes ago" phrasing used throughout the UI. */
export function formatRelativeTime(isoUtc: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(isoUtc).getTime()) / 60000));
  if (minutes < 1) return "Ngayon lang";
  if (minutes < 60) return `${minutes} minuto${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} oras ago`;
  const days = Math.floor(hours / 24);
  return `${days} araw ago`;
}

/** Converts a `<input type="datetime-local">` value (interpreted as PH local time) to a UTC ISO string. */
export function phLocalInputToUtcIso(localValue: string): string {
  // localValue looks like "2026-08-18T17:42". Treat it as Asia/Manila (UTC+8) wall time.
  const [datePart, timePart] = localValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  // UTC+8 fixed offset, no DST in the Philippines.
  const utcMs = Date.UTC(year, month - 1, day, hour - 8, minute);
  return new Date(utcMs).toISOString();
}

/** Converts a UTC ISO string to the value a `<input type="datetime-local">` expects, in PH time. */
export function utcIsoToPhLocalInput(isoUtc: string): string {
  return formatInTimeZone(new Date(isoUtc), PH_TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
}
