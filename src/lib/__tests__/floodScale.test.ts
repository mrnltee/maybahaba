import { describe, expect, it } from "vitest";
import {
  DEPTH_SCALE,
  formatWaterline,
  getCodeAtIndex,
  getScaleIndex,
  getWaterlineCm,
  getWaterlineFraction,
  isImpassable,
} from "../floodScale";
import { FLOOD_DEPTH_OPTIONS, type FloodDepthCode } from "../types";

describe("the scale is derived, not duplicated", () => {
  it("covers every selectable depth exactly once", () => {
    expect(DEPTH_SCALE).toHaveLength(FLOOD_DEPTH_OPTIONS.length);
    expect(new Set(DEPTH_SCALE.map((o) => o.code)).size).toBe(FLOOD_DEPTH_OPTIONS.length);
  });

  it("never offers HUMUPA_NA — it is a condition, not a depth", () => {
    expect(DEPTH_SCALE.some((o) => o.code === "HUMUPA_NA")).toBe(false);
  });

  it("reads its heights from approxCm rather than a second table", () => {
    // If someone edits a range in types.ts, the illustration must follow.
    for (const o of FLOOD_DEPTH_OPTIONS) {
      if (!o.approxCm) continue;
      const [, upper] = o.approxCm;
      if (upper === null || Number.isNaN(upper)) continue;
      expect(getWaterlineCm(o.code)).toBe(upper);
    }
  });
});

describe("ordering", () => {
  it("runs shallowest to deepest, so slider minimum means no flood", () => {
    expect(DEPTH_SCALE[0].code).toBe("WALANG_BAHA");
    expect(DEPTH_SCALE[DEPTH_SCALE.length - 1].code).toBe("HINDI_MADAANAN");
  });

  it("is strictly increasing in severity", () => {
    for (let i = 1; i < DEPTH_SCALE.length; i++) {
      expect(DEPTH_SCALE[i].severity).toBeGreaterThan(DEPTH_SCALE[i - 1].severity);
    }
  });

  it("water rises monotonically with the slider", () => {
    // The core promise of the interaction: drag up, water goes up. Never
    // down, never flat.
    for (let i = 1; i < DEPTH_SCALE.length; i++) {
      const prev = getWaterlineFraction(DEPTH_SCALE[i - 1].code);
      const cur = getWaterlineFraction(DEPTH_SCALE[i].code);
      expect(cur).toBeGreaterThan(prev);
    }
  });
});

describe("index mapping", () => {
  it("round-trips every code through its index", () => {
    for (const o of DEPTH_SCALE) {
      expect(getCodeAtIndex(getScaleIndex(o.code))).toBe(o.code);
    }
  });

  it("clamps out-of-range indices instead of returning undefined", () => {
    expect(getCodeAtIndex(-5)).toBe("WALANG_BAHA");
    expect(getCodeAtIndex(999)).toBe("HINDI_MADAANAN");
  });

  it("rounds fractional slider values", () => {
    expect(getCodeAtIndex(0.4)).toBe(DEPTH_SCALE[0].code);
    expect(getCodeAtIndex(1.6)).toBe(DEPTH_SCALE[2].code);
  });
});

describe("waterline values", () => {
  it("draws nothing at all for no flood", () => {
    expect(getWaterlineCm("WALANG_BAHA")).toBe(0);
    expect(getWaterlineFraction("WALANG_BAHA")).toBe(0);
  });

  it("puts knee-height water at Tuhod, not somewhere arbitrary", () => {
    // The figure in the scene exists so this is checkable by eye; the
    // number is what makes it checkable by test.
    expect(getWaterlineCm("TUHOD")).toBe(50);
  });

  it("tops out at MMDA's deepest named level rather than a made-up number", () => {
    // Chest deep, 45 inches. Grounded in the source, not invented.
    expect(getWaterlineCm("HINDI_MADAANAN")).toBe(114);
    expect(getWaterlineCm("HINDI_MADAANAN")).toBeGreaterThan(getWaterlineCm("BAYWANG"));
  });

  it("never exceeds the scene", () => {
    for (const o of DEPTH_SCALE) {
      const f = getWaterlineFraction(o.code);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe("impassable is a different kind of state", () => {
  it("flags every depth MMDA calls NPATV, not just the top rung", () => {
    // Changed deliberately: MMDA's "not passable to any vehicle" band
    // starts at 66cm (tire deep), which is thigh height. Reserving the
    // warning for HINDI_MADAANAN left a 66-94cm gap where MMDA says
    // nothing can pass and the app said only "malalim".
    const expected = new Set(["HITA", "BAYWANG", "HINDI_MADAANAN"]);
    for (const o of DEPTH_SCALE) {
      expect(isImpassable(o.code)).toBe(expected.has(o.code));
    }
  });

  it("does not flag anything below the 66cm threshold", () => {
    for (const code of ["WALANG_BAHA", "GUTTER_DEEP", "BUKONG_BUKONG", "BINTI", "TUHOD"] as const) {
      expect(isImpassable(code)).toBe(false);
    }
  });

  it("describes itself in words, not a false-precision number", () => {
    expect(formatWaterline("HINDI_MADAANAN")).toBe("higit 1 metro");
  });

  it("shows no measurement where there is no water", () => {
    expect(formatWaterline("WALANG_BAHA")).toBeNull();
    expect(formatWaterline("HUMUPA_NA" as FloodDepthCode)).toBeNull();
  });

  it("gives a measurement for every real depth", () => {
    for (const o of DEPTH_SCALE) {
      if (o.code === "WALANG_BAHA") continue;
      expect(formatWaterline(o.code)).toBeTruthy();
    }
  });
});

describe("the caption states the actual depth", () => {
  it("only the open-ended top rung says 'higit 1 metro'", () => {
    // Regression: when the impassable threshold moved down to 66cm, this
    // string leaked onto Hita — a 70cm depth claiming to be over a metre.
    expect(formatWaterline("HINDI_MADAANAN")).toBe("higit 1 metro");
    expect(formatWaterline("HITA")).toBe("mga 70 cm");
    expect(formatWaterline("BAYWANG")).toBe("mga 100 cm");
  });

  it("every measured depth reports its own centimetres", () => {
    for (const o of DEPTH_SCALE) {
      if (o.code === "WALANG_BAHA" || o.code === "HINDI_MADAANAN") continue;
      expect(formatWaterline(o.code)).toBe(`mga ${getWaterlineCm(o.code)} cm`);
    }
  });
});
