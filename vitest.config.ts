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
        // solc wasm loader/worker glue — network + Worker; covered by dig unit tests
        "src/components/terminal/dig/solc.ts",
        // IndexedDB + command router need browser/worker; pure helpers tested separately (#39)
        "src/components/terminal/dig/idb.ts",
        "src/components/terminal/dig/runDig.ts",
        // Dig widgets are presentational chrome (Stephy lock); logic in dig/*.ts
        "src/components/terminal/widgets/DigEditorWidget.tsx",
        "src/components/terminal/widgets/DigArtifactWidget.tsx",
        "src/components/terminal/widgets/DigAbiWidget.tsx",
        "src/components/terminal/widgets/DigOpcodesWidget.tsx",
        "src/components/terminal/widgets/DigRunWidget.tsx",
        "src/components/terminal/widgets/DigConfirmWidget.tsx",
        // static marketing page — pure presentational, no logic to cover
        "src/app/page.tsx",
        // app entry — viewport/keyboard wiring, no testable logic (issue #49)
        "src/app/app/page.tsx",
        "src/**/*.test.{ts,tsx}",
      ],
      thresholds: {
        // Ratchet — measured 2026-09-13 after dig run (#40):
        // Lines 62.62%, Statements 62.08%, Functions 60.36%, Branches 48.07%.
        // Hard-fail at floor(measured). Climb toward 90% is tracked in #37.
        lines: 62,
        statements: 62,
        functions: 60,
        branches: 48,
      },
    },
  },
});
