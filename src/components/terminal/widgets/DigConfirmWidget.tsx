/**
 * @file DigConfirmWidget.tsx
 * @description Chain send/deploy confirm card (#40 Stephy lock)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useState } from "react";
import type { Address } from "viem";
import type { ThemeConfig } from "../types";
import { formatGas } from "../dig/gas";
import { truncateAddress, truncateHex } from "../dig/encode";

export default function DigConfirmWidget({
  theme,
  to,
  dataSummary,
  value,
  gasEstimate,
  onConfirm,
  onCancel
}: {
  theme: ThemeConfig;
  to: Address;
  dataSummary: string;
  value: bigint;
  gasEstimate: bigint;
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
      <div
        className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider ${theme.primary}`}
      >
        CONFIRM
      </div>
      <div className="space-y-1 text-[10px]">
        <div>
          <span className={theme.muted}>TO </span>
          <span className="tabular-nums font-mono break-all">
            {to === "0x0000000000000000000000000000000000000000"
              ? "(create)"
              : truncateAddress(to)}
          </span>
        </div>
        <div>
          <span className={theme.muted}>DATA </span>
          <span className="break-words">{dataSummary || truncateHex("0x")}</span>
        </div>
        <div>
          <span className={theme.muted}>VALUE </span>
          <span className="tabular-nums">{value.toString()} wei</span>
        </div>
        <div>
          <span className={theme.muted}>GAS </span>
          <span className="tabular-nums">{formatGas(gasEstimate)}</span>
          <span className={` ${theme.muted}`}> estimate</span>
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
          SEND
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
