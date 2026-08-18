import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Whether the caller already holds a valid moderator session.
 *
 * Exists so the public header can reveal the admin entry point only to
 * someone already signed in. The brief is explicit that administrative
 * functions must not be exposed through the public interface (section
 * 39), and a permanently-visible "Admin" link would do exactly that.
 *
 * Returns only a boolean — no passcode, no session token, nothing that
 * helps an anonymous caller become an admin. Answering "no" to everyone
 * else leaks nothing beyond the fact that the app has moderators, which
 * the README states anyway.
 */
export async function GET() {
  const cookieStore = await cookies();
  const isAdmin = isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  return NextResponse.json(
    { isAdmin },
    // Never cache: the answer is per-session and changes on login/logout.
    { headers: { "Cache-Control": "no-store" } }
  );
}
