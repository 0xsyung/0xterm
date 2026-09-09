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
        // Ratchet — measured 2026-09-09 under CI (Node 24, npm ci) after chat
        // key binding (#C-1): Lines 23.87%, Statements 24.7%, Functions 22.67%,
        // Branches 19.92%. NOTE: v8 coverage yields different numbers under
        // Node 24 (CI) than Node 20 (local) — measure with `npx vitest run
        // --coverage` under the CI Node before ratcheting.
        // Hard-fail at floor(measured) so CI stays green while TerminalShell.tsx
        // (~4.3k lines, 0% covered) is still in the include set. Climb toward
        // 90% is tracked in issue #37.
        lines: 23,
        statements: 24,
        functions: 22,
        branches: 19,
      },
    },
  },
});
