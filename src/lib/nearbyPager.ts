import { getEffectiveTimestamp, isReportExpired } from "./freshness";
import { distanceMeters } from "./geo";
import { getFloodDepthOption, type FloodReport } from "./types";

/**
 * Ordering and filtering for the result card's prev/next stepper.
 *
 * Kept as a pure module so the ordering rules — which are the whole
 * substance of this feature — can be tested without mounting a card.
 *
 * The card used to show only the worst report and a dead line of text
 * saying "1 pang report sa loob ng 300 m", with no way to reach it. A
 * motorist choosing between two routes could see that a second flood
 * existed but not what or where it was.
 */

export interface PagedReport {
  report: FloodReport;
  /** Metres from the searched point, when we can compute it. */
  distanceMeters: number | null;
}

/**
 * Reports worth paging through: inside the radius, not denied, and not
 * stale.
 *
 * Stale reports are excluded rather than labelled. A six-hour-old report
 * is not a flood anyone can route on, and counting it in "2 pang report"
 * would overstate how much live information the app actually holds —
 * which is the same false-confidence problem as treating absence of
 * reports as absence of flooding. They remain visible on the map, where
 * their age is shown alongside them.
 */
export function getPageableReports(
  reports: FloodReport[],
  center: { latitude: number; longitude: number },
  now: Date = new Date()
): PagedReport[] {
  return reports
    .filter((r) => r.status !== "DENIED")
    .filter((r) => !isReportExpired(r, now))
    .map((report) => ({
      report,
      distanceMeters: distanceMeters(
        center.latitude,
        center.longitude,
        report.latitude,
        report.longitude
      ),
    }))
    .sort(compareWorstFirst);
}

/**
 * Worst first, then most recent.
 *
 * Severity leads because the card answers "can I drive through here?",
 * and the deepest water in range is the fact that changes the answer.
 * Recency breaks ties so that between two equally deep reports the
 * fresher observation is shown first.
 *
 * Distance is deliberately NOT part of the ordering. The nearest flood is
 * not the most important one — a knee-deep street 280 m away matters more
 * than a gutter-deep puddle 20 m away.
 */
function compareWorstFirst(a: PagedReport, b: PagedReport): number {
  const severityDelta =
    getFloodDepthOption(b.report.floodDepth).severity -
    getFloodDepthOption(a.report.floodDepth).severity;
  if (severityDelta !== 0) return severityDelta;

  return (
    new Date(getEffectiveTimestamp(b.report)).getTime() -
    new Date(getEffectiveTimestamp(a.report)).getTime()
  );
}

/**
 * Whether the stepper should appear at all. One report needs no
 * navigation, and rendering disabled arrows for a single result is noise.
 */
export function shouldShowPager(pageable: PagedReport[]): boolean {
  return pageable.length > 1;
}

/** Wraps an index into range, so the ends of the list are not dead taps. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}
