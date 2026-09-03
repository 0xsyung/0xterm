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
        // v1 baseline measured 2026-09-03: Lines 7.79%, Statements 8.33%,
        // Functions 8.09%, Branches 8.22% across all of src/. Hard-fail at
        // floor(measured) so CI stays green while TerminalShell.tsx (~5.3k
        // lines, 0% covered) is still in the include set. Climbing toward 90%
        // is tracked in the extraction follow-up issue.
        lines: 7,
        statements: 8,
        functions: 8,
        branches: 8,
      },
    },
  },
});
