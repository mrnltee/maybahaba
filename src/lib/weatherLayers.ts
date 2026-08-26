/**
 * Weather overlay providers for the map.
 *
 * The map component never names a provider. It asks this module for a
 * tile URL template and an attribution string, so swapping OpenWeather
 * for PAGASA later is a change here and nowhere else.
 *
 * ---------------------------------------------------------------------
 * Why OpenWeather, and why the tiles are proxied
 * ---------------------------------------------------------------------
 * RainViewer was the obvious candidate — no API key, free, purpose-built
 * radar tiles. It was rejected on evidence: its personal-use tier caps
 * at **zoom level 7**, and this map operates at zoom 12-16. The overlay
 * would be an unusable blur at the only zooms motorists actually use.
 * Its radar is also stitched from national networks, and there is no
 * confirmation that PAGASA's radar is among them, so coverage over Metro
 * Manila would have been a guess.
 *
 * OpenWeather's `precipitation_new` layer has documented worldwide
 * coverage and works at street zooms. Two consequences follow:
 *
 *  1. Its key goes in the tile URL as `appid`, which would put a secret
 *     in every browser's network tab. So tiles are fetched through our
 *     own Worker route instead, which appends the key server-side.
 *  2. The free tier allows 60 calls/minute. One map viewport is roughly
 *     a dozen tiles, so three people opening the map in the same minute
 *     could exhaust it. Proxying lets Cloudflare cache each tile at the
 *     edge — Metro Manila at these zooms is a bounded set of tiles, so
 *     after the first viewer most requests never reach OpenWeather.
 *
 * Neither point is a reason to avoid the provider; both are reasons the
 * proxy exists.
 */

export type WeatherLayerId = "rainfall";

export interface WeatherLayerProvider {
  id: WeatherLayerId;
  /** Shown in the layer toggle. */
  name: string;
  /**
   * Leaflet tile template. Points at our own origin, never the
   * provider's — see the note above about the key.
   */
  tileUrlTemplate: string;
  /** Required by the provider's terms; rendered in the map attribution. */
  attribution: string;
  /**
   * Overlay opacity. Low enough that roads and labels stay readable
   * underneath, because the base map is what tells a motorist which
   * street they are looking at.
   */
  opacity: number;
  /** Beyond this zoom the provider has no more detail; Leaflet upscales. */
  maxNativeZoom: number;
  /**
   * The provider's own intensity bands. Deliberately NOT invented by us
   * — inventing thresholds would mean publishing a rainfall scale we
   * cannot stand behind. mm/h values are OpenWeather's documented
   * precipitation scale.
   */
  legend: { colour: string; label: string; range: string }[];
}

/**
 * OpenWeather precipitation. `precipitation_new` is model output, not
 * radar — it is a estimate of rainfall intensity, consistent with how
 * RainfallPanel already labels the numeric reading.
 */
export const OPEN_WEATHER_RAINFALL: WeatherLayerProvider = {
  id: "rainfall",
  name: "Ulan (rainfall)",
  tileUrlTemplate: "/api/weather-tiles/rainfall/{z}/{x}/{y}",
  attribution:
    '&copy; <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a>',
  // 50%: enough to read the rain pattern, not enough to hide a street
  // name. The spec asked for 40-60%.
  opacity: 0.5,
  maxNativeZoom: 12,
  legend: [
    { colour: "#c8e6f5", label: "Mahina", range: "< 1 mm/h" },
    { colour: "#7fc4e8", label: "Katamtaman", range: "1–3 mm/h" },
    { colour: "#3d8fd1", label: "Malakas", range: "3–10 mm/h" },
    { colour: "#1d4f9e", label: "Sobrang lakas", range: "> 10 mm/h" },
  ],
};

/**
 * The provider registry. A future PAGASA rainfall-warning layer is added
 * as another entry here — the map, the toggle and the legend all read
 * from this list and need no changes to render it.
 *
 * Note that a PAGASA *warning* layer would be a different kind of thing
 * from this one: an official advisory rather than modelled rainfall, and
 * it would be entitled to the yellow/orange/red scale this layer must
 * never borrow. Keep them as separate entries, never merged.
 */
export const WEATHER_LAYERS: WeatherLayerProvider[] = [OPEN_WEATHER_RAINFALL];

export function getWeatherLayer(id: WeatherLayerId): WeatherLayerProvider | undefined {
  return WEATHER_LAYERS.find((l) => l.id === id);
}

/** Upstream template, used only server-side by the tile proxy. */
export function openWeatherUpstreamUrl(
  layer: WeatherLayerId,
  z: string,
  x: string,
  y: string,
  apiKey: string
): string {
  const owmLayer = layer === "rainfall" ? "precipitation_new" : "precipitation_new";
  return `https://tile.openweathermap.org/map/${owmLayer}/${z}/${x}/${y}.png?appid=${apiKey}`;
}
