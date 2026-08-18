import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/admin";
import { reportService } from "@/lib/services/reports";
import type { PendingReportsFilter } from "@/lib/services/reports";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sort = (searchParams.get("sort") as PendingReportsFilter["sort"]) || "newest";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  const filter: PendingReportsFilter = {
    sort,
    near: lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : undefined,
  };

  try {
    const reports = await reportService.getPending(filter);
    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ error: "Failed to load reports." }, { status: 500 });
  }
}
