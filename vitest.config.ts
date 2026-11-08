import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so the vinext and Cloudflare plugins don't load in tests.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
