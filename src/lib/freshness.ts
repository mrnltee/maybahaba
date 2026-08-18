import { FRESHNESS_LABELS, FRESHNESS_THRESHOLDS_MINUTES } from "./config/freshness";
import type { FloodReport, FreshnessResult } from "./types";

/** Computes the freshness tier of a timestamp relative to `now` (spec section 17). */
export function getFreshness(reportedAtIso: string, now: Date = new Date()): FreshnessResult {
  const minutesAgo = Math.max(
    0,
    Math.round((now.getTime() - new Date(reportedAtIso).getTime()) / 60000)
  );

  const t = FRESHNESS_THRESHOLDS_MINUTES;
  let level: FreshnessResult["level"];
  if (minutesAgo <= t.VERY_RECENT_MAX) level = "VERY_RECENT";
  else if (minutesAgo <= t.RECENT_MAX) level = "RECENT";
  else if (minutesAgo <= t.AGING_MAX) level = "AGING";
  else if (minutesAgo <= t.STALE_MAX) level = "STALE";
  else level = "EXPIRED";

  return { level, minutesAgo, label: FRESHNESS_LABELS[level] };
}

/**
 * The timestamp that best represents "how current is this information".
 *
 * A community confirmation ("Oo, may baha pa") is fresh evidence that the
 * condition still holds, so it resets the freshness clock — that's the
 * whole point of letting people confirm rather than forcing them to file
 * a duplicate report. The original `reportedAt` is still what the UI
 * displays as when the flooding was first seen; this is only used for
 * currency/expiry decisions.
 */
export function getEffectiveTimestamp(report: FloodReport): string {
  if (!report.lastConfirmedAt) return report.reportedAt;
  return new Date(report.lastConfirmedAt).getTime() > new Date(report.reportedAt).getTime()
    ? report.lastConfirmedAt
    : report.reportedAt;
}

/** Freshness of a report, accounting for any community confirmations. */
export function getReportFreshness(report: FloodReport, now: Date = new Date()): FreshnessResult {
  return getFreshness(getEffectiveTimestamp(report), now);
}

export function isExpired(reportedAtIso: string, now: Date = new Date()): boolean {
  return getFreshness(reportedAtIso, now).level === "EXPIRED";
}

export function isReportExpired(report: FloodReport, now: Date = new Date()): boolean {
  return getReportFreshness(report, now).level === "EXPIRED";
}
