/**
 * Separate config for the live-run receipt capture, which spends real YouCam units.
 *
 * The main `vitest.config.ts` includes only `tests/**`, so the capture file is
 * unreachable from `npm test` by design. Running it therefore takes a deliberate act:
 * this config plus the APHRODITE_CAPTURE_RECEIPT flag. Two locks, one key each.
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
const emptyStub = fileURLToPath(new URL("../test/stubs/empty.ts", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
  resolve: {
    alias: {
      "server-only": emptyStub,
      "client-only": emptyStub,
      "@": root,
    },
  },
});
