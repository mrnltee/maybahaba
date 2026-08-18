import { createHash } from "crypto";

/**
 * Minimal in-memory rate limiter (spec section 23/46).
 *
 * IMPORTANT DEPLOYMENT CAVEAT: these counters live in one process's
 * memory. On any multi-instance platform the limit is per-instance, not
 * global — and on Cloudflare Workers that is especially loose, because
 * the app runs in many colos worldwide, each with its own isolate. Treat
 * this as friction against casual spam, not as a security control.
 *
 * The limits that actually matter are enforced in the database instead:
 * the unique index on (report_id, validator_ref) makes double-voting
 * impossible regardless of which isolate serves the request.
 *
 * Upgrade path for a genuinely global limit: a Durable Object keyed by
 * client hash, Cloudflare's Rate Limiting binding, or Upstash Redis
 * (free tier). See README → "Abuse prevention".
 */

interface Bucket {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartMs >= windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.ceil((existing.windowStartMs + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Hashes an identifying value (IP address, etc.) so raw values are never
 * stored or logged (spec section 23: "IP hashing rather than storing raw
 * IP addresses").
 */
export function hashIdentifier(value: string): string {
  const salt = process.env.ABUSE_HASH_SALT ?? "maybahaba-dev-salt";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

/** Best-effort client identifier from request headers, for rate limiting only. */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return hashIdentifier(ip);
}
