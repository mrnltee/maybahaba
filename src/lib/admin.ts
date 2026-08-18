import { createHash, timingSafeEqual } from "crypto";

/**
 * Very lightweight shared-passcode gate for the /admin/validate
 * moderation view (spec section 39: admin functions must not be exposed
 * through the public interface).
 *
 * This is intentionally minimal for MVP — good enough to keep the
 * validation queue off the public nav and out of casual reach, but it is
 * NOT a substitute for real authentication. Before inviting multiple
 * moderators in production, replace this with Supabase Auth + a
 * `moderators` table (see README "Roadmap").
 */

export const ADMIN_COOKIE_NAME = "mbb_admin";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isAdminPasscodeConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSCODE);
}

export function checkAdminPasscode(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return false;
  const a = Buffer.from(digest(candidate));
  const b = Buffer.from(digest(expected));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Value stored in the admin session cookie — a hash, never the raw passcode. */
export function adminSessionToken(): string {
  return digest(`${process.env.ADMIN_PASSCODE ?? ""}:session`);
}

export function isValidAdminSession(cookieValue: string | undefined): boolean {
  if (!cookieValue || !isAdminPasscodeConfigured()) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(adminSessionToken());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
