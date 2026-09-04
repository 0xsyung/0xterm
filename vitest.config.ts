import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // issue-authorized: bytecode blob, not worth testing
        "src/components/terminal/implementationBytecode.ts",
        // static marketing page — pure presentational, no logic to cover
        "src/app/page.tsx",
        // app entry — viewport/keyboard wiring, no testable logic (issue #49)
        "src/app/app/page.tsx",
        "src/**/*.test.{ts,tsx}",
      ],
      thresholds: {
        // Ratchet — measured 2026-09-04 after pool-price ratio extraction (#37):
        // Lines 19.6%, Statements 20.25%, Functions 16.66%, Branches 17.63%.
        // Hard-fail at floor(measured) so CI stays green while TerminalShell.tsx
        // (~4.5k lines, 0% covered) is still in the include set. Climb toward
        // 90% is tracked in issue #37.
        lines: 19,
        statements: 20,
        functions: 16,
        branches: 17,
      },
    },
  },
});
