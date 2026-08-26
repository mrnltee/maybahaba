import {
  FLOOD_DEPTH_OPTIONS,
  isActiveFlood,
  type FloodDepthCode,
  type FloodDepthOption,
} from "./types";

/**
 * The "Tulungan ang susunod" state machine.
 *
 * Every rule about what we ask, what the two answers do, and which depth
 * is unselectable lives here — not scattered through the card. The UI
 * asks this module what to render and what a tap means; it decides
 * nothing itself. That is what makes the eight test scenarios checkable
 * without a browser.
 *
 * The shape of the conversation, from the spec:
 *
 *   WALANG_BAHA   "May baha na ba?"    yes → pick depth   no → dismiss
 *   active flood  "May baha pa ba?"    yes → pick depth   no → HUMUPA_NA
 *   HUMUPA_NA     "May baha ba ulit?"  yes → pick depth   no → dismiss
 */

export type FollowUpStateKind = "NO_FLOOD" | "ACTIVE_FLOOD" | "SUBSIDED";

/** What tapping the "no" button does. */
export type NoOutcome =
  | { kind: "DISMISS" }
  /** File a follow-up recording that the water has gone. */
  | { kind: "SUBMIT"; depth: FloodDepthCode };

export interface FollowUpPrompt {
  state: FollowUpStateKind;
  /** The question, e.g. "May baha pa ba?" */
  question: string;
  yesLabel: string;
  noLabel: string;
  /** Tapping "yes" always leads to the depth picker. */
  noOutcome: NoOutcome;
  /**
   * Screen-reader context so the question is not ambiguous out of
   * context — "May baha pa ba?" alone does not say what it refers to.
   */
  accessibleContext: string;
}

export function getFollowUpStateKind(current: FloodDepthCode): FollowUpStateKind {
  if (current === "HUMUPA_NA") return "SUBSIDED";
  if (isActiveFlood(current)) return "ACTIVE_FLOOD";
  return "NO_FLOOD";
}

export function getFollowUpPrompt(current: FloodDepthCode): FollowUpPrompt {
  const state = getFollowUpStateKind(current);

  switch (state) {
    case "NO_FLOOD":
      return {
        state,
        question: "May baha na ba?",
        yesLabel: "Oo, may baha na",
        noLabel: "Wala pa",
        // Nothing to record: "still no flood" is what the report already
        // says, so a dismiss keeps the data honest rather than padding
        // it with a confirmation that changes nothing.
        noOutcome: { kind: "DISMISS" },
        accessibleContext:
          "Ang huling report dito ay walang baha. May baha na ba ngayon?",
      };

    case "ACTIVE_FLOOD":
      return {
        state,
        question: "May baha pa ba?",
        yesLabel: "Oo, may baha pa",
        noLabel: "Wala na",
        noOutcome: { kind: "SUBMIT", depth: "HUMUPA_NA" },
        accessibleContext: "May naiulat na baha dito. May baha pa ba ngayon?",
      };

    case "SUBSIDED":
      return {
        state,
        question: "May baha ba ulit?",
        yesLabel: "Oo, may baha",
        noLabel: "Wala pa",
        noOutcome: { kind: "DISMISS" },
        accessibleContext:
          "Naiulat na humupa na ang baha dito. May baha ba ulit ngayon?",
      };
  }
}

/**
 * The depth options offered in the follow-up, with the current one
 * disabled rather than hidden.
 *
 * Disabled-not-hidden is deliberate: seeing "Tuhod" greyed out with
 * "kasalukuyang report" against it tells the user what the standing
 * report says, which is the context they need to judge whether anything
 * has changed. Removing it would silently renumber the list and lose
 * that.
 *
 * HUMUPA_NA is never in this list — it is not a depth, and reaching
 * "the water is gone" is what the "Wala na" button is for.
 */
export interface FollowUpDepthChoice {
  option: FloodDepthOption;
  disabled: boolean;
  /** Why it is disabled, for the visible hint and the accessible name. */
  disabledReason: string | null;
}

export function getFollowUpDepthChoices(current: FloodDepthCode): FollowUpDepthChoice[] {
  return FLOOD_DEPTH_OPTIONS.map((option) => {
    const disabled = option.code === current;
    return {
      option,
      disabled,
      disabledReason: disabled ? "Ito na ang kasalukuyang report" : null,
    };
  });
}

/**
 * Guard for the write path. The disabled radio stops this in the UI, but
 * the same rule has to hold server-side — a resubmission of the current
 * state is noise in the data and inflates the report count for a
 * location where nothing changed.
 */
export function isRedundantFollowUp(
  current: FloodDepthCode,
  next: FloodDepthCode
): boolean {
  return current === next;
}

/**
 * Whether a code may be submitted as a follow-up at all. HUMUPA_NA is
 * allowed (via "Wala na"), but only from an active flood — claiming a
 * flood subsided when the standing report says there was none is not a
 * meaningful observation.
 */
export function isValidFollowUpTransition(
  current: FloodDepthCode,
  next: FloodDepthCode
): boolean {
  if (isRedundantFollowUp(current, next)) return false;
  if (next === "HUMUPA_NA") return getFollowUpStateKind(current) === "ACTIVE_FLOOD";
  return true;
}
