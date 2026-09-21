/**
 * @file PortfolioWidget.tsx
 * @description Wallet portfolio table across supported chains
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import PinButton from "./PinButton";
import { computePnl, snapKeyForHolding } from "../pnlMath";

export type PortfolioHolding = {
  chainName: string;
  chainId: number;
  symbol: string;
  type: "native" | "erc20";
  // address present for erc20; used to key snapshot P/L uniquely so
  // duplicate symbols on one chain don't collide.
  address?: string;
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

  // aggregate totals via shared computePnl (#23) — mainnet only
  const totals = computePnl(holdings, hasSnapshot ? snapshot : null);
  const totalUsd = totals.netUsd ?? 0;
  const totalPnlPrice = totals.pnlPrice ?? 0;
  const totalPnlBalance = totals.pnlBalance ?? 0;
  const pricedCount = mainnetHoldings.filter((h) => h.valueUsd !== null).length;

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
          const snap = snapshot?.[snapKeyForHolding(h)];
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
            <tr key={h.type === "erc20" && h.address ? `${h.chainId}-${h.address.toLowerCase()}` : `${h.chainId}-${h.symbol}`} className={`border-b ${theme.border}/50`}>
              <td className="py-1 pr-2 whitespace-nowrap">{h.chainName}</td>
              <td className="py-1 pr-2 font-bold">{h.symbol}</td>
              <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">{h.balance}</td>
              <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">
                {h.valueUsd !== null ? `$${h.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
              </td>
              <td className={`py-1 pr-2 text-right whitespace-nowrap tabular-nums ${h.change24h === null ? "" : h.change24h >= 0 ? theme.primary : theme.warn}`}>
                {h.change24h !== null ? `${h.change24h > 0 ? "+" : ""}${h.change24h}%` : "—"}
              </td>
              {showPnl && hasSnapshot && (
                <td className={`py-1 pr-2 text-right whitespace-nowrap tabular-nums ${pnlPrice === null ? "" : pnlPrice >= 0 ? theme.primary : theme.warn}`}>
                  {pnlPrice !== null ? `${pnlPrice >= 0 ? "+" : ""}$${pnlPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                </td>
              )}
              {showPnl && hasSnapshot && (
                <td className={`py-1 pr-2 text-right whitespace-nowrap tabular-nums ${pnlBalance === null ? "" : pnlBalance >= 0 ? theme.primary : theme.warn}`}>
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
            <td className="py-1 pr-2 pt-2 text-right whitespace-nowrap tabular-nums">${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td className="py-1 pr-2 pt-2 text-right">—</td>
            {hasSnapshot && (
              <td className={`py-1 pr-2 pt-2 text-right whitespace-nowrap tabular-nums ${totalPnlPrice >= 0 ? theme.primary : theme.warn}`}>
                {totalPnlPrice >= 0 ? "+" : ""}${totalPnlPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
            )}
            {hasSnapshot && (
              <td className={`py-1 pr-2 pt-2 text-right whitespace-nowrap tabular-nums ${totalPnlBalance >= 0 ? theme.primary : theme.warn}`}>
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
    <div className={`relative group my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2 w-full overflow-x-auto`}>
      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        />
      )}
      <div className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}>
        <span className="font-bold">PORTFOLIO</span>
        <span className="uppercase">
          {hasSnapshot ? `SNAPSHOT: ${snapshotLabel || "untitled"} · ${snapshotTime ? new Date(snapshotTime).toLocaleString() : ""}` : "NO SNAPSHOT — run 'snapshot' to track P/L"}
        </span>
      </div>

      {fetching ? (
        <div className={`${theme.warn} py-2`}>Fetching balances across {holdings.length} chains…</div>
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
        <div className={`${theme.warn} pt-1`}>No mainnet USD prices available. Balances shown raw.</div>
      )}
    </div>
  );
}
