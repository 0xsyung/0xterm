/**
 * @file InvestWorkspace.tsx
 * @description Invest mode action-tile launcher (#80/#117)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import type { ThemeConfig } from "../types";
import { WorkspaceTile } from "./WorkspaceTile";
import type { WorkspaceAction, WorkspacePanelId } from "./WorkspaceTile";

const ACTIONS: WorkspaceAction[] = [
  {
    cmd: "price",
    label: "PRICE",
    hint: "open price panel",
    panel: "price"
  },
  { cmd: "swap", label: "SWAP", hint: "swap <amt> <from> <to>" },
  { cmd: "balance", label: "BALANCE", hint: "balance <token>" },
  { cmd: "portfolio", label: "PORTFOLIO", hint: "all chains + P/L" },
  { cmd: "snapshot", label: "SNAPSHOT", hint: "record baseline" },
  { cmd: "pnl", label: "PNL", hint: "vs last snapshot" },
  { cmd: "ticker", label: "TICKER", hint: "watchlist board" },
  { cmd: "news", label: "NEWS", hint: "headlines" },
  { cmd: "createpool", label: "CREATE POOL", hint: "createpool <tA> <tB>" },
  { cmd: "getpool", label: "GET POOL", hint: "getpool <tA> <tB>" },
  { cmd: "addliq", label: "ADD LIQUIDITY", hint: "addliq <tA> <tB> <amtA> <amtB>" },
  { cmd: "networks", label: "NETWORKS", hint: "list chains" }
];

export function InvestWorkspace({
  theme,
  onCommand,
  onOpenPanel
}: {
  theme: ThemeConfig;
  onCommand: (cmd: string) => void;
  onOpenPanel?: (panel: WorkspacePanelId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTIONS.map((a) => (
        <WorkspaceTile
          key={a.cmd}
          theme={theme}
          action={a}
          onCommand={onCommand}
          onOpenPanel={onOpenPanel}
        />
      ))}
    </div>
  );
}
