/**
 * Community-validation confidence tiers (spec section 16 / 34).
 *
 * The real formula is intentionally simple for V1 and lives only here so
 * it can grow (validation weight, reporter history, contradiction
 * penalties, etc.) without touching call sites.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Agreeing recent reports required for "High confidence". */
  HIGH_MIN_AGREEING_REPORTS: 4,
  /** Agreeing recent reports required for "Medium confidence". */
  MEDIUM_MIN_AGREEING_REPORTS: 2,
} as const;

/**
 * Two reports "agree" if their flood-depth severity differs by at most
 * this many steps (see FLOOD_DEPTH_OPTIONS severity in lib/types.ts).
 */
export const CONFIDENCE_AGREEMENT_SEVERITY_TOLERANCE = 1;

/**
 * How much each signal contributes to the agreement tally.
 *
 * An independent report is the strongest signal (someone went to the
 * trouble of filing it). A community tap is cheaper to produce, so it
 * counts for less — otherwise a handful of taps could manufacture "high
 * confidence" out of a single unverified report.
 */
export const CONFIDENCE_WEIGHTS = {
  INDEPENDENT_REPORT: 1,
  MODERATOR_VALIDATED_BONUS: 0.5,
  COMMUNITY_CONFIRMATION: 0.34,
  /** Each dispute subtracts this much from the tally. */
  COMMUNITY_DISPUTE: 0.5,
} as const;

/**
 * Community confirmations that count toward confidence for a single
 * report. Caps the payoff of tap-spamming one report.
 */
export const MAX_COUNTED_COMMUNITY_CONFIRMATIONS = 6;

/**
 * Auto-flag a report for moderator review once this many people call it
 * inaccurate AND disputes outnumber confirmations. Flagging only
 * surfaces it in the moderation queue — it never deletes or hides a
 * report on its own, since that would hand a griefer a censorship tool.
 */
export const AUTO_FLAG_INACCURATE_THRESHOLD = 3;
