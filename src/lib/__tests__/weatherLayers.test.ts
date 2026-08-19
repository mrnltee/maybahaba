import { describe, expect, it } from "vitest";
import {
  OPEN_WEATHER_RAINFALL,
  WEATHER_LAYERS,
  getWeatherLayer,
  openWeatherUpstreamUrl,
} from "../weatherLayers";

describe("the provider abstraction", () => {
  it("exposes every layer through the registry", () => {
    expect(WEATHER_LAYERS.length).toBeGreaterThan(0);
    for (const layer of WEATHER_LAYERS) {
      expect(getWeatherLayer(layer.id)).toBe(layer);
    }
  });

  it("every layer carries an attribution", () => {
    // A licence condition, not decoration — a layer without one should
    // never reach the map.
    for (const layer of WEATHER_LAYERS) {
      expect(layer.attribution.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("the key never reaches the browser", () => {
  it("the client-facing tile template points at our own origin", () => {
    // If this ever becomes an openweathermap.org URL, the API key is
    // being published in every visitor's network tab.
    expect(OPEN_WEATHER_RAINFALL.tileUrlTemplate.startsWith("/api/")).toBe(true);
    expect(OPEN_WEATHER_RAINFALL.tileUrlTemplate).not.toMatch(/openweathermap\.org/);
    expect(OPEN_WEATHER_RAINFALL.tileUrlTemplate.toLowerCase()).not.toContain("appid");
  });

  it("no layer's client template contains a key parameter", () => {
    for (const layer of WEATHER_LAYERS) {
      expect(layer.tileUrlTemplate.toLowerCase()).not.toMatch(/appid|api_?key|token/);
    }
  });

  it("the upstream URL — used server-side only — does carry the key", () => {
    const url = openWeatherUpstreamUrl("rainfall", "12", "3345", "2020", "SECRET");
    expect(url).toContain("tile.openweathermap.org");
    expect(url).toContain("appid=SECRET");
    expect(url).toContain("/12/3345/2020.png");
  });
});

describe("visual semantics", () => {
  it("opacity leaves the base map readable", () => {
    // Roads and street names are what tell a motorist where they are.
    expect(OPEN_WEATHER_RAINFALL.opacity).toBeGreaterThanOrEqual(0.4);
    expect(OPEN_WEATHER_RAINFALL.opacity).toBeLessThanOrEqual(0.6);
  });

  it("the rainfall legend never borrows PAGASA's warning colours", () => {
    // Yellow/orange/red are the Heavy Rainfall Warning scale. Using them
    // here would counterfeit an official advisory.
    const warned = /dilaw|kahel|pula|yellow|orange|red/i;
    for (const band of OPEN_WEATHER_RAINFALL.legend) {
      expect(`${band.label} ${band.range}`).not.toMatch(warned);
    }
  });

  it("the rainfall legend never describes roads or flooding", () => {
    const forbidden = /baha|kalsada|daan|flood|road/i;
    for (const band of OPEN_WEATHER_RAINFALL.legend) {
      expect(band.label).not.toMatch(forbidden);
      expect(band.range).not.toMatch(forbidden);
    }
  });

  it("legend bands state the provider's own units, not invented ones", () => {
    for (const band of OPEN_WEATHER_RAINFALL.legend) {
      expect(band.range).toMatch(/mm\/h/);
    }
  });
});

/**
 * The overlay's blank state has three causes — no key, a rejected key,
 * and no rain in view — and the tile proxy renders all three as a
 * transparent tile so that a provider outage cannot fill the map with
 * broken-image icons. That is right for users but made the feature
 * undiagnosable: "not displaying" was indistinguishable from "working,
 * nothing to draw". These pin the pieces that let the UI tell them apart.
 */
describe("diagnosability of a blank overlay", () => {
  it("the layer declares a maxNativeZoom, so blank tiles are not requested past it", () => {
    // Requesting zoom-16 tiles the provider has no data for would look
    // identical to an outage.
    expect(OPEN_WEATHER_RAINFALL.maxNativeZoom).toBeGreaterThan(0);
    expect(OPEN_WEATHER_RAINFALL.maxNativeZoom).toBeLessThanOrEqual(16);
  });

  it("the legend describes intensity bands, so an empty map is readable as 'no rain'", () => {
    expect(OPEN_WEATHER_RAINFALL.legend.length).toBeGreaterThanOrEqual(2);
  });
});
