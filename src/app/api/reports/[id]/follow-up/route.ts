import { isValidFollowUpTransition } from "@/lib/followUp";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { reportService } from "@/lib/services/reports";
import { followUpSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

/**
 * "Tulungan ang susunod" — file an updated observation for a place that
 * already has a report.
 *
 * This creates a NEW report rather than editing the one being answered.
 * That is the whole design:
 *
 *  - The original reporter was telling the truth about the moment they
 *    looked. Overwriting it would make the record wrong about the past.
 *  - An account-free endpoint that mutates other people's reports is a
 *    griefing tool: one tap could clear a genuine flood warning. Filing
 *    a new report instead means the worst an attacker can do is add a
 *    claim, which the existing confidence, moderation and duplicate
 *    detection already weigh.
 *  - Everything downstream — freshness, ordering, the "newest wins" rule
 *    the result card already implements — then works unchanged.
 *
 * Coordinates are copied from the original server-side and never taken
 * from the request body, so a follow-up cannot be used to plant a report
 * at an arbitrary location.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = rateLimit(`follow-up:${getClientKey(request)}`, 10, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Sobrang dami ng update mula sa iyo. Subukan ulit mamaya." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = followUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Hindi valid ang update." }, { status: 400 });
  }

  const original = await reportService.getById(id);
  if (!original) {
    return NextResponse.json({ error: "Hindi mahanap ang report." }, { status: 404 });
  }

  const next = parsed.data.floodDepth;

  // The same rule the disabled radio enforces in the UI, applied again
  // here — a disabled control is a hint to an honest client, not a
  // constraint on a scripted one.
  if (!isValidFollowUpTransition(original.floodDepth, next)) {
    return NextResponse.json(
      { error: "Wala nang pagbabago sa report na ito." },
      { status: 409 }
    );
  }

  try {
    const report = await reportService.create({
      // Location copied from the original, never from the client.
      latitude: original.latitude,
      longitude: original.longitude,
      locationName: original.locationName,
      street: original.street,
      barangay: original.barangay,
      city: original.city,
      province: original.province,
      floodDepth: next,
      // A follow-up answers "how deep is it now", not the full form. The
      // road condition is left unset rather than copied: inheriting the
      // original's "hindi madaanan" onto a report that says the water
      // has gone would assert something nobody observed.
      roadCondition: null,
      vehicleTypes: [],
      reportedAt: new Date().toISOString(),
      reporterName: null,
      anonymous: true,
      followUpTo: original.id,
    });

    return NextResponse.json({ report });
  } catch {
    return NextResponse.json(
      { error: "Hindi na-save ang update. Subukan ulit." },
      { status: 500 }
    );
  }
}
