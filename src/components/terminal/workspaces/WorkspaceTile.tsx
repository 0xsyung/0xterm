/**
 * @file WorkspaceTile.tsx
 * @description Mouse-first action tile — fires an existing terminal command (#80)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import type { ThemeConfig } from "../types";

export type WorkspaceAction = {
  cmd: string;
  label: string;
  hint: string;
};

export function WorkspaceTile({
  theme,
  action,
  onCommand
}: {
  theme: ThemeConfig;
  action: WorkspaceAction;
  onCommand: (cmd: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCommand(action.cmd)}
      className={`flex flex-col items-start gap-0.5 px-2.5 py-1.5 border ${theme.border} ${theme.cardBg} ${theme.muted} cursor-pointer uppercase tracking-widest text-[10px] pointer-coarse:min-h-[44px] [@media(hover:none)]:min-h-[44px]`}
    >
      <span className={theme.primary}>{action.label}</span>
      <span className="opacity-70 normal-case">{action.hint}</span>
    </button>
  );
}
