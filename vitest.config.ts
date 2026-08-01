import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration files share the same PostgreSQL schema and clean it between cases.
    // Keep files serial so one suite cannot delete another suite's active run.
    fileParallelism: false,
  },
});
