import { computeConfidence } from "@/lib/confidence";
import { getReportFreshness } from "@/lib/freshness";
import { NEARBY_RADIUS_METERS } from "@/lib/config/freshness";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { reportService } from "@/lib/services/reports";
import { deriveStatus } from "@/lib/status";
import type { NearbySearchResult } from "@/lib/types";
import { nearbyQuerySchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const limit = rateLimit(`nearby:${getClientKey(request)}`, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Sobrang dami ng requests. Subukan ulit mamaya." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = nearbyQuerySchema.safeParse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
    radius: searchParams.get("radius") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const { lat, lng, radius } = parsed.data;
  const radiusMeters = radius ?? NEARBY_RADIUS_METERS;

  try {
    const nearbyReports = await reportService.getNearby(lat, lng, radiusMeters);
    // Reports the UI should treat as "current" — excludes expired ones.
    // Freshness accounts for community confirmations, so a report people
    // keep confirming stays current instead of ageing out.
    const currentReports = nearbyReports.filter((r) => getReportFreshness(r).level !== "EXPIRED");
    const topReport = currentReports[0] ?? null;

    const result: NearbySearchResult = {
      center: { latitude: lat, longitude: lng, label: "" },
      status: deriveStatus(topReport),
      topReport,
      confidence: computeConfidence(topReport, currentReports),
      freshness: topReport ? getReportFreshness(topReport) : null,
      nearbyReports: currentReports,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Hindi available ang report service ngayon. Subukan ulit." },
      { status: 500 }
    );
  }
}
