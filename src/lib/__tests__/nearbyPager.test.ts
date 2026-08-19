import { describe, expect, it } from "vitest";
import {
  getPageableReports,
  shouldShowPager,
  wrapIndex,
} from "../nearbyPager";
import { REPORT_EXPIRY_MINUTES } from "../config/freshness";
import { formatDistanceFrom } from "../geo";
import { makeReport } from "./factories";

const CENTER = { latitude: 14.6349, longitude: 121.0645 };

describe("getPageableReports — what gets included", () => {
  it("keeps current, non-denied reports", () => {
    const pageable = getPageableReports(
      [
        makeReport({ id: "a", minutesAgo: 5 }),
        makeReport({ id: "b", minutesAgo: 20 }),
      ],
      CENTER
    );
    expect(pageable.map((p) => p.report.id).sort()).toEqual(["a", "b"]);
  });

  it("excludes denied reports", () => {
    const pageable = getPageableReports(
      [makeReport({ id: "ok" }), makeReport({ id: "denied", status: "DENIED" })],
      CENTER
    );
    expect(pageable.map((p) => p.report.id)).toEqual(["ok"]);
  });

  it("excludes stale reports rather than labelling them", () => {
    // Counting a six-hour-old report in "2 pang report" would overstate
    // how much live information the app holds.
    const stale = makeReport({ id: "stale", minutesAgo: REPORT_EXPIRY_MINUTES + 60 });
    const fresh = makeReport({ id: "fresh", minutesAgo: 3 });
    const pageable = getPageableReports([stale, fresh], CENTER);
    expect(pageable.map((p) => p.report.id)).toEqual(["fresh"]);
  });

  it("keeps a report that community confirmation has kept current", () => {
    // Its reportedAt is old, but people keep confirming it — the
    // effective timestamp is what freshness runs on.
    const confirmed = makeReport({
      id: "confirmed",
      minutesAgo: REPORT_EXPIRY_MINUTES + 60,
      confirmedMinutesAgo: 4,
    });
    const pageable = getPageableReports([confirmed], CENTER);
    expect(pageable.map((p) => p.report.id)).toEqual(["confirmed"]);
  });

  it("returns an empty list for no input", () => {
    expect(getPageableReports([], CENTER)).toEqual([]);
  });
});

describe("getPageableReports — ordering", () => {
  it("puts the worst flood first", () => {
    const pageable = getPageableReports(
      [
        makeReport({ id: "gutter", floodDepth: "GUTTER_DEEP" }),
        makeReport({ id: "impassable", floodDepth: "HINDI_MADAANAN" }),
        makeReport({ id: "knee", floodDepth: "TUHOD" }),
      ],
      CENTER
    );
    expect(pageable.map((p) => p.report.id)).toEqual(["impassable", "knee", "gutter"]);
  });

  it("breaks severity ties with the fresher report", () => {
    const pageable = getPageableReports(
      [
        makeReport({ id: "older", floodDepth: "TUHOD", minutesAgo: 25 }),
        makeReport({ id: "newer", floodDepth: "TUHOD", minutesAgo: 4 }),
      ],
      CENTER
    );
    expect(pageable.map((p) => p.report.id)).toEqual(["newer", "older"]);
  });

  it("does NOT order by distance — a deep flood further away still leads", () => {
    // The nearest flood is not the most important one. A knee-deep
    // street 280 m away matters more than a puddle 20 m away.
    const nearPuddle = makeReport({
      id: "near-puddle",
      floodDepth: "GUTTER_DEEP",
      latitude: 14.63495,
      longitude: 121.06455,
    });
    const farDeep = makeReport({
      id: "far-deep",
      floodDepth: "BAYWANG",
      latitude: 14.6374,
      longitude: 121.0665,
    });
    const pageable = getPageableReports([nearPuddle, farDeep], CENTER);
    expect(pageable[0].report.id).toBe("far-deep");
    // And the distances really are what we claimed.
    const near = pageable.find((p) => p.report.id === "near-puddle")!;
    const far = pageable.find((p) => p.report.id === "far-deep")!;
    expect(near.distanceMeters!).toBeLessThan(far.distanceMeters!);
  });

  it("ranks HUMUPA_NA below any active flood", () => {
    const pageable = getPageableReports(
      [
        makeReport({ id: "subsided", floodDepth: "HUMUPA_NA" }),
        makeReport({ id: "gutter", floodDepth: "GUTTER_DEEP" }),
      ],
      CENTER
    );
    expect(pageable[0].report.id).toBe("gutter");
  });
});

describe("distance", () => {
  it("measures each report from the searched point", () => {
    const pageable = getPageableReports(
      [makeReport({ id: "same-spot", latitude: CENTER.latitude, longitude: CENTER.longitude })],
      CENTER
    );
    expect(pageable[0].distanceMeters).toBeCloseTo(0, 0);
  });
});

describe("shouldShowPager", () => {
  it("hides for zero or one report — nothing to navigate", () => {
    expect(shouldShowPager([])).toBe(false);
    expect(shouldShowPager(getPageableReports([makeReport()], CENTER))).toBe(false);
  });

  it("shows once there are two", () => {
    const two = getPageableReports([makeReport({ id: "a" }), makeReport({ id: "b" })], CENTER);
    expect(shouldShowPager(two)).toBe(true);
  });

  it("stays hidden when the second report is stale", () => {
    const reports = [
      makeReport({ id: "fresh" }),
      makeReport({ id: "stale", minutesAgo: REPORT_EXPIRY_MINUTES + 10 }),
    ];
    expect(shouldShowPager(getPageableReports(reports, CENTER))).toBe(false);
  });
});

describe("wrapIndex", () => {
  it("wraps forward past the end", () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(4, 3)).toBe(1);
  });

  it("wraps backward past the start", () => {
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(-4, 3)).toBe(2);
  });

  it("leaves in-range indices alone", () => {
    expect(wrapIndex(0, 3)).toBe(0);
    expect(wrapIndex(2, 3)).toBe(2);
  });

  it("survives an empty list", () => {
    expect(wrapIndex(0, 0)).toBe(0);
    expect(wrapIndex(5, 0)).toBe(0);
  });
});

describe("formatDistanceFrom", () => {
  it("stays grammatical below 100 m, where formatDistance returns a phrase", () => {
    // "malapit lang mula sa hinanap" is not Filipino — this shipped
    // briefly and is exactly what this test pins.
    expect(formatDistanceFrom(12, "hinanap")).toBe("malapit lang sa hinanap");
    expect(formatDistanceFrom(99, "iyo")).toBe("malapit lang sa iyo");
    expect(formatDistanceFrom(12, "hinanap")).not.toContain("mula sa");
  });

  it("uses a measurement above the threshold", () => {
    expect(formatDistanceFrom(240, "hinanap")).toBe("240 m mula sa hinanap");
    expect(formatDistanceFrom(2400, "iyo")).toBe("2.4 km mula sa iyo");
  });
});
