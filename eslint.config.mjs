import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The plugin must be declared in the same config object as any rule
    // that references it (ESLint 9 flat config), so re-register it here
    // rather than relying on it leaking from the shared configs above.
    plugins: { "react-hooks": reactHooks },
    rules: {
      // The React Compiler's "no setState synchronously in an effect"
      // check is stricter than the standard, docs-endorsed
      // loading/error/data fetching pattern used in SearchBox and the
      // admin validation queue — set loading, kick off a fetch, set the
      // result when it resolves. Both guard against races with
      // request-id refs and clean up. Kept as a warning rather than
      // disabled outright so genuinely avoidable cases still get
      // flagged (ValidationControls was rewritten to use
      // useSyncExternalStore because of exactly this rule).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Cloudflare/OpenNext build output — never hand-written.
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
  ]),
]);

export default eslintConfig;
