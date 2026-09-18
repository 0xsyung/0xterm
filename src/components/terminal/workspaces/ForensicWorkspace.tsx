/**
 * @file ForensicWorkspace.tsx
 * @description Forensic mode action-tile launcher (#80)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import type { ThemeConfig } from "../types";
import { WorkspaceTile } from "./WorkspaceTile";
import type { WorkspaceAction } from "./WorkspaceTile";

const ACTIONS: WorkspaceAction[] = [
  { cmd: "kyt", label: "KYT", hint: "kyt <address>" },
  { cmd: "kya", label: "KYA", hint: "kya <address>" },
  { cmd: "sim", label: "SIM", hint: "sim <tx>" },
  { cmd: "trace", label: "TRACE", hint: "trace <tx>" },
  { cmd: "is", label: "CHECK TOKEN", hint: "is <erc20|erc721> <address>" },
  { cmd: "info", label: "TOKEN INFO", hint: "info <address>" },
  { cmd: "price", label: "PRICE", hint: "read helper" },
  { cmd: "portfolio", label: "PORTFOLIO", hint: "read helper" },
  { cmd: "balance", label: "BALANCE", hint: "read helper" }
];

export function ForensicWorkspace({
  theme,
  onCommand
}: {
  theme: ThemeConfig;
  onCommand: (cmd: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTIONS.map((a) => (
        <WorkspaceTile key={a.cmd} theme={theme} action={a} onCommand={onCommand} />
      ))}
    </div>
  );
}
