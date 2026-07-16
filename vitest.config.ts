import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts"],
    setupFiles: ["server/__tests__/setup.ts"],
    // API tests share one database; run files sequentially to avoid
    // cross-file interference
    fileParallelism: false,
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
});
