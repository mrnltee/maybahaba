import { getReportFreshness } from "@/lib/freshness";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { reportService } from "@/lib/services/reports";
import { getFloodDepthOption, type AreaSearchResult } from "@/lib/types";
import { areaQuerySchema } from "@/lib/validation";
import { NextResponse } from "next/server";

/**
 * Every current report inside an administrative area.
 *
 * Separate from /nearby because it answers a different question. A point
 * search asks "is this road flooded?" and has one answer; an area search
 * asks "what's happening across this city?" and has many. The response
 * shape reflects that — counts and a list, never a single condition.
 */
export async function GET(request: Request) {
  const limit = rateLimit(`area:${getClientKey(request)}`, 40, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Sobrang dami ng requests. Subukan ulit mamaya." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = areaQuerySchema.safeParse({
    minLat: searchParams.get("minLat"),
    minLon: searchParams.get("minLon"),
    maxLat: searchParams.get("maxLat"),
    maxLon: searchParams.get("maxLon"),
    label: searchParams.get("label") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid area." }, { status: 400 });
  }

  const { minLat, minLon, maxLat, maxLon, label } = parsed.data;
  const bounds = { minLat, minLon, maxLat, maxLon };

  try {
    const all = await reportService.getInArea(bounds);

    // Same currency rule as the point search: expired reports stay in the
    // database for history but never count as current conditions.
    const current = all.filter((r) => getReportFreshness(r).level !== "EXPIRED");

    const severe = current.filter((r) => getFloodDepthOption(r.floodDepth).severity >= 4);
    const impassable = current.filter((r) => r.floodDepth === "HINDI_MADAANAN");

    // Worst first: someone scanning a city list wants the roads to avoid
    // at the top, not the most recent trivial puddle.
    const sorted = [...current].sort((a, b) => {
      const sev = getFloodDepthOption(b.floodDepth).severity - getFloodDepthOption(a.floodDepth).severity;
      if (sev !== 0) return sev;
      return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
    });

    const result: AreaSearchResult = {
      bounds,
      label,
      totalReports: current.length,
      impassableCount: impassable.length,
      severeCount: severe.length,
      reports: sorted,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Hindi available ang report service ngayon. Subukan ulit." },
      { status: 500 }
    );
  }
}
