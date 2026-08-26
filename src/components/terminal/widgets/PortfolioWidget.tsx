/**
 * @file PortfolioWidget.tsx
 * @description Wallet portfolio table across supported chains
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import PinButton from "./PinButton";

export type PortfolioHolding = {
  chainName: string;
  chainId: number;
  symbol: string;
  type: "native" | "erc20";
  balance: string;
  priceUsd: number | null;
  valueUsd: number | null;
  change24h: number | null;
  priceSource: string;
  isTestnet: boolean;
};

export type SnapshotHolding = {
  price: number | null;
  balance: string;
};

export default function PortfolioWidget({
  holdings,
  snapshot,
  snapshotLabel,
  snapshotTime,
  theme,
  fetching,
  onPin,
  pinned
}: {
  holdings: PortfolioHolding[];
  snapshot?: Record<string, SnapshotHolding>;
  snapshotLabel?: string;
  snapshotTime?: number;
  theme: any;
  fetching?: boolean;
  onPin?: () => void;
  pinned?: boolean;
}) {
  const hasSnapshot = !!snapshot && Object.keys(snapshot).length > 0;

  const mainnetHoldings = holdings.filter((h) => !h.isTestnet);
  const testnetHoldings = holdings.filter((h) => h.isTestnet);

  // aggregate totals (mainnet only — testnet assets have no real USD value)
  let totalUsd = 0;
  let totalPnlPrice = 0;
  let totalPnlBalance = 0;
  let pricedCount = 0;

  for (const h of mainnetHoldings) {
    if (h.valueUsd !== null) {
      totalUsd += h.valueUsd;
      pricedCount++;
    }
    const snapKey = `${h.chainId}:${h.symbol}`;
    const snap = snapshot?.[snapKey];
    if (snap && hasSnapshot) {
      if (h.valueUsd !== null && snap.price !== null) {
        // price-based P/L: (now - snapPrice) * current balance
        const snapValue = snap.price * parseFloat(h.balance);
        totalPnlPrice += (h.valueUsd ?? 0) - snapValue;
      }
      // balance-based delta: (now value) - (snap value at snap balance/price)
      const snapValue2 = snap.price !== null ? snap.price * parseFloat(snap.balance) : null;
      if (h.valueUsd !== null && snapValue2 !== null) {
        totalPnlBalance += h.valueUsd - snapValue2;
      }
    }
  }

  const renderTable = (rows: PortfolioHolding[], showPnl: boolean) => (
    <table className={`w-full text-left ${theme.text}`}>
      <thead>
        <tr className={`text-[10px] ${theme.text}/50 border-b ${theme.border}`}>
          <th className="py-1 pr-2">CHAIN</th>
          <th className="py-1 pr-2">TOKEN</th>
          <th className="py-1 pr-2 text-right">BALANCE</th>
          <th className="py-1 pr-2 text-right">USD VALUE</th>
          <th className="py-1 pr-2 text-right">Δ24H</th>
          {showPnl && hasSnapshot && (
            <th className="py-1 pr-2 text-right">P/L (PRICE)</th>
          )}
          {showPnl && hasSnapshot && (
            <th className="py-1 pr-2 text-right">BAL Δ</th>
          )}
          <th className="py-1 pr-2">PRICE SRC</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((h) => {
          const snapKey = `${h.chainId}:${h.symbol}`;
          const snap = snapshot?.[snapKey];
          let pnlPrice: number | null = null;
          let pnlBalance: number | null = null;
          if (snap && hasSnapshot) {
            if (h.valueUsd !== null && snap.price !== null) {
              pnlPrice = h.valueUsd - snap.price * parseFloat(h.balance);
            }
            if (h.valueUsd !== null && snap.price !== null) {
              pnlBalance = h.valueUsd - snap.price * parseFloat(snap.balance);
            }
          }
          return (
            <tr key={`${h.chainId}-${h.symbol}`} className={`border-b ${theme.border}/50`}>
              <td className="py-1 pr-2 whitespace-nowrap">{h.chainName}</td>
              <td className="py-1 pr-2 font-bold">{h.symbol}</td>
              <td className="py-1 pr-2 text-right whitespace-nowrap">{h.balance}</td>
              <td className="py-1 pr-2 text-right whitespace-nowrap">
                {h.valueUsd !== null ? `$${h.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
              </td>
              <td className={`py-1 pr-2 text-right whitespace-nowrap ${h.change24h === null ? "" : h.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                {h.change24h !== null ? `${h.change24h > 0 ? "+" : ""}${h.change24h}%` : "—"}
              </td>
              {showPnl && hasSnapshot && (
                <td className={`py-1 pr-2 text-right whitespace-nowrap ${pnlPrice === null ? "" : pnlPrice >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnlPrice !== null ? `${pnlPrice >= 0 ? "+" : ""}$${pnlPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                </td>
              )}
              {showPnl && hasSnapshot && (
                <td className={`py-1 pr-2 text-right whitespace-nowrap ${pnlBalance === null ? "" : pnlBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnlBalance !== null ? `${pnlBalance >= 0 ? "+" : ""}$${pnlBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                </td>
              )}
              <td className="py-1 pr-2 whitespace-nowrap">{h.priceSource}</td>
            </tr>
          );
        })}
      </tbody>
      {showPnl && (
        <tfoot>
          <tr className={`font-bold ${theme.primary}`}>
            <td className="py-1 pr-2 pt-2" colSpan={2}>TOTAL</td>
            <td className="py-1 pr-2 pt-2 text-right">—</td>
            <td className="py-1 pr-2 pt-2 text-right whitespace-nowrap">${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td className="py-1 pr-2 pt-2 text-right">—</td>
            {hasSnapshot && (
              <td className={`py-1 pr-2 pt-2 text-right whitespace-nowrap ${totalPnlPrice >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalPnlPrice >= 0 ? "+" : ""}${totalPnlPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
            )}
            {hasSnapshot && (
              <td className={`py-1 pr-2 pt-2 text-right whitespace-nowrap ${totalPnlBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalPnlBalance >= 0 ? "+" : ""}${totalPnlBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
            )}
            <td className="py-1 pr-2 pt-2"></td>
          </tr>
        </tfoot>
      )}
    </table>
  );

  return (
    <div className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2 max-w-full overflow-x-auto`}>
      <div className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}>
        <span className="font-bold">PORTFOLIO</span>
        <span className="flex items-center gap-2">
          <span className="uppercase">
            {hasSnapshot ? `SNAPSHOT: ${snapshotLabel || "untitled"} · ${snapshotTime ? new Date(snapshotTime).toLocaleString() : ""}` : "NO SNAPSHOT — run 'snapshot' to track P/L"}
          </span>
          {!pinned && <PinButton onPin={onPin} theme={theme} />}
        </span>
      </div>

      {fetching ? (
        <div className={`text-yellow-400 py-2`}>Fetching balances across {holdings.length} chains…</div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className={`font-bold ${theme.text}/70 text-[10px] mb-1`}>MAINNET</div>
            {mainnetHoldings.length > 0 ? (
              renderTable(mainnetHoldings, true)
            ) : (
              <div className={`${theme.text}/50`}>No mainnet holdings.</div>
            )}
          </div>
          {testnetHoldings.length > 0 && (
            <div>
              <div className={`font-bold ${theme.text}/70 text-[10px] mb-1`}>
                TESTNET (NOT REAL VALUE)
              </div>
              <div className={`text-[10px] ${theme.text}/50 mb-1`}>
                Testnet assets have no real USD value — balances shown for reference only.
              </div>
              {renderTable(testnetHoldings, false)}
            </div>
          )}
          {hasSnapshot && (
            <div className={`text-[10px] ${theme.text}/60`}>
              P/L (PRICE) = (now − snapshot price) × current balance · BAL Δ = (now value − snapshot value at snap time). P/L applies to mainnet only.
            </div>
          )}
        </div>
      )}
      {!fetching && pricedCount === 0 && (
        <div className="text-yellow-400 pt-1">No mainnet USD prices available. Balances shown raw.</div>
      )}
    </div>
  );
}
