import { describe, expect, it } from "vitest";
import { deriveStatus } from "../status";
import { makeReport } from "./factories";

/**
 * These assertions encode the product's single most important safety
 * property (spec section 35): the app must never imply a road is safe
 * from an absence of evidence.
 */
describe("deriveStatus", () => {
  it("reports NO_RECENT_REPORT when there is no data at all", () => {
    // Critically NOT "NO_FLOOD_REPORTED" — nobody has looked, which is a
    // statement about coverage, not about the road.
    expect(deriveStatus(null)).toBe("NO_RECENT_REPORT");
  });

  it("distinguishes 'nobody reported' from 'someone reported no flooding'", () => {
    const noData = deriveStatus(null);
    const explicitlyDry = deriveStatus(makeReport({ floodDepth: "WALANG_BAHA" }));
    expect(noData).toBe("NO_RECENT_REPORT");
    expect(explicitlyDry).toBe("NO_FLOOD_REPORTED");
    expect(noData).not.toBe(explicitlyDry);
  });

  it("treats an expired report as unknown rather than current", () => {
    const stale = makeReport({ minutesAgo: 60 * 24, floodDepth: "TUHOD" });
    expect(deriveStatus(stale)).toBe("UNKNOWN_STALE");
  });

  it("does not present a denied report as a flood warning", () => {
    const denied = makeReport({ floodDepth: "BAYWANG", status: "DENIED" });
    expect(deriveStatus(denied)).toBe("NO_RECENT_REPORT");
  });

  it("escalates by depth", () => {
    expect(deriveStatus(makeReport({ floodDepth: "GUTTER_DEEP" }))).toBe("FLOODED");
    expect(deriveStatus(makeReport({ floodDepth: "TUHOD" }))).toBe("FLOODED");
    expect(deriveStatus(makeReport({ floodDepth: "BAYWANG" }))).toBe("SEVERE_FLOODING");
    expect(deriveStatus(makeReport({ floodDepth: "HINDI_MADAANAN" }))).toBe("ROAD_IMPASSABLE");
  });

  it("keeps a community-confirmed report current past its original age", () => {
    // Reported 5 hours ago but confirmed a minute ago — still current.
    const confirmed = makeReport({
      minutesAgo: 300,
      confirmedMinutesAgo: 1,
      floodDepth: "TUHOD",
    });
    expect(deriveStatus(confirmed)).toBe("FLOODED");
  });
});
