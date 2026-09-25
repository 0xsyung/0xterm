/**
 * @file PortfolioWidget.tsx
 * @description Wallet portfolio table across supported chains (sections, groups, watch addresses #22)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import PinButton from "./PinButton";
import { computePnl, snapKeyForHolding } from "../pnlMath";
import { shortAddr } from "../portfolioPrefs";

export type PortfolioHolding = {
  chainName: string;
  chainId: number;
  symbol: string;
  type: "native" | "erc20" | "vault" | "poly";
  // address present for erc20; used to key snapshot P/L uniquely so
  // duplicate symbols on one chain don't collide.
  address?: string;
  balance: string;
  priceUsd: number | null;
  valueUsd: number | null;
  change24h: number | null;
  priceSource: string;
  isTestnet: boolean;
  /** "self" for the connected wallet; watch addresses tagged by checksummed address (#22). */
  account?: "self" | string;
};

export type SnapshotHolding = {
  price: number | null;
  balance: string;
};

export type PortfolioGroup = { name: string; keys: string[] };

const isSelf = (h: PortfolioHolding): boolean =>
  h.account === undefined || h.account === "self";

export default function PortfolioWidget({
  holdings,
  snapshot,
  snapshotLabel,
  snapshotTime,
  theme,
  fetching,
  onPin,
  pinned,
  groups,
  hiddenCount,
  compact
}: {
  holdings: PortfolioHolding[];
  snapshot?: Record<string, SnapshotHolding>;
  snapshotLabel?: string;
  snapshotTime?: number;
  theme: any;
  fetching?: boolean;
  onPin?: () => void;
  pinned?: boolean;
  groups?: PortfolioGroup[];
  hiddenCount?: number;
  compact?: boolean;
}) {
  const hasSnapshot = !!snapshot && Object.keys(snapshot).length > 0;
  const allMainnet = holdings.filter((h) => !h.isTestnet);
  const selfMainnet = allMainnet.filter(isSelf);
  const watchMainnet = allMainnet.filter((h) => !isSelf(h));
  const testnetHoldings = holdings.filter((h) => h.isTestnet);

  // Watch addresses (checksummed, in the order seen) that have mainnet rows.
  const watchAccounts = [
    ...new Set(watchMainnet.map((h) => h.account as string))
  ];

  const pricedCount = allMainnet.filter((h) => h.valueUsd !== null).length;

  const showBalance = !compact;
  const showChange = !compact;
  const showPriceSrc = !compact;
  const showBalDelta = !compact;

  type TableRow = { kind: "holding"; h: PortfolioHolding } | { kind: "group"; name: string };

  const rowKey = (h: PortfolioHolding): string =>
    `${h.chainId}:${h.type === "erc20" && h.address ? h.address.toLowerCase() : h.symbol}`;

  const tableRows = (rows: PortfolioHolding[], grps?: PortfolioGroup[]): TableRow[] => {
    if (!grps || grps.length === 0)
      return rows.map((h): TableRow => ({ kind: "holding", h }));
    const out: TableRow[] = [];
    for (const g of grps) {
      const member = rows.filter((h) => g.keys.includes(h.symbol.toUpperCase()));
      if (member.length === 0) continue;
      out.push({ kind: "group", name: g.name });
      out.push(...member.map((h): TableRow => ({ kind: "holding", h })));
    }
    const groupedSet = new Set(
      grps.flatMap((g) => rows.filter((h) => g.keys.includes(h.symbol.toUpperCase())).map(rowKey))
    );
    const other = rows.filter((h) => !groupedSet.has(rowKey(h)));
    if (other.length > 0) {
      out.push({ kind: "group", name: "OTHER" });
      out.push(...other.map((h): TableRow => ({ kind: "holding", h })));
    }
    return out;
  };

  const colCount = (pnl: boolean) => {
    let n = 4; // CHAIN, TOKEN, USD, Δ24H
    if (showBalance) n += 1;
    if (showPriceSrc) n += 1;
    if (pnl && hasSnapshot) n += 1;
    if (pnl && hasSnapshot && showBalDelta) n += 1;
    return n;
  };

  const renderTable = (rows: PortfolioHolding[], pnl: boolean, grps?: PortfolioGroup[]) => {
    const sectionNet = rows.reduce<number>((acc, h) => {
      if (h.valueUsd !== null && Number.isFinite(h.valueUsd)) return acc + h.valueUsd;
      return acc;
    }, 0);
    const sectionPnl = computePnl(rows, hasSnapshot ? snapshot : null);
    const sectionPnlPrice = sectionPnl.pnlPrice ?? 0;
    const sectionPnlBalance = sectionPnl.pnlBalance ?? 0;
    return (
      <table className={`w-full text-left ${theme.text}`}>
        <thead>
          <tr className={`text-[10px] ${theme.text}/50 border-b ${theme.border}`}>
            <th className="py-1 pr-2">CHAIN</th>
            <th className="py-1 pr-2">TOKEN</th>
            {showBalance && <th className="py-1 pr-2 text-right">BALANCE</th>}
            <th className="py-1 pr-2 text-right">USD VALUE</th>
            {showChange && <th className="py-1 pr-2 text-right">Δ24H</th>}
            {pnl && hasSnapshot && (
              <th className="py-1 pr-2 text-right">P/L (PRICE)</th>
            )}
            {pnl && hasSnapshot && showBalDelta && (
              <th className="py-1 pr-2 text-right">BAL Δ</th>
            )}
            {showPriceSrc && <th className="py-1 pr-2">PRICE SRC</th>}
          </tr>
        </thead>
        <tbody>
          {tableRows(rows, grps).map((r, idx) => {
            if (r.kind === "group") {
              return (
                <tr key={`g-${idx}`} className={theme.primary}>
                  <td colSpan={colCount(pnl)} className={`py-1 pr-2 pt-2 border-b ${theme.border}`}>
                    <span className="font-bold uppercase tracking-wider">{r.name}</span>
                  </td>
                </tr>
              );
            }
            const h = r.h;
            const snap = snapshot?.[snapKeyForHolding(h)];
            let pnlPrice: number | null = null;
            let pnlBalance: number | null = null;
            if (snap && hasSnapshot && isSelf(h)) {
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
                {showBalance && (
                  <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">{h.balance}</td>
                )}
                <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">
                  {h.valueUsd !== null ? `$${h.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                </td>
                {showChange && (
                  <td className={`py-1 pr-2 text-right whitespace-nowrap tabular-nums ${h.change24h === null ? "" : h.change24h >= 0 ? theme.primary : theme.warn}`}>
                    {h.change24h !== null ? `${h.change24h > 0 ? "+" : ""}${h.change24h}%` : "—"}
                  </td>
                )}
                {pnl && hasSnapshot && (
                  <td className={`py-1 pr-2 text-right whitespace-nowrap tabular-nums ${pnlPrice === null ? "" : pnlPrice >= 0 ? theme.primary : theme.warn}`}>
                    {pnlPrice !== null ? `${pnlPrice >= 0 ? "+" : ""}$${pnlPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                  </td>
                )}
                {pnl && hasSnapshot && showBalDelta && (
                  <td className={`py-1 pr-2 text-right whitespace-nowrap tabular-nums ${pnlBalance === null ? "" : pnlBalance >= 0 ? theme.primary : theme.warn}`}>
                    {pnlBalance !== null ? `${pnlBalance >= 0 ? "+" : ""}$${pnlBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                  </td>
                )}
                {showPriceSrc && (
                  <td className="py-1 pr-2 whitespace-nowrap">{h.priceSource}</td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className={`font-bold ${theme.primary}`}>
            <td className="py-1 pr-2 pt-2" colSpan={2}>TOTAL</td>
            {showBalance && <td className="py-1 pr-2 pt-2 text-right">—</td>}
            <td className="py-1 pr-2 pt-2 text-right whitespace-nowrap tabular-nums">${sectionNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            {showChange && <td className="py-1 pr-2 pt-2 text-right">—</td>}
            {pnl && hasSnapshot && (
              <td className={`py-1 pr-2 pt-2 text-right whitespace-nowrap tabular-nums ${sectionPnlPrice >= 0 ? theme.primary : theme.warn}`}>
                {sectionPnlPrice >= 0 ? "+" : ""}${sectionPnlPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
            )}
            {pnl && hasSnapshot && showBalDelta && (
              <td className={`py-1 pr-2 pt-2 text-right whitespace-nowrap tabular-nums ${sectionPnlBalance >= 0 ? theme.primary : theme.warn}`}>
                {sectionPnlBalance >= 0 ? "+" : ""}${sectionPnlBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
            )}
            {showPriceSrc && <td className="py-1 pr-2 pt-2"></td>}
          </tr>
        </tfoot>
      </table>
    );
  };

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
          {selfMainnet.length > 0 && (
            <div>
              <div className={`font-bold ${theme.primary} text-[10px] mb-1`}>SELF</div>
              {renderTable(selfMainnet, true, groups)}
            </div>
          )}
          {watchAccounts.map((addr) => {
            const rows = watchMainnet.filter((h) => h.account === addr);
            if (rows.length === 0) return null;
            return (
              <div key={addr}>
                <div className={`font-bold ${theme.muted} text-[10px] mb-1`}>
                  WATCH {shortAddr(addr)}
                </div>
                {renderTable(rows, false)}
              </div>
            );
          })}
          {testnetHoldings.length > 0 && (
            <div>
              <div className={`font-bold ${theme.muted} text-[10px] mb-1`}>
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
              P/L (PRICE) = (now − snapshot price) × current balance · BAL Δ = (now value − snapshot value at snap time). P/L applies to self mainnet only.
            </div>
          )}
        </div>
      )}
      {hiddenCount !== undefined && hiddenCount > 0 && (
        <div className={`${theme.muted} pt-1`}>
          {hiddenCount} hidden — `pf ls` to review
        </div>
      )}
      {!fetching && pricedCount === 0 && (
        <div className={`${theme.warn} pt-1`}>No mainnet USD prices available. Balances shown raw.</div>
      )}
      <div className={`text-[10px] ${theme.text}/60 pt-1`}>
        USD estimates (DexScreener / on-chain pool). Not an executable quote.
      </div>
    </div>
  );
}
