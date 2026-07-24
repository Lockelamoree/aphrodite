import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url)).replace(/\/$/, "");
const emptyStub = fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // `import "server-only"` throws outside a React Server Component bundle;
      // stub it so server modules can be unit-tested under plain Node.
      "server-only": emptyStub,
      "client-only": emptyStub,
      "@": root,
    },
  },
});
