import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    include: ["dist/**/*.test.js"],
    exclude: ["**/node_modules/**"],
    globals: true,
    pool: "threads",
  },
});
