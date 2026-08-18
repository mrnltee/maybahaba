import { DUPLICATE_NEARBY_RADIUS_METERS } from "@/lib/config/freshness";
import { checkForDuplicate } from "@/lib/duplicateDetection";
import { getClientKey, hashIdentifier, rateLimit } from "@/lib/rateLimit";
import { reportService } from "@/lib/services/reports";
import { createReportSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const clientKey = getClientKey(request);

  // Stricter limit than reads: submitting reports is the main abuse surface.
  const limit = rateLimit(`submit:${clientKey}`, 8, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "Sobrang dami ng report submissions mula sa iyo. Subukan ulit mamaya.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Hindi valid ang report. Pakisuri ang mga detalye.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // Reject implausible future/past timestamps early (defense in depth —
  // the UI already constrains the time picker).
  const reportedAtMs = new Date(input.reportedAt).getTime();
  const now = Date.now();
  const maxFuture = 5 * 60_000; // small clock-skew allowance
  const maxPast = 24 * 60 * 60_000;
  if (reportedAtMs > now + maxFuture || reportedAtMs < now - maxPast) {
    return NextResponse.json(
      { error: "Hindi valid ang oras ng report." },
      { status: 400 }
    );
  }

  try {
    const nearby = await reportService.getNearby(
      input.latitude,
      input.longitude,
      DUPLICATE_NEARBY_RADIUS_METERS
    );

    const duplicateCheck = checkForDuplicate(
      {
        latitude: input.latitude,
        longitude: input.longitude,
        floodDepth: input.floodDepth,
        reportedAt: input.reportedAt,
      },
      nearby
    );

    // Block silently only if the user hasn't already acknowledged this
    // exact existing report; otherwise let them proceed (spec section 14:
    // "The user should still be able to submit if the conditions have
    // changed" — we never hard-block, only warn once).
    const alreadyAcknowledged =
      duplicateCheck.existingReport &&
      input.acknowledgedDuplicateId === duplicateCheck.existingReport.id;

    if (duplicateCheck.isDuplicate && !alreadyAcknowledged) {
      return NextResponse.json(
        {
          duplicateWarning: true,
          duplicateCheck,
          message: "May existing report na malapit sa lokasyong ito.",
        },
        { status: 200 }
      );
    }

    const report = await reportService.create({
      latitude: input.latitude,
      longitude: input.longitude,
      locationName: input.locationName,
      street: input.street ?? null,
      barangay: input.barangay ?? null,
      city: input.city ?? null,
      province: input.province ?? null,
      floodDepth: input.floodDepth,
      roadCondition: input.roadCondition ?? null,
      vehicleType: input.vehicleType ?? null,
      reportedAt: input.reportedAt,
      reporterName: input.anonymous ? null : (input.reporterName ?? null),
      anonymous: input.anonymous,
    });

    // submitter_hash-equivalent tracking would be persisted by the
    // Supabase provider; the mock provider only rate-limits in memory.
    void hashIdentifier;

    return NextResponse.json({ report, duplicateWarning: false }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Hindi na-submit ang report. Subukan ulit." },
      { status: 500 }
    );
  }
}
