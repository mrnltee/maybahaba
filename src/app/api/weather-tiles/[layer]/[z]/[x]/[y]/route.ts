import { openWeatherUpstreamUrl, type WeatherLayerId } from "@/lib/weatherLayers";

/**
 * Tile proxy for the rainfall overlay.
 *
 * Exists for two reasons, both structural rather than incidental:
 *
 *  1. OpenWeather takes its key as a URL query parameter. Pointing
 *     Leaflet straight at them would publish the key in every visitor's
 *     network tab, where it can be scraped and spent against our quota.
 *     The key stays in a Worker secret and is appended here.
 *  2. The free tier is 60 calls/minute. One viewport is about a dozen
 *     tiles. Proxying lets Cloudflare cache each tile at the edge, so
 *     the hundredth person to look at Marikina costs nothing upstream.
 *
 * A failure here returns a transparent 1x1 PNG rather than an error
 * status. That is deliberate: Leaflet renders a broken-image icon for a
 * failed tile, which would pepper the map with grey squares and look far
 * more alarming than simply having no rain shown. The map, the reports
 * and the base layer all keep working; the overlay just has nothing to
 * draw.
 */

/** 1x1 fully transparent PNG. */
const TRANSPARENT_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

function blankTile(reason: string): Response {
  return new Response(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Short cache: an outage or a missing key should self-heal without
      // a deploy, so don't bake the blank tile in for long.
      "Cache-Control": "public, max-age=60",
      "X-Weather-Tile": reason,
    },
  });
}

const VALID_LAYERS: WeatherLayerId[] = ["rainfall"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  const { layer, z, x, y } = await params;

  if (!VALID_LAYERS.includes(layer as WeatherLayerId)) {
    return blankTile("unknown-layer");
  }

  // Tile coordinates are interpolated into an upstream URL, so they are
  // validated as integers rather than passed through. A slug like
  // "../../secret" must never reach the fetch.
  if (!/^\d{1,2}$/.test(z) || !/^\d{1,7}$/.test(x) || !/^\d{1,7}$/.test(y)) {
    return blankTile("bad-coordinates");
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    // Not configured is a normal state, not an error — the app ships
    // without a weather key and the overlay simply has nothing to show.
    return blankTile("not-configured");
  }

  try {
    const upstream = await fetch(
      openWeatherUpstreamUrl(layer as WeatherLayerId, z, x, y, apiKey),
      {
        // Cache aggressively at the edge. Rainfall shifts over ~10
        // minutes, and this is the mechanism that keeps a public app
        // inside a 60-call/minute allowance.
        cf: { cacheTtl: 600, cacheEverything: true },
        signal: AbortSignal.timeout(6000),
      } as RequestInit
    );

    if (!upstream.ok) {
      // 401 means a bad key, 429 means the quota is spent. Both are
      // worth a server log and neither should break the map.
      console.error("[weather-tiles] upstream", upstream.status, `${z}/${x}/${y}`);
      return blankTile(`upstream-${upstream.status}`);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    });
  } catch (err) {
    console.error("[weather-tiles] fetch failed", err);
    return blankTile("fetch-failed");
  }
}
