/**
 * @file AllowanceRevokeWidget.tsx
 * @description allowances revoke confirm card (#109) — mirrors RunConfirmWidget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useState } from "react";
import type { ThemeConfig } from "../types";
import type { RevokeTx } from "../allowances";

export default function AllowanceRevokeWidget({
  theme,
  chainName,
  txs,
  onConfirm,
  onCancel
}: {
  theme: ThemeConfig;
  chainName: string;
  txs: RevokeTx[];
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const touch =
    "pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px] [@media(hover:none)]:min-h-[44px]";

  return (
    <div
      className={`relative my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-md ${theme.text}`}
    >
      <div className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider ${theme.primary}`}>
        REVOKE CONFIRM
      </div>
      <div className={`text-[10px] ${theme.muted} mb-2`}>
        {txs.length} approval{txs.length === 1 ? "" : "s"} on {chainName}. Each
        tx calls <span className="font-mono">approve(spender, 0)</span>.
      </div>
      <div className="space-y-1 text-[10px] max-h-40 overflow-y-auto">
        {txs.map((tx, i) => (
          <div key={`${tx.tokenAddress}-${tx.spenderAddress}-${i}`} className="flex gap-1">
            <span className={theme.primary}>{tx.tokenSymbol}</span>
            <span className={theme.muted}>· {tx.spenderLabel}</span>
            <span className={`${theme.text}/60 font-mono ml-auto`}>
              approve 0
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          className={`px-3 py-1 border ${theme.border} ${theme.primary} font-bold text-[10px] ${touch}`}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          REVOKE
        </button>
        <button
          type="button"
          disabled={busy}
          className={`px-3 py-1 border ${theme.border} ${theme.muted} text-[10px] ${touch}`}
          onClick={onCancel}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
