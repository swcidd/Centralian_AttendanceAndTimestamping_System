import { defineConfig } from "vitest/config";

// Vitest is intentionally a separate config from vite.config.ts so test
// runs don't load the React/compiler/Tailwind plugin chain.
export default defineConfig({
  test: {
    // Phase 1 targets pure logic — run in Node (fast, no DOM needed).
    // Component tests can opt into jsdom per-file with a
    // `// @vitest-environment jsdom` comment (or a setupFiles entry).
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});