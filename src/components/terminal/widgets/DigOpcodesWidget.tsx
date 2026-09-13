/**
 * @file DigOpcodesWidget.tsx
 * @description Dig runtime opcodes dump (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import type { ThemeConfig } from "../types";
import type { OpcodeRow } from "../dig/opcodes";

export default function DigOpcodesWidget({
  name,
  rows,
  truncated,
  theme
}: {
  name: string;
  rows: OpcodeRow[];
  truncated: boolean;
  theme: ThemeConfig;
}) {
  return (
    <div
      className={`relative my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-xl ${theme.text}`}
    >
      <div
        className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider`}
      >
        <span className={theme.primary}>OPCODES</span>{" "}
        <span className={theme.muted}>{name}</span>
      </div>
      <div className="max-h-64 overflow-y-auto font-mono text-[10px] leading-snug">
        {rows.map((r, i) => (
          <div key={`${r.pc}-${i}`} className="flex gap-2">
            <span className={`${theme.muted} tabular-nums shrink-0 w-10 text-right`}>
              {r.pc}
            </span>
            <span
              className={theme.text}
              style={{ overflowWrap: "anywhere" }}
            >
              {r.mnemonic}
              {r.immediate ? ` ${r.immediate}` : ""}
            </span>
          </div>
        ))}
      </div>
      {truncated && (
        <div className={`mt-2 text-[10px] ${theme.muted}`}>
          · dig opcodes --all
        </div>
      )}
    </div>
  );
}
