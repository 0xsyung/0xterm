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
        // Ratchet — measured 2026-09-09 under CI Node (24, npm ci) after chat
        // key binding (#C-1) on the merged tree (incl. rpc extraction #57):
        // Lines 27.13%, Statements 27.72%, Functions 23.75%, Branches 22.5%.
        // Hard-fail at floor(measured) so CI stays green while TerminalShell.tsx
        // (~4.3k lines, 0% covered) is still in the include set. Climb toward
        // 90% is tracked in issue #37.
        lines: 27,
        statements: 27,
        functions: 23,
        branches: 22,
      },
    },
  },
});
