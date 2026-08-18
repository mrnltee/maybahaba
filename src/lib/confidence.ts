import {
  CONFIDENCE_AGREEMENT_SEVERITY_TOLERANCE,
  CONFIDENCE_THRESHOLDS,
  CONFIDENCE_WEIGHTS,
  MAX_COUNTED_COMMUNITY_CONFIRMATIONS,
} from "./config/confidence";
import { getReportFreshness } from "./freshness";
import { getFloodDepthOption, type ConfidenceResult, type FloodReport } from "./types";

/**
 * Community-validation confidence (spec section 16/34).
 *
 * Combines three signals, deliberately weighted so the cheapest one
 * can't dominate:
 *  1. independent nearby reports that agree on depth  (strongest)
 *  2. moderator validation                            (bonus)
 *  3. community "still flooded" taps                  (weakest, capped)
 * minus community accuracy disputes.
 *
 * The raw tally is never shown to users — only the HIGH/MEDIUM/LOW tier
 * and the count of agreeing reports (spec section 34).
 */
export function computeConfidence(
  topReport: FloodReport | null,
  nearbyReports: FloodReport[],
  now: Date = new Date()
): ConfidenceResult {
  if (!topReport) return { level: "NONE", agreeingReportCount: 0 };

  const topSeverity = getFloodDepthOption(topReport.floodDepth).severity;

  const agreeing = nearbyReports.filter((r) => {
    if (getReportFreshness(r, now).level === "EXPIRED") return false;
    if (r.status === "DENIED") return false;
    const severity = getFloodDepthOption(r.floodDepth).severity;
    return Math.abs(severity - topSeverity) <= CONFIDENCE_AGREEMENT_SEVERITY_TOLERANCE;
  });

  const w = CONFIDENCE_WEIGHTS;

  let tally = agreeing.reduce((sum, r) => {
    const base = w.INDEPENDENT_REPORT + (r.status === "VALIDATED" ? w.MODERATOR_VALIDATED_BONUS : 0);

    const confirmations = Math.min(r.stillFloodedCount, MAX_COUNTED_COMMUNITY_CONFIRMATIONS);
    const disputes = r.inaccurateCount + r.noLongerFloodedCount;

    return sum + base + confirmations * w.COMMUNITY_CONFIRMATION - disputes * w.COMMUNITY_DISPUTE;
  }, 0);

  tally = Math.max(0, tally);

  let level: ConfidenceResult["level"];
  if (tally >= CONFIDENCE_THRESHOLDS.HIGH_MIN_AGREEING_REPORTS) level = "HIGH";
  else if (tally >= CONFIDENCE_THRESHOLDS.MEDIUM_MIN_AGREEING_REPORTS) level = "MEDIUM";
  else level = "LOW";

  return { level, agreeingReportCount: agreeing.length };
}
