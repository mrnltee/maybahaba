import { describe, expect, it } from "vitest";
import { boundingBoxSpanDegrees, isAreaSearch, type AreaBounds } from "../types";

/**
 * Regression tests for a bug that shipped to production.
 *
 * Searching "Quezon City" answered with a 300 m circle around the city
 * centroid and said "walang recent na report ng baha dito". The city is
 * an OSM `boundary/administrative` relation, which the old classifier
 * mapped to "other" — not an area kind — so the area search never ran.
 *
 * Two independent defences are tested here, because a taxonomy fix alone
 * would break again the next time OSM tags something unexpectedly.
 */

/** Quezon City's real approximate extent — about 15 km across. */
const QUEZON_CITY: AreaBounds = {
  minLat: 14.5989,
  maxLat: 14.7736,
  minLon: 121.0002,
  maxLon: 121.1364,
};

/** A single street block — a few hundred metres. */
const ONE_BLOCK: AreaBounds = {
  minLat: 14.6349,
  maxLat: 14.6371,
  minLon: 121.0645,
  maxLon: 121.0662,
};

describe("boundingBoxSpanDegrees", () => {
  it("measures both axes", () => {
    const span = boundingBoxSpanDegrees(QUEZON_CITY);
    expect(span.lat).toBeCloseTo(0.1747, 3);
    expect(span.lon).toBeCloseTo(0.1362, 3);
  });

  it("is orientation-independent", () => {
    const flipped: AreaBounds = { minLat: 15, maxLat: 14, minLon: 122, maxLon: 121 };
    const span = boundingBoxSpanDegrees(flipped);
    expect(span.lat).toBe(1);
    expect(span.lon).toBe(1);
  });
});

describe("isAreaSearch — classified kinds", () => {
  it("treats barangay, city and province as areas", () => {
    for (const kind of ["barangay", "city", "province"] as const) {
      expect(isAreaSearch({ kind, boundingBox: QUEZON_CITY })).toBe(true);
    }
  });

  it("needs a bounding box, whatever the kind", () => {
    expect(isAreaSearch({ kind: "city", boundingBox: null })).toBe(false);
    expect(isAreaSearch({ kind: "city" })).toBe(false);
  });

  it("treats a street or address as a point", () => {
    expect(isAreaSearch({ kind: "street", boundingBox: ONE_BLOCK })).toBe(false);
    expect(isAreaSearch({ kind: "address", boundingBox: ONE_BLOCK })).toBe(false);
    expect(isAreaSearch({ kind: "landmark", boundingBox: ONE_BLOCK })).toBe(false);
  });
});

describe("isAreaSearch — the safety net", () => {
  it("THE ORIGINAL BUG: a city-sized box misclassified as 'other' is still an area", () => {
    // This is precisely the production failure. `kind` was "other"
    // because Quezon City is boundary/administrative. If this returns
    // false, a whole city gets answered with a 300 m circle again.
    expect(isAreaSearch({ kind: "other", boundingBox: QUEZON_CITY })).toBe(true);
  });

  it("does not promote a small box just because the kind is unknown", () => {
    expect(isAreaSearch({ kind: "other", boundingBox: ONE_BLOCK })).toBe(false);
  });

  it("errs toward the area search at the boundary", () => {
    // Asymmetric risk: showing extra reports is harmless, hiding a
    // flood a kilometre away is not. So anything ambiguous goes wide.
    const justOver: AreaBounds = { minLat: 14.6, maxLat: 14.621, minLon: 121.0, maxLon: 121.0 };
    const wellUnder: AreaBounds = { minLat: 14.6, maxLat: 14.605, minLon: 121.0, maxLon: 121.0 };
    expect(isAreaSearch({ kind: "other", boundingBox: justOver })).toBe(true);
    expect(isAreaSearch({ kind: "other", boundingBox: wellUnder })).toBe(false);
  });

  it("catches a wide box even when only one axis is large", () => {
    const wideThinStrip: AreaBounds = {
      minLat: 14.6,
      maxLat: 14.601,
      minLon: 120.95,
      maxLon: 121.15,
    };
    expect(isAreaSearch({ kind: "other", boundingBox: wideThinStrip })).toBe(true);
  });
});
