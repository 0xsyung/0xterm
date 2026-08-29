/**
 * @file PriceCard.tsx
 * @description Theme-reactive price widget (on-chain + DexScreener API)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */

// Structured render data for a price pin/log. Produced by the `price` command
// so the widget can re-render against the CURRENT theme on every theme switch
// (both in the console and when pinned).
export type PriceCardData = {
  kind: "price";
  mode: "onchain" | "api";
  pairAddress?: string;
  symbolA?: string;
  symbolB?: string;
  // Persisted token addresses so a pinned price card re-resolves its tokens
  // deterministically (no ambiguity picker) on 60s refresh / rehydrate.
  symbolAAddress?: string;
  symbolBAddress?: string;
  rate?: number;
  dexName?: string;
  chainName?: string;
  priceUsd?: string;
  priceNative?: string;
  tokenSymbol?: string;
  quoteSymbol?: string;
  dex?: string;
  chain?: string;
  h24?: number;
};

export default function PriceCard({
  data,
  theme,
  compact = false
}: {
  data: PriceCardData;
  theme: any;
  compact?: boolean;
}) {
  // Shared compact chrome: tight padding, small font. When `compact` (pinned
  // panel) it also drops the pool-address footer to save vertical space.
  const shell = `my-3 p-2 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-[10px] space-y-1`;
  const header = `flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`;
  const label = `text-[8px] ${theme.text}/50`;
  const value = `font-bold ${theme.primary}`;

  if (data.mode === "onchain") {
    return (
      <div className={shell}>
        <div className={header}>
          <span className="font-bold truncate">
            ON-CHAIN POOL PRICE ({data.dexName})
          </span>
          <span className="uppercase shrink-0">{data.chainName}</span>
        </div>
        <div className={`grid grid-cols-2 gap-2 ${theme.text}`}>
          <div>
            <div className={label}>PAIR</div>
            <div className={`text-xs ${value} whitespace-nowrap`}>
              {data.symbolA} / {data.symbolB}
            </div>
          </div>
          <div>
            <div className={label}>RATE (ON-CHAIN)</div>
            <div className={`text-xs ${value} whitespace-nowrap`}>
              1 {data.symbolA} ={" "}
              {Number(data.rate).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8
              })}{" "}
              {data.symbolB}
            </div>
          </div>
        </div>
        {!compact && data.pairAddress && (
          <div
            className={`text-[8px] ${theme.text}/40 truncate pt-1 border-t ${theme.border}`}
          >
            POOL ADDRESS: {data.pairAddress}
          </div>
        )}
      </div>
    );
  }

  // api mode
  const h24 = data.h24;
  return (
    <div className={shell}>
      <div className={header}>
        <span className="font-bold truncate">
          DEXSCREENER API PRICE ({String(data.dex).toUpperCase()})
        </span>
        <span className="uppercase shrink-0">{data.chain}</span>
      </div>
      <div className={`grid grid-cols-2 gap-2 ${theme.text}`}>
        <div>
          <div className={label}>PAIR</div>
          <div className={`text-xs ${value} whitespace-nowrap`}>
            {data.tokenSymbol} / {data.quoteSymbol}
          </div>
        </div>
        <div>
          <div className={label}>PRICE (USD)</div>
          <div className={`text-xs ${value}`}>
            $
            {data.priceUsd
              ? parseFloat(data.priceUsd).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6
                })
              : "N/A"}
          </div>
        </div>
        <div>
          <div className={label}>PRICE ({data.quoteSymbol})</div>
          <div className={`text-xs ${value}`}>
            {data.priceNative
              ? parseFloat(data.priceNative).toLocaleString(undefined, {
                  maximumFractionDigits: 6
                })
              : "N/A"}
          </div>
        </div>
        <div>
          <div className={label}>24H CHANGE</div>
          <div
            className={`text-xs ${
              h24 === undefined
                ? theme.muted
                : h24 < 0
                  ? "text-red-400"
                  : theme.primary
            }`}
          >
            {h24 !== undefined ? `${h24 > 0 ? "+" : ""}${h24}%` : "N/A"}
          </div>
        </div>
      </div>
    </div>
  );
}
