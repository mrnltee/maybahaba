import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { fetchRainfall, RainfallUnavailableError } from "@/lib/rainfall";
import { NextResponse } from "next/server";

/**
 * Current rainfall near a point, as context beside the flood reports.
 *
 * Deliberately returns 503 rather than a zero reading when the upstream
 * is unavailable: the client shows nothing at all in that case. An app
 * that displays "walang ulan" because a third-party API timed out would
 * be asserting something it does not know, which is the one thing this
 * product must never do.
 */
export async function GET(request: Request) {
  const limit = rateLimit(`rainfall:${getClientKey(request)}`, 20, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Sobrang dami ng requests. Subukan ulit mamaya." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  try {
    const reading = await fetchRainfall(lat, lng);
    return NextResponse.json(
      { reading },
      {
        // Short shared cache: rainfall changes slowly relative to a page
        // view, and this keeps repeat visitors off the upstream entirely.
        headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
      }
    );
  } catch (err) {
    if (err instanceof RainfallUnavailableError) {
      // Logged server-side; the client just hides the panel.
      console.error("[rainfall]", err.message, err.cause);
    }
    return NextResponse.json({ error: "Walang datos ng ulan ngayon." }, { status: 503 });
  }
}
