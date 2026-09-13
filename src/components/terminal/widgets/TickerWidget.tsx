/**
 * @file TickerWidget.tsx
 * @description DexScreener ticker watchlist board (#15 / Stephy chrome lock)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useEffect, useRef, useState } from "react";
import PinButton from "./PinButton";
import {
  TICKER_FOOTER,
  TICKER_REFRESH_SEC,
  type TickerRow
} from "../ticker";
import {
  formatChange24h,
  formatCompactVol,
  formatUsdMark,
  quoteDexScreenerPairs
} from "../dexscreener";

export type TickerWidgetData = {
  kind: "ticker";
  widgetId: "ticker:watchlist";
  rows: TickerRow[];
  stale?: boolean;
  symbols?: string[];
};

export default function TickerWidget({
  data,
  theme,
  compact = false,
  narrow = false,
  onPin,
  pinned,
  liveRefresh = false,
  onRowsUpdate
}: {
  data: TickerWidgetData;
  theme: any;
  compact?: boolean;
  /** Drop VOL: width<768 OR layout band stack (short landscape) — Stephy #15/#49. */
  narrow?: boolean;
  onPin?: () => void;
  pinned?: boolean;
  /** Self-poll /pairs/ every 15s while mounted (in-log board). */
  liveRefresh?: boolean;
  onRowsUpdate?: (rows: TickerRow[], stale: boolean) => void;
}) {
  const [rows, setRows] = useState<TickerRow[]>(data.rows || []);
  const [stale, setStale] = useState(!!data.stale);
  const [nextSec, setNextSec] = useState(TICKER_REFRESH_SEC);

  useEffect(() => {
    setRows(data.rows || []);
    setStale(!!data.stale);
  }, [data.rows, data.stale]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    if (!liveRefresh) return;
    let cancelled = false;
    const tick = async () => {
      const current = rowsRef.current;
      try {
        const byChain = new Map<string, string[]>();
        for (const r of current) {
          if (!r.pairAddress || !r.dsChain) continue;
          const list = byChain.get(r.dsChain) || [];
          list.push(r.pairAddress);
          byChain.set(r.dsChain, list);
        }
        const quoted = new Map<
          string,
          { priceUsd: number | null; change24h: number | null; volume24h: number | null }
        >();
        let anyFail = false;
        for (const [chain, addrs] of byChain) {
          try {
            const map = await quoteDexScreenerPairs(chain, addrs);
            for (const [addr, q] of map) {
              quoted.set(`${chain}:${addr.toLowerCase()}`, {
                priceUsd: q.priceUsd,
                change24h: q.change24h,
                volume24h: q.volume24h
              });
            }
          } catch {
            anyFail = true;
          }
        }
        if (cancelled) return;
        const next = current.map((r) => {
          if (!r.pairAddress || !r.dsChain) return r;
          const q = quoted.get(`${r.dsChain}:${r.pairAddress.toLowerCase()}`);
          if (!q) return r;
          return {
            ...r,
            priceUsd: q.priceUsd,
            change24h: q.change24h,
            volume24h: q.volume24h,
            updatedAt: Date.now()
          };
        });
        setRows(next);
        setStale(anyFail);
        onRowsUpdate?.(next, anyFail);
      } catch {
        if (!cancelled) setStale(true);
      }
      if (!cancelled) setNextSec(TICKER_REFRESH_SEC);
    };

    const countdown = setInterval(() => {
      setNextSec((s) => {
        if (s <= 1) {
          void tick();
          return TICKER_REFRESH_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(countdown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRefresh]);

  const dropVol = compact || narrow;
  const shell = compact
    ? `relative group my-1 p-1.5 border ${theme.border} ${theme.cardBg} ${theme.rounded} text-[10px] space-y-1`
    : `relative group my-3 p-2 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-1`;

  const changeClass = (n: number | null) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return theme.muted;
    if (n > 0) return theme.primary;
    if (n < 0) return theme.warn;
    return theme.muted;
  };

  const colTemplate = dropVol
    ? "grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]"
    : "grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]";

  return (
    <div className={shell}>
      <PinButton
        onPin={onPin}
        theme={theme}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
      />
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
      >
        <span className={`font-bold ${theme.text} normal-case`}>
          TICKER
          {stale && (
            <span className={`ml-2 font-normal ${theme.warn}`}>STALE</span>
          )}
          {pinned && (
            <span className={`ml-2 text-[9px] ${theme.muted}`}>pinned</span>
          )}
        </span>
        <span className={`${theme.muted} text-[9px] normal-case`}>
          next {liveRefresh ? nextSec : TICKER_REFRESH_SEC}s
        </span>
      </div>

      <div className={`grid ${colTemplate} gap-1 ${theme.muted} text-[9px] uppercase`}>
        <div>SYM</div>
        <div className="text-right">USD</div>
        <div className="text-right">24H</div>
        {!dropVol && <div className="text-right">VOL 24H</div>}
      </div>

      {rows.map((r) => {
        const unresolved = !r.pairAddress;
        const symClass = unresolved
          ? `${theme.warn} normal-case`
          : `${theme.text} normal-case`;
        return (
          <div
            key={r.symbol}
            className={`grid ${colTemplate} gap-1 tabular-nums ${compact ? "text-[10px]" : "text-[11px]"}`}
          >
            <div className={`font-bold truncate ${symClass}`}>{r.symbol}</div>
            <div className={`text-right ${unresolved ? theme.muted : theme.text}`}>
              {unresolved ? "—" : formatUsdMark(r.priceUsd)}
            </div>
            <div className={`text-right ${unresolved ? theme.muted : changeClass(r.change24h)}`}>
              {unresolved ? "—" : formatChange24h(r.change24h)}
            </div>
            {!dropVol && (
              <div className={`text-right ${unresolved ? theme.muted : theme.text}`}>
                {unresolved ? "—" : formatCompactVol(r.volume24h)}
              </div>
            )}
          </div>
        );
      })}

      <div
        className={`text-[9px] ${theme.muted} pt-1 border-t ${theme.border} normal-case leading-snug`}
      >
        {TICKER_FOOTER}
      </div>
    </div>
  );
}
