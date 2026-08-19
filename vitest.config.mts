import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Until now the test suite lived entirely under `src/lib/__tests__/` and
 * imported with relative paths, so it never needed the `@/` alias that
 * the rest of the app uses. The first test to import a module outside
 * that folder failed to resolve `@/lib/geo`.
 *
 * Teaching Vitest the same alias `tsconfig.json` defines means tests can
 * import modules exactly the way the application does, rather than the
 * test file's location dictating its import style.
 *
 * `.mts` rather than `.ts`: this file uses ESM syntax, and Vite's newer
 * native config loader treats a bare `.ts` config as CommonJS and warns
 * on every run. The extension is the fix that does not require setting
 * `"type": "module"` across the whole package.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
