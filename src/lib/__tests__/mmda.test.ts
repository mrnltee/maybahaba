import { describe, expect, it } from "vitest";
import {
  NPATV_MIN_CM,
  PATV_MAX_CM,
  getDefaultVehicleTypes,
  getDerivedRoadCondition,
  getMmdaAssessment,
  isNoVehiclePassable,
  shouldAskVehicleTypes,
} from "../mmda";
import { DEPTH_SCALE, getWaterlineCm, isImpassable } from "../floodScale";
import { VEHICLE_TYPE_OPTIONS, type FloodDepthCode } from "../types";

/**
 * MMDA's 2024 flood gauge, verified against reporting of the official
 * announcement:
 *
 *   PATV   gutter deep 8in (~20cm), half-knee deep 10in (~25cm)
 *   NPLV   half tire 13in (~33cm), knee deep 19in (~48cm)
 *   NPATV  tire deep 26in (~66cm), waist deep 37in (~94cm),
 *          chest deep 45in (~114cm)
 */

describe("the published MMDA thresholds", () => {
  it("puts the PATV ceiling at half-knee deep and NPATV floor at tire deep", () => {
    expect(PATV_MAX_CM).toBe(25);
    expect(NPATV_MIN_CM).toBe(66);
  });

  it("classifies MMDA's own named depths into MMDA's own bands", () => {
    // If this fails, our thresholds no longer reproduce the source table.
    const band = (cm: number) => (cm >= NPATV_MIN_CM ? "NPATV" : cm > PATV_MAX_CM ? "NPLV" : "PATV");
    expect(band(20)).toBe("PATV"); // gutter deep
    expect(band(25)).toBe("PATV"); // half-knee deep
    expect(band(33)).toBe("NPLV"); // half tire
    expect(band(48)).toBe("NPLV"); // knee deep
    expect(band(66)).toBe("NPATV"); // tire deep
    expect(band(94)).toBe("NPATV"); // waist deep
    expect(band(114)).toBe("NPATV"); // chest deep
  });
});

describe("mapping onto the Filipino scale", () => {
  it("has no assessment where there is no flood", () => {
    expect(getMmdaAssessment("WALANG_BAHA")).toBeNull();
    expect(getMmdaAssessment("HUMUPA_NA" as FloodDepthCode)).toBeNull();
  });

  it("assesses every real depth", () => {
    for (const o of DEPTH_SCALE) {
      if (o.code === "WALANG_BAHA") continue;
      expect(getMmdaAssessment(o.code)).not.toBeNull();
    }
  });

  it("never gets less strict as the water rises", () => {
    const rank = { PATV: 0, NPLV: 1, NPATV: 2 } as const;
    let prev = -1;
    for (const o of DEPTH_SCALE) {
      const a = getMmdaAssessment(o.code);
      if (!a) continue;
      expect(rank[a.band]).toBeGreaterThanOrEqual(prev);
      prev = rank[a.band];
    }
  });
});

describe("NPATV starts at thigh, not waist", () => {
  it("THE CORRECTION: Hita is already impassable to every vehicle", () => {
    // Hita tops out at 70cm, above MMDA's 66cm tire-deep threshold.
    // Treating waist as the cutoff would leave a 66-94cm band that MMDA
    // calls impassable while the app said only "malalim".
    expect(getWaterlineCm("HITA")).toBeGreaterThanOrEqual(NPATV_MIN_CM);
    expect(isNoVehiclePassable("HITA")).toBe(true);
  });

  it("still flags waist and the top level", () => {
    expect(isNoVehiclePassable("BAYWANG")).toBe(true);
    expect(isNoVehiclePassable("HINDI_MADAANAN")).toBe(true);
  });

  it("does not flag anything shallower than the threshold", () => {
    for (const code of ["WALANG_BAHA", "GUTTER_DEEP", "BUKONG_BUKONG", "BINTI", "TUHOD"] as const) {
      expect(isNoVehiclePassable(code)).toBe(false);
    }
  });

  it("the scene's road-closed treatment agrees with MMDA", () => {
    // Two code paths, one meaning — they must not drift.
    for (const o of DEPTH_SCALE) {
      expect(isImpassable(o.code)).toBe(isNoVehiclePassable(o.code));
    }
  });
});

describe("when to ask about vehicle types", () => {
  it("asks only where the answer carries information", () => {
    // NPLV is the one band where passability depends on the vehicle.
    expect(shouldAskVehicleTypes("BINTI")).toBe(true);
    expect(shouldAskVehicleTypes("TUHOD")).toBe(true);
  });

  it("does not ask where everything passes", () => {
    expect(shouldAskVehicleTypes("GUTTER_DEEP")).toBe(false);
    expect(shouldAskVehicleTypes("BUKONG_BUKONG")).toBe(false);
  });

  it("does not ask where nothing passes — the answer would be predetermined", () => {
    expect(shouldAskVehicleTypes("HITA")).toBe(false);
    expect(shouldAskVehicleTypes("BAYWANG")).toBe(false);
    expect(shouldAskVehicleTypes("HINDI_MADAANAN")).toBe(false);
  });

  it("does not ask before a depth is chosen", () => {
    expect(shouldAskVehicleTypes(null)).toBe(false);
    expect(shouldAskVehicleTypes("WALANG_BAHA")).toBe(false);
  });

  it("is never asked at a depth we also call impassable", () => {
    for (const o of DEPTH_SCALE) {
      if (shouldAskVehicleTypes(o.code)) expect(isNoVehiclePassable(o.code)).toBe(false);
    }
  });
});

describe("presentation", () => {
  it("carries both the acronym and a Filipino gloss", () => {
    const a = getMmdaAssessment("TUHOD")!;
    expect(a.code).toBe("NPLV");
    expect(a.label).toMatch(/light vehicles/i);
    expect(a.expansion).toBe("Not passable to light vehicles");
  });
});

/**
 * The report form no longer asks about road condition or, at NPATV, about
 * vehicles. Both are entailed by the depth, so they are derived. These
 * pin the derivations, because a silent wrong default writes bad data
 * into every report rather than showing up as a visible bug.
 */
describe("derived road condition", () => {
  it("replaces a tickbox that could contradict the band", () => {
    // The old form let a reporter tick "hindi madaanan" at gutter-deep,
    // producing a record whose passability claim fought the one shown.
    expect(getDerivedRoadCondition("GUTTER_DEEP")).toBe("PASSABLE");
    expect(getDerivedRoadCondition("BUKONG_BUKONG")).toBe("PASSABLE");
    expect(getDerivedRoadCondition("BINTI")).toBe("DIFFICULT");
    expect(getDerivedRoadCondition("TUHOD")).toBe("DIFFICULT");
    expect(getDerivedRoadCondition("HITA")).toBe("NOT_PASSABLE");
    expect(getDerivedRoadCondition("BAYWANG")).toBe("NOT_PASSABLE");
    expect(getDerivedRoadCondition("HINDI_MADAANAN")).toBe("NOT_PASSABLE");
  });

  it("calls a dry road passable and has nothing to say with no depth", () => {
    expect(getDerivedRoadCondition("WALANG_BAHA")).toBe("PASSABLE");
    expect(getDerivedRoadCondition(null)).toBeNull();
  });

  it("never disagrees with the band the UI displays", () => {
    for (const o of DEPTH_SCALE) {
      const rc = getDerivedRoadCondition(o.code);
      if (isNoVehiclePassable(o.code)) expect(rc).toBe("NOT_PASSABLE");
      else expect(rc).not.toBe("NOT_PASSABLE");
    }
  });
});

describe("default vehicle types", () => {
  it("pre-ticks the light vehicles in the NPLV band", () => {
    // "Not passable to LIGHT vehicles" names them, so this is entailed
    // rather than guessed. The reporter can still untick either.
    expect(getDefaultVehicleTypes("BINTI")).toEqual(["MOTORCYCLE", "SEDAN"]);
    expect(getDefaultVehicleTypes("TUHOD")).toEqual(["MOTORCYCLE", "SEDAN"]);
  });

  it("marks every type at NPATV, which is what the band means", () => {
    for (const code of ["HITA", "BAYWANG", "HINDI_MADAANAN"] as const) {
      const v = getDefaultVehicleTypes(code);
      expect(v).toHaveLength(VEHICLE_TYPE_OPTIONS.length);
      for (const o of VEHICLE_TYPE_OPTIONS) expect(v).toContain(o.code);
    }
  });

  it("marks nothing where every vehicle gets through", () => {
    expect(getDefaultVehicleTypes("WALANG_BAHA")).toEqual([]);
    expect(getDefaultVehicleTypes("GUTTER_DEEP")).toEqual([]);
    expect(getDefaultVehicleTypes("BUKONG_BUKONG")).toEqual([]);
    expect(getDefaultVehicleTypes(null)).toEqual([]);
  });

  it("only returns codes the form actually offers", () => {
    const valid = new Set(VEHICLE_TYPE_OPTIONS.map((o) => o.code));
    for (const o of DEPTH_SCALE) {
      for (const v of getDefaultVehicleTypes(o.code)) expect(valid.has(v)).toBe(true);
    }
  });

  it("the band that gets asked is the only one with a partial default", () => {
    // A partial list is a prompt to correct it; a full or empty list is a
    // statement. Only NPLV should be a prompt.
    for (const o of DEPTH_SCALE) {
      const v = getDefaultVehicleTypes(o.code);
      const partial = v.length > 0 && v.length < VEHICLE_TYPE_OPTIONS.length;
      expect(partial).toBe(shouldAskVehicleTypes(o.code));
    }
  });
});
