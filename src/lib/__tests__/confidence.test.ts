import { describe, expect, it } from "vitest";
import { computeConfidence } from "../confidence";
import { makeReport } from "./factories";

/**
 * The confidence tier is the app's claim about how much to trust what it
 * just said. The property worth protecting: cheap signals (taps) must not
 * be able to manufacture the same certainty as independent reports.
 */
describe("computeConfidence", () => {
  it("returns NONE with no report", () => {
    expect(computeConfidence(null, []).level).toBe("NONE");
  });

  it("is LOW for a single unvalidated report", () => {
    const only = makeReport();
    expect(computeConfidence(only, [only]).level).toBe("LOW");
  });

  it("rises as independent agreeing reports accumulate", () => {
    const reports = Array.from({ length: 4 }, (_, i) =>
      makeReport({ id: `r${i}`, floodDepth: "TUHOD", minutesAgo: i + 1 })
    );
    const result = computeConfidence(reports[0], reports);
    expect(result.level).toBe("HIGH");
    expect(result.agreeingReportCount).toBe(4);
  });

  it("does not count reports that disagree on depth", () => {
    const top = makeReport({ id: "a", floodDepth: "GUTTER_DEEP" });
    const wildlyDifferent = makeReport({ id: "b", floodDepth: "BAYWANG" });
    const result = computeConfidence(top, [top, wildlyDifferent]);
    expect(result.agreeingReportCount).toBe(1);
  });

  it("excludes expired reports from the tally", () => {
    const top = makeReport({ id: "a" });
    const ancient = makeReport({ id: "b", minutesAgo: 60 * 48 });
    expect(computeConfidence(top, [top, ancient]).agreeingReportCount).toBe(1);
  });

  it("weighs community taps below independent reports", () => {
    // One report with many taps must not outrank several real reports.
    const tapped = makeReport({ id: "tapped", stillFloodedCount: 50 });
    const tappedLevel = computeConfidence(tapped, [tapped]);

    const independent = Array.from({ length: 4 }, (_, i) =>
      makeReport({ id: `r${i}`, minutesAgo: i + 1 })
    );
    const independentLevel = computeConfidence(independent[0], independent);

    expect(independentLevel.level).toBe("HIGH");
    // 50 taps on one report is capped, so it cannot reach HIGH alone.
    expect(tappedLevel.level).not.toBe("HIGH");
  });

  it("lets disputes pull confidence back down", () => {
    const disputed = Array.from({ length: 4 }, (_, i) =>
      makeReport({ id: `r${i}`, minutesAgo: i + 1, inaccurateCount: 3 })
    );
    const result = computeConfidence(disputed[0], disputed);
    expect(result.level).not.toBe("HIGH");
  });

  it("never returns a negative-looking tier", () => {
    const heavilyDisputed = makeReport({ inaccurateCount: 99, noLongerFloodedCount: 99 });
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(
      computeConfidence(heavilyDisputed, [heavilyDisputed]).level
    );
  });
});
