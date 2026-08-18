/**
 * Freshness thresholds (spec section 17). Centralized here so nothing in
 * the app hardcodes "30 minutes" or "6 hours" inline — tune these and the
 * whole product follows.
 *
 * All values are in minutes, measured from `reportedAt` to now.
 */
export const FRESHNESS_THRESHOLDS_MINUTES = {
  VERY_RECENT_MAX: 30,
  RECENT_MAX: 60,
  AGING_MAX: 180,
  STALE_MAX: 360,
  // Anything beyond STALE_MAX is EXPIRED.
} as const;

export const FRESHNESS_LABELS: Record<
  "VERY_RECENT" | "RECENT" | "AGING" | "STALE" | "EXPIRED",
  string
> = {
  VERY_RECENT: "Very recent",
  RECENT: "Recent",
  AGING: "Aging",
  STALE: "Stale",
  EXPIRED: "Expired",
};

/**
 * Reports older than this are excluded from "current condition" answers
 * entirely (though they remain in the DB for historical analysis, per
 * spec section 17).
 */
export const REPORT_EXPIRY_MINUTES = FRESHNESS_THRESHOLDS_MINUTES.STALE_MAX;

/** Radius used for "nearby reports" / duplicate detection (spec section 6, 14). */
export const NEARBY_RADIUS_METERS = 300;

/** Radius used for possible-duplicate (same time, nearby location) checks. */
export const DUPLICATE_NEARBY_RADIUS_METERS = 300;

/** Minutes within which two reports are considered "same/similar timestamp". */
export const DUPLICATE_TIME_WINDOW_MINUTES = 20;
