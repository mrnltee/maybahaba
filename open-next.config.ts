import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext adapter config for Cloudflare Workers.
 *
 * Intentionally minimal. MayBahaBa's routes are dynamic by design —
 * flood conditions must never be served from a stale cache — so no
 * incremental cache (R2/KV) is wired up. If you later add genuinely
 * static or ISR pages (a barangay landing page, historical maps), add:
 *
 *   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 *   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
 *
 * and add the matching r2_buckets binding in wrangler.jsonc.
 */
export default defineCloudflareConfig({});
