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
  theme
}: {
  balance: string;
  symbol: string;
  theme: ThemeConfig;
}) {
  return (
    <div
      className={`my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-md text-xs font-bold ${theme.primary}`}
    >
      {balance} {symbol}
    </div>
  );
}
