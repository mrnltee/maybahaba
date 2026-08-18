import {
  DUPLICATE_NEARBY_RADIUS_METERS,
  DUPLICATE_TIME_WINDOW_MINUTES,
} from "./config/freshness";
import { distanceMeters } from "./geo";
import { getFloodDepthOption, type DuplicateCheckResult, type FloodReport } from "./types";

interface CandidateInput {
  latitude: number;
  longitude: number;
  floodDepth: FloodReport["floodDepth"];
  reportedAt: string;
}

/**
 * Duplicate-confidence system (spec section 14).
 *
 * A nearby report is NOT automatically a duplicate. We score it using
 * three independent signals — distance, time gap, condition similarity —
 * and only flag it as a likely duplicate when several agree. The caller
 * still lets the user submit even if it looks like a duplicate.
 */
export function checkForDuplicate(
  candidate: CandidateInput,
  nearbyReports: FloodReport[]
): DuplicateCheckResult {
  let best: { report: FloodReport; score: number; reason: string } | null = null;

  const candidateSeverity = getFloodDepthOption(candidate.floodDepth).severity;
  const candidateTime = new Date(candidate.reportedAt).getTime();

  for (const report of nearbyReports) {
    if (report.status === "DENIED" || report.status === "EXPIRED") continue;

    const distance = distanceMeters(
      candidate.latitude,
      candidate.longitude,
      report.latitude,
      report.longitude
    );
    if (distance > DUPLICATE_NEARBY_RADIUS_METERS) continue;

    const minutesApart = Math.abs(candidateTime - new Date(report.reportedAt).getTime()) / 60000;
    const reportSeverity = getFloodDepthOption(report.floodDepth).severity;
    const severityDelta = Math.abs(reportSeverity - candidateSeverity);

    // Score each signal 0-1, then combine. All three matching strongly is
    // what makes something "likely" — any single signal alone should not.
    const proximityScore = 1 - Math.min(distance / DUPLICATE_NEARBY_RADIUS_METERS, 1);
    const timeScore = 1 - Math.min(minutesApart / (DUPLICATE_TIME_WINDOW_MINUTES * 3), 1);
    const conditionScore = severityDelta === 0 ? 1 : severityDelta === 1 ? 0.5 : 0;

    const sameTimeWindow = minutesApart <= DUPLICATE_TIME_WINDOW_MINUTES;
    const sameCondition = severityDelta <= 1;

    let score: number;
    let reason: string;

    if (sameTimeWindow && sameCondition) {
      score = 0.85 * proximityScore + 0.15;
      reason = "Same location, similar time, and similar flood depth as an existing report.";
    } else if (!sameTimeWindow && sameCondition) {
      // Different time, even if condition matches — probably a fresh
      // observation, not a duplicate.
      score = 0.2 * proximityScore;
      reason = "Nearby report exists but at a different time — likely a separate update.";
    } else if (sameTimeWindow && !sameCondition) {
      score = 0.4 * proximityScore + 0.1 * timeScore;
      reason = "Nearby report at a similar time but with a different flood depth.";
    } else {
      score = 0.15 * proximityScore * timeScore * conditionScore;
      reason = "Nearby report exists but conditions/time differ enough to be separate.";
    }

    if (!best || score > best.score) {
      best = { report, score, reason };
    }
  }

  if (!best) {
    return {
      isDuplicate: false,
      duplicateConfidence: 0,
      existingReport: null,
      reason: "No nearby reports found.",
    };
  }

  return {
    isDuplicate: best.score >= 0.6,
    duplicateConfidence: Math.round(best.score * 100) / 100,
    existingReport: best.report,
    reason: best.reason,
  };
}
