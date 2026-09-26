/**
 * @file workspaces/index.tsx
 * @description Workspace launcher strip — picks the tile grid by mode (#80/#117)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import type { ThemeConfig } from "../types";
import type { TerminalMode } from "../mode";
import { InvestWorkspace } from "./InvestWorkspace";
import { ForensicWorkspace } from "./ForensicWorkspace";
import { DevWorkspace } from "./DevWorkspace";
import type { WorkspacePanelId } from "./WorkspaceTile";

/**
 * Mode → workspace launcher. Console has no launcher (raw terminal, no gating).
 * Returns null for console so the shell renders the plain log view.
 */
export function WorkspaceStrip({
  theme,
  mode,
  onCommand,
  onOpenPanel
}: {
  theme: ThemeConfig;
  mode: TerminalMode;
  onCommand: (cmd: string) => void;
  onOpenPanel?: (panel: WorkspacePanelId) => void;
}) {
  if (mode === "console") return null;
  if (mode === "forensic") {
    return <ForensicWorkspace theme={theme} onCommand={onCommand} />;
  }
  if (mode === "dev") {
    return <DevWorkspace theme={theme} onCommand={onCommand} />;
  }
  return (
    <InvestWorkspace
      theme={theme}
      onCommand={onCommand}
      onOpenPanel={onOpenPanel}
    />
  );
}
