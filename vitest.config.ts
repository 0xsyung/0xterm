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
        // Ratchet — measured 2026-09-12 under CI Node after share portfolio (#62):
        // Lines 31.21%, Statements 32.04%, Functions 33.81%, Branches 27.30%.
        // Hard-fail at floor(measured) so CI stays green while TerminalShell.tsx
        // / SocialPanel.tsx (0% covered) remain in the include set. Climb toward
        // 90% is tracked in issue #37.
        lines: 31,
        statements: 32,
        functions: 33,
        branches: 27,
      },
    },
  },
});
