import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/admin";
import { getReportFreshness } from "@/lib/freshness";
import { reportService } from "@/lib/services/reports";
import { ROAD_CONDITION_LABELS, VEHICLE_TYPE_LABELS, getFloodDepthOption } from "@/lib/types";
import { formatPhTime } from "@/lib/time";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Every report, for the moderator table. Includes DENIED and EXPIRED
 * rows, which the public endpoints exclude.
 *
 * `?format=csv` returns a spreadsheet-ready download. CSV rather than a
 * real .xlsx: it opens natively in Excel and Numbers, needs no
 * dependency, and keeps the Worker bundle small (which matters against
 * Cloudflare's size limit). Values are pre-formatted for reading —
 * Philippine local time, Filipino depth labels — because the person
 * opening this wants a report, not a database dump.
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  try {
    const reports = await reportService.getAllForAdmin();

    if (format !== "csv") {
      return NextResponse.json({ reports });
    }

    const header = [
      "ID",
      "Petsa/Oras (PH)",
      "Lalim",
      "Kalsada",
      "Sasakyang apektado",
      "Lokasyon",
      "Kalye",
      "Barangay",
      "Lungsod",
      "Probinsya",
      "Latitude",
      "Longitude",
      "Status",
      "Freshness",
      "Nag-report",
      "Validate",
      "Deny",
      "May baha pa",
      "Wala na",
      "Tama",
      "Mali",
    ];

    const rows = reports.map((r) => [
      r.id,
      formatPhTime(r.reportedAt),
      getFloodDepthOption(r.floodDepth).label,
      r.roadCondition ? ROAD_CONDITION_LABELS[r.roadCondition] : "",
      r.vehicleTypes.map((v) => VEHICLE_TYPE_LABELS[v] ?? v).join("; "),
      r.locationName,
      r.street ?? "",
      r.barangay ?? "",
      r.city ?? "",
      r.province ?? "",
      String(r.latitude),
      String(r.longitude),
      r.status,
      getReportFreshness(r).label,
      r.anonymous || !r.reporterName ? "Anonymous" : r.reporterName,
      String(r.validationCount),
      String(r.denyCount),
      String(r.stillFloodedCount),
      String(r.noLongerFloodedCount),
      String(r.accurateCount),
      String(r.inaccurateCount),
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

    // BOM so Excel detects UTF-8 and renders "ñ" in Filipino place names
    // correctly instead of mojibake.
    const body = "﻿" + csv;
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="maybahaba-reports-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load reports." }, { status: 500 });
  }
}

/**
 * Quotes a CSV field, and defuses spreadsheet formula injection: a value
 * beginning with = + - or @ is executed as a formula by Excel, so a
 * reporter name like "=cmd|..." — and anyone can submit one, anonymously
 * — could run on a moderator's machine when they open the export.
 * Prefixing with a single quote neutralises it.
 */
function csvCell(value: string): string {
  const dangerous = /^[=+\-@\t\r]/.test(value);
  const safe = dangerous ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
