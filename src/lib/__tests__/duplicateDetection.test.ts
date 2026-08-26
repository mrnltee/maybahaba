import { describe, expect, it } from "vitest";
import { checkForDuplicate } from "../duplicateDetection";
import { makeReport } from "./factories";

/**
 * Spec section 14 is emphatic that proximity alone must not mark a report
 * as a duplicate — a changing flood produces a legitimate stream of
 * reports from the same spot, and suppressing them would hide exactly the
 * information a motorist needs most.
 */
describe("checkForDuplicate", () => {
  const base = { latitude: 14.6349, longitude: 121.0645 };

  it("flags a same-place, same-time, same-depth report as a likely duplicate", () => {
    const existing = makeReport({ minutesAgo: 2, floodDepth: "GUTTER_DEEP" });
    const result = checkForDuplicate(
      { ...base, floodDepth: "GUTTER_DEEP", reportedAt: new Date().toISOString() },
      [existing]
    );
    expect(result.isDuplicate).toBe(true);
    expect(result.existingReport?.id).toBe(existing.id);
  });

  it("does NOT flag a worsening flood at the same spot", () => {
    // The spec's own example: gutter deep at 5:00, knee deep at 5:15.
    // These must both survive — the change IS the story.
    const earlier = makeReport({ minutesAgo: 15, floodDepth: "GUTTER_DEEP" });
    const result = checkForDuplicate(
      { ...base, floodDepth: "TUHOD", reportedAt: new Date().toISOString() },
      [earlier]
    );
    expect(result.isDuplicate).toBe(false);
  });

  it("does NOT flag the same depth reported much later", () => {
    const old = makeReport({ minutesAgo: 120, floodDepth: "GUTTER_DEEP" });
    const result = checkForDuplicate(
      { ...base, floodDepth: "GUTTER_DEEP", reportedAt: new Date().toISOString() },
      [old]
    );
    expect(result.isDuplicate).toBe(false);
  });

  it("ignores reports outside the radius", () => {
    // ~2km away.
    const faraway = makeReport({ latitude: 14.66, longitude: 121.09, floodDepth: "GUTTER_DEEP" });
    const result = checkForDuplicate(
      { ...base, floodDepth: "GUTTER_DEEP", reportedAt: new Date().toISOString() },
      [faraway]
    );
    expect(result.isDuplicate).toBe(false);
    expect(result.existingReport).toBeNull();
  });

  it("ignores denied and expired reports when deciding duplication", () => {
    const denied = makeReport({ minutesAgo: 1, floodDepth: "GUTTER_DEEP", status: "DENIED" });
    const result = checkForDuplicate(
      { ...base, floodDepth: "GUTTER_DEEP", reportedAt: new Date().toISOString() },
      [denied]
    );
    expect(result.isDuplicate).toBe(false);
  });

  it("returns a bounded confidence score", () => {
    const existing = makeReport({ minutesAgo: 1, floodDepth: "GUTTER_DEEP" });
    const result = checkForDuplicate(
      { ...base, floodDepth: "GUTTER_DEEP", reportedAt: new Date().toISOString() },
      [existing]
    );
    expect(result.duplicateConfidence).toBeGreaterThanOrEqual(0);
    expect(result.duplicateConfidence).toBeLessThanOrEqual(1);
  });
});
