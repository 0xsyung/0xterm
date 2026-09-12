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
        // Ratchet — measured 2026-09-12 under CI Node after terminal modes (#54):
        // Lines 29.06%, Statements 30.02%, Functions 30.65%, Branches 24.31%.
        // Hard-fail at floor(measured) so CI stays green while TerminalShell.tsx
        // / SocialPanel.tsx (0% covered) remain in the include set. Climb toward
        // 90% is tracked in issue #37.
        lines: 29,
        statements: 30,
        functions: 30,
        branches: 24,
      },
    },
  },
});
