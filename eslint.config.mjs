import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested build output + Claude Code's local worktrees (both gitignored) must
    // never be linted — compiled bundles under .claude/worktrees/**/.next otherwise
    // surface thousands of false positives that have nothing to do with the source.
    "**/.next/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
