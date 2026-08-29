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
  theme
}: {
  data: PriceCardData;
  theme: any;
}) {
  if (data.mode === "onchain") {
    return (
      <div
        className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2`}
      >
        <div
          className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
        >
          <span className="font-bold">ON-CHAIN POOL PRICE ({data.dexName})</span>
          <span className="uppercase">{data.chainName}</span>
        </div>
        <div className={`grid grid-cols-2 gap-4 ${theme.text}`}>
          <div>
            <div className={`text-[10px] ${theme.text}/50`}>PAIR</div>
            <div className={`text-base font-bold ${theme.primary}`}>
              {data.symbolA} / {data.symbolB}
            </div>
          </div>
          <div>
            <div className={`text-[10px] ${theme.text}/50`}>RATE (ON-CHAIN)</div>
            <div className={`text-base font-bold ${theme.primary}`}>
              1 {data.symbolA} ={" "}
              {Number(data.rate).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8
              })}{" "}
              {data.symbolB}
            </div>
          </div>
        </div>
        <div
          className={`text-[9px] ${theme.text}/40 truncate pt-1 border-t ${theme.border}`}
        >
          POOL ADDRESS: {data.pairAddress}
        </div>
      </div>
    );
  }

  // api mode
  const h24 = data.h24;
  return (
    <div
      className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2`}
    >
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
      >
        <span className="font-bold">
          DEXSCREENER API PRICE ({String(data.dex).toUpperCase()})
        </span>
        <span className="uppercase">{data.chain}</span>
      </div>
      <div className={`grid grid-cols-2 gap-4 ${theme.text}`}>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>PAIR</div>
          <div className={`text-base font-bold ${theme.primary}`}>
            {data.tokenSymbol} / {data.quoteSymbol}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>PRICE (USD)</div>
          <div className={`text-base font-bold ${theme.primary}`}>
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
          <div className={`text-[10px] ${theme.text}/50`}>
            PRICE ({data.quoteSymbol})
          </div>
          <div className={`text-base font-bold ${theme.primary}`}>
            {data.priceNative
              ? parseFloat(data.priceNative).toLocaleString(undefined, {
                  maximumFractionDigits: 6
                })
              : "N/A"}
          </div>
        </div>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>24H CHANGE</div>
          <div
            className={`text-base font-bold ${
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
