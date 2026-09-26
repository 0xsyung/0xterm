/**
 * @file WorkspaceTile.tsx
 * @description Mouse-first action tile — fires a command or opens a panel (#80/#117)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import type { ThemeConfig } from "../types";

export type WorkspacePanelId = "price" | "swap";

export type WorkspaceAction = {
  cmd: string;
  label: string;
  hint: string;
  /** When set, tile opens a tool panel instead of firing a bare command (#117). */
  panel?: WorkspacePanelId;
};

export function WorkspaceTile({
  theme,
  action,
  onCommand,
  onOpenPanel
}: {
  theme: ThemeConfig;
  action: WorkspaceAction;
  onCommand: (cmd: string) => void;
  onOpenPanel?: (panel: WorkspacePanelId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (action.panel && onOpenPanel) {
          onOpenPanel(action.panel);
          return;
        }
        onCommand(action.cmd);
      }}
      className={`flex flex-col items-start gap-0.5 px-2.5 py-1.5 border ${theme.border} ${theme.cardBg} ${theme.muted} cursor-pointer uppercase tracking-widest text-[10px] pointer-coarse:min-h-[44px] [@media(hover:none)]:min-h-[44px]`}
    >
      <span className={theme.primary}>{action.label}</span>
      <span className="opacity-70 normal-case">{action.hint}</span>
    </button>
  );
}
