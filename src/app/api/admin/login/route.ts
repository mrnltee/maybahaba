import { ADMIN_COOKIE_NAME, adminSessionToken, checkAdminPasscode, isAdminPasscodeConfigured } from "@/lib/admin";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isAdminPasscodeConfigured()) {
    return NextResponse.json(
      { error: "Admin access is not configured on this deployment (ADMIN_PASSCODE not set)." },
      { status: 503 }
    );
  }

  const limit = rateLimit(`admin-login:${getClientKey(request)}`, 10, 300);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";

  if (!checkAdminPasscode(passcode)) {
    return NextResponse.json({ error: "Mali ang passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, adminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
