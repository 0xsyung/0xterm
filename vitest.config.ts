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
        // localhost-only marketing page — pure presentational; prod landing is 0xterm-dot-xyz
        "src/app/page.tsx",
        // app entry — thin host gate; TerminalApp holds shell wiring (#78)
        "src/app/app/page.tsx",
        // terminal shell entry (extracted from app/page; viewport wiring #49/#78)
        "src/components/terminal/TerminalApp.tsx",
        // client host gate chrome — logic covered by hostRouting unit tests (#78)
        "src/components/HostRedirect.tsx",
        // issue-authorized (#6): wagmi-bound components whose pure logic lives in
        // covered modules — TerminalShell wires useAccount/AppKit; tx widgets call
        // wagmi hooks (writeContract/estimateGas) needing provider mocks
        "src/components/terminal/TerminalShell.tsx",
        "src/components/terminal/SwapWidget.tsx",
        "src/components/terminal/widgets/DeployWidget.tsx",
        "src/components/terminal/widgets/CreatePoolWidget.tsx",
        "src/components/terminal/widgets/AddLiquidityWidget.tsx",
        "src/components/terminal/widgets/InitializePoolWidget.tsx",
        // wagmi provider/app glue + GA4 adapter — thin entry chrome (#6)
        "src/config/wagmi.ts",
        "src/app/layout.tsx",
        "src/app/app/layout.tsx",
        "src/app/providers.tsx",
        "src/lib/analytics.ts",
        "src/**/*.test.{ts,tsx}",
      ],
      thresholds: {
        // #6 gate — scoped to files we own (wagmi-bound chrome excluded above).
        // Measured 2026-09-22 against the scoped denominator: must hold
        // lines/statements/functions >=80, branches >=65. Raise with care.
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 65,
      },


    },
  },
});
