import { describe, expect, it } from "vitest";
import {
  getFollowUpDepthChoices,
  getFollowUpPrompt,
  getFollowUpStateKind,
  isRedundantFollowUp,
  isValidFollowUpTransition,
} from "../followUp";
import { FLOOD_DEPTH_OPTIONS, type FloodDepthCode } from "../types";

const ACTIVE: FloodDepthCode[] = [
  "GUTTER_DEEP",
  "BUKONG_BUKONG",
  "BINTI",
  "TUHOD",
  "HITA",
  "BAYWANG",
  "HINDI_MADAANAN",
];

describe("state classification", () => {
  it("classifies the three states", () => {
    expect(getFollowUpStateKind("WALANG_BAHA")).toBe("NO_FLOOD");
    expect(getFollowUpStateKind("HUMUPA_NA")).toBe("SUBSIDED");
    for (const code of ACTIVE) {
      expect(getFollowUpStateKind(code)).toBe("ACTIVE_FLOOD");
    }
  });

  it("treats every active depth the same — no depth is special-cased", () => {
    const prompts = ACTIVE.map((c) => getFollowUpPrompt(c));
    const questions = new Set(prompts.map((p) => p.question));
    expect(questions.size).toBe(1);
    expect([...questions][0]).toBe("May baha pa ba?");
  });
});

describe("the spec's transition table", () => {
  it("walang baha → 'May baha na ba?', no dismisses", () => {
    const p = getFollowUpPrompt("WALANG_BAHA");
    expect(p.question).toBe("May baha na ba?");
    expect(p.yesLabel).toBe("Oo, may baha na");
    expect(p.noLabel).toBe("Wala pa");
    expect(p.noOutcome).toEqual({ kind: "DISMISS" });
  });

  it("active flood → 'May baha pa ba?', no files HUMUPA_NA", () => {
    for (const code of ACTIVE) {
      const p = getFollowUpPrompt(code);
      expect(p.question).toBe("May baha pa ba?");
      expect(p.yesLabel).toBe("Oo, may baha pa");
      expect(p.noLabel).toBe("Wala na");
      expect(p.noOutcome).toEqual({ kind: "SUBMIT", depth: "HUMUPA_NA" });
    }
  });

  it("humupa na → 'May baha ba ulit?', no dismisses", () => {
    const p = getFollowUpPrompt("HUMUPA_NA");
    expect(p.question).toBe("May baha ba ulit?");
    expect(p.yesLabel).toBe("Oo, may baha");
    expect(p.noLabel).toBe("Wala pa");
    expect(p.noOutcome).toEqual({ kind: "DISMISS" });
  });

  it("only the active-flood state writes anything on 'no'", () => {
    // Scenarios A and E both say the status must be unchanged, so a
    // dismiss must never reach the network.
    expect(getFollowUpPrompt("WALANG_BAHA").noOutcome.kind).toBe("DISMISS");
    expect(getFollowUpPrompt("HUMUPA_NA").noOutcome.kind).toBe("DISMISS");
    expect(getFollowUpPrompt("TUHOD").noOutcome.kind).toBe("SUBMIT");
  });
});

describe("depth choices", () => {
  it("disables exactly the current depth, and keeps it visible", () => {
    const choices = getFollowUpDepthChoices("TUHOD");
    const disabled = choices.filter((c) => c.disabled);
    expect(disabled).toHaveLength(1);
    expect(disabled[0].option.code).toBe("TUHOD");
    expect(disabled[0].disabledReason).toBeTruthy();
    // Visible, not removed — the user needs to see the standing report.
    expect(choices).toHaveLength(FLOOD_DEPTH_OPTIONS.length);
  });

  it("disables walang baha when that is the current state", () => {
    const choices = getFollowUpDepthChoices("WALANG_BAHA");
    expect(choices.find((c) => c.option.code === "WALANG_BAHA")?.disabled).toBe(true);
    expect(choices.filter((c) => c.disabled)).toHaveLength(1);
  });

  it("never offers HUMUPA_NA as a depth, from any state", () => {
    for (const code of [...ACTIVE, "WALANG_BAHA", "HUMUPA_NA"] as FloodDepthCode[]) {
      const choices = getFollowUpDepthChoices(code);
      expect(choices.some((c) => c.option.code === "HUMUPA_NA")).toBe(false);
    }
  });

  it("disables nothing when coming from humupa na — every depth is a change", () => {
    const choices = getFollowUpDepthChoices("HUMUPA_NA");
    expect(choices.filter((c) => c.disabled)).toHaveLength(0);
  });
});

describe("write-path guards", () => {
  it("rejects submitting the current state again", () => {
    for (const code of [...ACTIVE, "WALANG_BAHA", "HUMUPA_NA"] as FloodDepthCode[]) {
      expect(isRedundantFollowUp(code, code)).toBe(true);
      expect(isValidFollowUpTransition(code, code)).toBe(false);
    }
  });

  it("allows a genuine depth change", () => {
    expect(isValidFollowUpTransition("TUHOD", "BAYWANG")).toBe(true);
    expect(isValidFollowUpTransition("WALANG_BAHA", "GUTTER_DEEP")).toBe(true);
    expect(isValidFollowUpTransition("HUMUPA_NA", "TUHOD")).toBe(true);
  });

  it("allows humupa na only from an active flood", () => {
    for (const code of ACTIVE) {
      expect(isValidFollowUpTransition(code, "HUMUPA_NA")).toBe(true);
    }
    // "The flood subsided" is not a meaningful claim about a place whose
    // standing report says there was no flood.
    expect(isValidFollowUpTransition("WALANG_BAHA", "HUMUPA_NA")).toBe(false);
    expect(isValidFollowUpTransition("HUMUPA_NA", "HUMUPA_NA")).toBe(false);
  });
});

describe("scenarios A-F from the spec", () => {
  /** Walks the machine the way the UI does, returning the resulting write. */
  function walk(
    current: FloodDepthCode,
    answer: "yes",
    pick: FloodDepthCode
  ): FloodDepthCode | null;
  function walk(current: FloodDepthCode, answer: "no"): FloodDepthCode | null;
  function walk(
    current: FloodDepthCode,
    answer: "yes" | "no",
    pick?: FloodDepthCode
  ): FloodDepthCode | null {
    const prompt = getFollowUpPrompt(current);
    if (answer === "no") {
      return prompt.noOutcome.kind === "DISMISS" ? null : prompt.noOutcome.depth;
    }
    const choice = getFollowUpDepthChoices(current).find((c) => c.option.code === pick);
    if (!choice || choice.disabled) throw new Error(`${pick} is not selectable from ${current}`);
    return choice.option.code;
  }

  it("A: walang baha → wala pa → nothing written", () => {
    expect(walk("WALANG_BAHA", "no")).toBeNull();
  });

  it("B: walang baha → may baha → new depth written, walang baha unselectable", () => {
    expect(walk("WALANG_BAHA", "yes", "TUHOD")).toBe("TUHOD");
    expect(() => walk("WALANG_BAHA", "yes", "WALANG_BAHA")).toThrow();
  });

  it("C: active → still flooding → another depth, current unselectable", () => {
    expect(walk("BUKONG_BUKONG", "yes", "TUHOD")).toBe("TUHOD");
    expect(() => walk("BUKONG_BUKONG", "yes", "BUKONG_BUKONG")).toThrow();
  });

  it("D: active → wala na → humupa na", () => {
    expect(walk("BUKONG_BUKONG", "no")).toBe("HUMUPA_NA");
  });

  it("E: humupa na → wala pa → nothing written", () => {
    expect(walk("HUMUPA_NA", "no")).toBeNull();
  });

  it("F: humupa na → may baha ulit → new depth written", () => {
    expect(walk("HUMUPA_NA", "yes", "HITA")).toBe("HITA");
  });
});
