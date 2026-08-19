import { describe, expect, it } from "vitest";
import {
  fetchRainfall,
  getRainfallBand,
  quantiseCoordinate,
  RainfallUnavailableError,
} from "../rainfall";

/** Minimal stand-in for a fetch response. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("getRainfallBand", () => {
  it("treats a trace of rain as no rain", () => {
    expect(getRainfallBand(0).code).toBe("WALANG_ULAN");
    expect(getRainfallBand(0.05).code).toBe("WALANG_ULAN");
  });

  it("bands increasing intensity", () => {
    expect(getRainfallBand(0.1).code).toBe("MAHINA");
    expect(getRainfallBand(2.4).code).toBe("MAHINA");
    expect(getRainfallBand(2.5).code).toBe("KATAMTAMAN");
    expect(getRainfallBand(7.4).code).toBe("KATAMTAMAN");
    expect(getRainfallBand(7.5).code).toBe("MALAKAS");
    expect(getRainfallBand(14.9).code).toBe("MALAKAS");
    expect(getRainfallBand(15).code).toBe("SOBRANG_LAKAS");
    expect(getRainfallBand(200).code).toBe("SOBRANG_LAKAS");
  });

  it("never describes flooding, roads, or passability", () => {
    // The whole safety argument for this feature is that it reports
    // weather and says nothing about the state of a road. If someone
    // later edits the copy to be more "helpful", this should fail.
    const forbidden = /baha|kalsada|daan|madaanan|flood|road|safe|ligtas/i;
    for (const mm of [0, 1, 5, 10, 50]) {
      const band = getRainfallBand(mm);
      expect(band.label).not.toMatch(forbidden);
      expect(band.detail).not.toMatch(forbidden);
    }
  });

  it("never reuses PAGASA's warning colour words", () => {
    // Borrowing yellow/orange/red would counterfeit an official warning.
    const warningWords = /dilaw|kahel|pula|yellow|orange|red/i;
    for (const mm of [0, 1, 5, 10, 50]) {
      const band = getRainfallBand(mm);
      expect(`${band.label} ${band.detail}`).not.toMatch(warningWords);
    }
  });
});

describe("quantiseCoordinate", () => {
  it("rounds to two decimal places (~1.1 km)", () => {
    expect(quantiseCoordinate(14.6349)).toBe(14.63);
    expect(quantiseCoordinate(121.0645)).toBe(121.06);
    expect(quantiseCoordinate(-14.6389)).toBe(-14.64);
  });

  it("collapses nearby points onto the same cache key", () => {
    expect(quantiseCoordinate(14.6301)).toBe(quantiseCoordinate(14.6299));
  });
});

describe("fetchRainfall", () => {
  const ok = {
    current: { time: "2026-08-19T14:00", precipitation: 3.2, rain: 3.2, showers: 0 },
  };

  it("returns a banded reading", async () => {
    const reading = await fetchRainfall(14.6349, 121.0645, async () => jsonResponse(ok));
    expect(reading.mmLastHour).toBe(3.2);
    expect(reading.band.code).toBe("KATAMTAMAN");
    expect(reading.observedAt).toBe("2026-08-19T14:00");
  });

  it("sends quantised coordinates, not the caller's exact position", async () => {
    let requested = "";
    await fetchRainfall(14.63491, 121.06459, async (url) => {
      requested = String(url);
      return jsonResponse(ok);
    });
    expect(requested).toContain("latitude=14.63");
    expect(requested).toContain("longitude=121.06");
    expect(requested).not.toContain("14.63491");
  });

  it("falls back to summing rain + showers when precipitation is absent", async () => {
    const reading = await fetchRainfall(14.6, 121, async () =>
      jsonResponse({ current: { time: "t", rain: 5, showers: 3 } })
    );
    expect(reading.mmLastHour).toBe(8);
    expect(reading.band.code).toBe("MALAKAS");
  });

  it("throws rather than reporting zero when no value is usable", async () => {
    // Reporting "walang ulan" during a downpour because a field was
    // missing is the exact failure mode this app must not have.
    await expect(
      fetchRainfall(14.6, 121, async () => jsonResponse({ current: { time: "t" } }))
    ).rejects.toBeInstanceOf(RainfallUnavailableError);
  });

  it("throws on a malformed response rather than crashing the caller", async () => {
    await expect(
      fetchRainfall(14.6, 121, async () => jsonResponse({ unexpected: true }))
    ).rejects.toBeInstanceOf(RainfallUnavailableError);
  });

  it("throws on a non-OK upstream status", async () => {
    await expect(
      fetchRainfall(14.6, 121, async () => jsonResponse({}, false, 500))
    ).rejects.toBeInstanceOf(RainfallUnavailableError);
  });

  it("throws when the network call itself fails", async () => {
    await expect(
      fetchRainfall(14.6, 121, async () => {
        throw new Error("network down");
      })
    ).rejects.toBeInstanceOf(RainfallUnavailableError);
  });

  it("rejects a negative precipitation value", async () => {
    await expect(
      fetchRainfall(14.6, 121, async () =>
        jsonResponse({ current: { time: "t", precipitation: -1 } })
      )
    ).rejects.toBeInstanceOf(RainfallUnavailableError);
  });
});
