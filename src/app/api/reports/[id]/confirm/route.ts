import { getClientKey, hashIdentifier, rateLimit } from "@/lib/rateLimit";
import { reportService } from "@/lib/services/reports";
import { communityActionSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

/**
 * Public community validation (spec section 16).
 *
 * Deliberately separate from /api/reports/[id]/validate, which is the
 * moderator-only endpoint. This one takes no admin session — the whole
 * point is that confirming a report requires no account.
 *
 * Abuse control is layered, since an account-free endpoint is trivially
 * scriptable otherwise:
 *  1. per-IP rate limit on how many confirmations can be sent at all
 *  2. one vote per (report, device) pair, enforced by the provider
 *  3. the identifier is hashed before storage — no raw IP or device id
 *     ever reaches the database
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientKey = getClientKey(request);

  const limit = rateLimit(`confirm:${clientKey}`, 20, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Sobrang dami ng confirmations mula sa iyo. Subukan ulit mamaya." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = communityActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Hindi valid ang request." }, { status: 400 });
  }

  // Bind the vote to both the browser-supplied id and the connection, so
  // clearing localStorage alone doesn't grant a second vote.
  const validatorRef = hashIdentifier(`${parsed.data.deviceId}:${clientKey}`);

  try {
    const report = await reportService.applyCommunityValidation(id, parsed.data.action, validatorRef);

    if (report === null) {
      return NextResponse.json(
        { alreadyVoted: true, message: "Nakapag-confirm ka na sa report na ito." },
        { status: 200 }
      );
    }

    return NextResponse.json({ report, alreadyVoted: false });
  } catch {
    return NextResponse.json(
      { error: "Hindi na-save ang confirmation. Subukan ulit." },
      { status: 500 }
    );
  }
}
