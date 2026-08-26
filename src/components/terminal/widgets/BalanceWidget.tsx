/**
 * @file BalanceWidget.tsx
 * @description Balance widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { ThemeConfig } from "../types";

export default function BalanceWidget({
  balance,
  symbol,
  theme,
  onPin,
  pinned
}: {
  balance: string;
  symbol: string;
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
}) {
  return (
    <div
      className={`relative group my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-md text-xs font-bold ${theme.primary}`}
    >
      {balance} {symbol}
      {onPin && (
        <button
          type="button"
          onClick={onPin}
          title={pinned ? "Unpin" : "Pin to right panel"}
          className={`absolute top-1 right-1 uppercase text-[10px] px-1 py-0.5 border ${theme.border} ${theme.cardBg} cursor-pointer ${theme.primary} ${pinned ? "opacity-60" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}
        >
          {pinned ? "✕" : "📌"}
        </button>
      )}
    </div>
  );
}
