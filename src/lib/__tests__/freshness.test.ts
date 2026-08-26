import { describe, expect, it } from "vitest";
import { getEffectiveTimestamp, getFreshness, getReportFreshness, isReportExpired } from "../freshness";
import { conciseLocationLabel } from "../formatLocation";
import { phLocalInputToUtcIso, utcIsoToPhLocalInput } from "../time";
import { makeReport } from "./factories";

describe("getFreshness", () => {
  it("tiers by age", () => {
    const at = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
    expect(getFreshness(at(5)).level).toBe("VERY_RECENT");
    expect(getFreshness(at(45)).level).toBe("RECENT");
    expect(getFreshness(at(120)).level).toBe("AGING");
    expect(getFreshness(at(300)).level).toBe("STALE");
    expect(getFreshness(at(600)).level).toBe("EXPIRED");
  });

  it("never reports negative age for a slightly future timestamp", () => {
    const soon = new Date(Date.now() + 30_000).toISOString();
    expect(getFreshness(soon).minutesAgo).toBeGreaterThanOrEqual(0);
  });
});

describe("getEffectiveTimestamp", () => {
  it("uses reportedAt when never confirmed", () => {
    const r = makeReport({ minutesAgo: 30 });
    expect(getEffectiveTimestamp(r)).toBe(r.reportedAt);
  });

  it("uses the confirmation when it is newer", () => {
    const r = makeReport({ minutesAgo: 300, confirmedMinutesAgo: 2 });
    expect(getEffectiveTimestamp(r)).toBe(r.lastConfirmedAt);
  });

  it("ignores a confirmation older than the report", () => {
    const r = makeReport({ minutesAgo: 2, confirmedMinutesAgo: 300 });
    expect(getEffectiveTimestamp(r)).toBe(r.reportedAt);
  });

  it("keeps a confirmed report from expiring", () => {
    const r = makeReport({ minutesAgo: 600, confirmedMinutesAgo: 1 });
    expect(isReportExpired(r)).toBe(false);
    expect(getReportFreshness(r).level).toBe("VERY_RECENT");
  });
});

describe("conciseLocationLabel", () => {
  const verbose =
    "Katipunan, Aurora Boulevard, Loyola Heights, 3rd District, Quezon City, Eastern Manila District, Metro Manila, 1108, Philippines";

  it("prefers street + city", () => {
    expect(
      conciseLocationLabel({ street: "Katipunan Avenue", city: "Quezon City" }, verbose)
    ).toBe("Katipunan Avenue, Quezon City");
  });

  it("falls back through barangay then province", () => {
    expect(conciseLocationLabel({ barangay: "Holy Spirit", city: "Quezon City" }, verbose)).toBe(
      "Holy Spirit, Quezon City"
    );
    expect(conciseLocationLabel({ street: "EDSA", province: "Metro Manila" }, verbose)).toBe(
      "EDSA, Metro Manila"
    );
  });

  it("strips postcode/country/district noise when there are no structured fields", () => {
    const out = conciseLocationLabel({}, verbose);
    expect(out).not.toMatch(/Philippines/);
    expect(out).not.toMatch(/1108/);
    expect(out.length).toBeLessThan(40);
  });

  it("never returns an empty string", () => {
    expect(conciseLocationLabel({}, "").length).toBeGreaterThanOrEqual(0);
    expect(conciseLocationLabel({}, "Somewhere")).toBe("Somewhere");
  });
});

describe("Philippine time handling", () => {
  it("round-trips a datetime-local value through UTC", () => {
    const local = "2026-08-18T17:42";
    const utc = phLocalInputToUtcIso(local);
    // 17:42 in UTC+8 is 09:42 UTC.
    expect(utc).toContain("T09:42");
    expect(utcIsoToPhLocalInput(utc)).toBe(local);
  });

  it("handles a time that crosses midnight backwards into UTC", () => {
    const local = "2026-08-18T03:00"; // 3am PH = 19:00 UTC previous day
    const utc = phLocalInputToUtcIso(local);
    expect(utc).toContain("2026-08-17T19:00");
    expect(utcIsoToPhLocalInput(utc)).toBe(local);
  });
});
