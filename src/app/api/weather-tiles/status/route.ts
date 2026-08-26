import { NextResponse } from "next/server";

/**
 * Whether the rainfall overlay can actually draw anything.
 *
 * This exists because the tile proxy's failure mode is deliberately
 * silent — it returns a transparent PNG so a provider outage cannot
 * pepper the map with broken-image icons. That is right for users and
 * terrible for anyone trying to work out why the overlay looks empty:
 * "no API key configured", "key rejected", and "it simply is not raining"
 * are indistinguishable from a blank tile.
 *
 * So the UI asks here first and can say which of those it is.
 *
 * Returns a boolean and nothing else — no key, no fragment of one, no
 * upstream call (so it costs no quota). Whether a feature is switched on
 * is not sensitive; the README states the key is optional anyway.
 */
export async function GET() {
  return NextResponse.json(
    { configured: Boolean(process.env.OPENWEATHER_API_KEY) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
