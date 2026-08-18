import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  turbopack: {
    /**
     * Pin the project root explicitly.
     *
     * Turbopack infers the root by walking up for a lockfile. If this
     * project sits inside a parent directory that happens to contain its
     * own package.json/lockfile, Turbopack would otherwise warn about an
     * ambiguous root. Pinning it to this directory keeps module
     * resolution, file watching, and caching scoped to the project.
     */
    root: __dirname,
  },
};

export default nextConfig;

/**
 * Makes Cloudflare bindings and `.dev.vars` available during `next dev`,
 * so local development behaves like the deployed Worker. No-op in
 * production builds.
 */
initOpenNextCloudflareForDev();
