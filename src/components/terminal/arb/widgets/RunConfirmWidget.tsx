/**
 * @file RunConfirmWidget.tsx
 * @description arb run confirm card — mirrors DigConfirmWidget (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useState } from "react";
import type { Address } from "viem";
import type { ThemeConfig } from "../../types";
import { truncateAddress } from "../../dig/encode";

export default function RunConfirmWidget({
  theme,
  pair,
  venues,
  size,
  minProfit,
  executor,
  flashSource,
  onConfirm,
  onCancel
}: {
  theme: ThemeConfig;
  pair: string;
  venues: string;
  size: string;
  minProfit: string;
  executor: Address;
  flashSource: string;
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
        ARB RUN CONFIRM
      </div>
      <div className="space-y-1 text-[10px]">
        <div>
          <span className={theme.muted}>PAIR </span>
          <span className="tabular-nums font-mono">{pair}</span>
        </div>
        <div>
          <span className={theme.muted}>VENUES </span>
          <span className="break-words">{venues}</span>
        </div>
        <div>
          <span className={theme.muted}>SIZE </span>
          <span className="tabular-nums">{size}</span>
        </div>
        <div>
          <span className={theme.muted}>MIN PROFIT </span>
          <span className="tabular-nums">{minProfit}</span>
        </div>
        <div>
          <span className={theme.muted}>FLASH </span>
          <span className="tabular-nums font-mono">{flashSource}</span>
        </div>
        <div>
          <span className={theme.muted}>EXECUTOR </span>
          <span className="tabular-nums font-mono break-all">{truncateAddress(executor)}</span>
        </div>
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
          RUN
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
