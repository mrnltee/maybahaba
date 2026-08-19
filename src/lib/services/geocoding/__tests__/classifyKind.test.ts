import { describe, expect, it } from "vitest";
import { classifyKindForTest as classifyKind } from "../nominatimProvider";

/**
 * The classifier that caused the "Quezon City answered with a 300 m
 * circle" bug. Most Philippine administrative areas are OSM relations
 * tagged class=boundary, type=administrative — the level lives in
 * `addresstype`, not `type`.
 */
describe("classifyKind — administrative boundaries", () => {
  it("THE ORIGINAL BUG: a city as an admin boundary is a city, not 'other'", () => {
    expect(
      classifyKind({
        class: "boundary",
        type: "administrative",
        addresstype: "city",
        place_rank: 16,
      })
    ).toBe("city");
  });

  it("classifies a province given as an admin boundary", () => {
    expect(
      classifyKind({
        class: "boundary",
        type: "administrative",
        addresstype: "state",
        place_rank: 8,
      })
    ).toBe("province");
  });

  it("classifies a barangay given as an admin boundary", () => {
    expect(
      classifyKind({
        class: "boundary",
        type: "administrative",
        addresstype: "suburb",
        place_rank: 20,
      })
    ).toBe("barangay");
  });

  it("falls back to place_rank when addresstype is missing or unfamiliar", () => {
    // Without this, an unrecognised label returns "other" and silently
    // suppresses the area search.
    expect(classifyKind({ class: "boundary", type: "administrative", place_rank: 8 })).toBe(
      "province"
    );
    expect(classifyKind({ class: "boundary", type: "administrative", place_rank: 16 })).toBe(
      "city"
    );
    expect(classifyKind({ class: "boundary", type: "administrative", place_rank: 20 })).toBe(
      "barangay"
    );
    expect(
      classifyKind({
        class: "boundary",
        type: "administrative",
        addresstype: "something_new",
        place_rank: 16,
      })
    ).toBe("city");
  });
});

describe("classifyKind — place nodes", () => {
  it("still handles the documented place/* shape", () => {
    expect(classifyKind({ class: "place", type: "city" })).toBe("city");
    expect(classifyKind({ class: "place", type: "province" })).toBe("province");
    expect(classifyKind({ class: "place", type: "suburb" })).toBe("barangay");
  });

  it("classifies streets and addresses as points", () => {
    expect(classifyKind({ class: "highway", type: "road" })).toBe("street");
    expect(classifyKind({ class: "place", type: "house" })).toBe("address");
    expect(classifyKind({ class: "building", type: "yes" })).toBe("address");
  });

  it("classifies POIs as landmarks", () => {
    expect(classifyKind({ class: "amenity", type: "restaurant" })).toBe("landmark");
    expect(classifyKind({ class: "tourism", type: "hotel" })).toBe("landmark");
  });

  it("returns 'other' only when there is genuinely nothing to go on", () => {
    expect(classifyKind({ class: "mystery", type: "mystery" })).toBe("other");
  });
});
