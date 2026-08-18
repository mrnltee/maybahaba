import { geocodingProvider, GeocodingError } from "@/lib/services/geocoding";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { searchQuerySchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const limit = rateLimit(`search:${getClientKey(request)}`, 30, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Sobrang dami ng requests. Subukan ulit mamaya." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);

  // Reverse-geocode mode: ?lat=&lng= (used by "Use My Location" / map pin drop).
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  if (latParam && lngParam) {
    const lat = Number(latParam);
    const lng = Number(lngParam);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
    }
    try {
      const result = await geocodingProvider.reverseGeocode(lat, lng);
      return NextResponse.json({ result });
    } catch (err) {
      // Log the technical detail server-side; never echo it to the client
      // (spec section 43 — user-facing copy stays short and Filipino).
      if (err instanceof GeocodingError) console.error("[reverseGeocode]", err.message, err.cause);
      return NextResponse.json({ error: "Hindi available ang map service ngayon. Subukan ulit." }, { status: 503 });
    }
  }

  const parsed = searchQuerySchema.safeParse({ q: searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await geocodingProvider.search(parsed.data.q);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof GeocodingError) console.error("[search]", err.message, err.cause);
    return NextResponse.json({ error: "Hindi available ang map service ngayon. Subukan ulit." }, { status: 503 });
  }
}
