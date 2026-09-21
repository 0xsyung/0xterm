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
        "src/components/terminal/widgets/DigDebugWidget.tsx",
        // Settings panel (#81): presentational chrome; pure helpers in settingsPrefs.ts
        "src/components/terminal/widgets/SettingsPanel.tsx",
        // static marketing page — pure presentational, no logic to cover
        "src/app/page.tsx",
        // app entry — thin host gate; TerminalApp holds shell wiring (#78)
        "src/app/app/page.tsx",
        // terminal shell entry (extracted from app/page; viewport wiring #49/#78)
        "src/components/terminal/TerminalApp.tsx",
        // client host gate chrome — logic covered by hostRouting unit tests (#78)
        "src/components/HostRedirect.tsx",
        "src/**/*.test.{ts,tsx}",
      ],
      thresholds: {
        // Ratchet — measured 2026-09-21 after #78 host routing:
        // Lines 42.95%, Statements 43%, Functions 45.8%, Branches 35.95%.
        // Hard-fail at floor(measured). Climb toward 90% is tracked in #37.
        lines: 42,
        statements: 42,
        functions: 45,
        branches: 35,
      },


    },
  },
});
