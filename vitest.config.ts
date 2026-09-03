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
        "src/**/*.test.{ts,tsx}",
      ],
      thresholds: {
        // Ratchet — measured 2026-09-03 after probeToken.ts extraction (#37):
        // Lines 15.55%, Statements 16.16%, Functions 13.95%, Branches 14.7%.
        // Hard-fail at floor(measured) so CI stays green while TerminalShell.tsx
        // (~5.2k lines, 0% covered) is still in the include set. Climb toward
        // 90% is tracked in issue #37.
        lines: 15,
        statements: 16,
        functions: 13,
        branches: 14,
      },
    },
  },
});
