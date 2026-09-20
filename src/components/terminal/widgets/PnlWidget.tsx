/**
 * @file PnlWidget.tsx
 * @description Live mark-to-quote P/L vs portfolioSnapshot (#23 / Stephy chrome)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useEffect, useRef, useState } from "react";
import PinButton from "./PinButton";
import {
  PNL_FETCHING,
  PNL_FOOTER,
  PNL_FOOTER_MUTED,
  PNL_REFRESH_SEC,
  formatPnlPct,
  formatPnlUsdSigned,
  type PnlView
} from "../pnl";
import { pnlPricePct } from "../pnlMath";

export type PnlWidgetData = PnlView;

export default function PnlWidget({
  data,
  theme,
  compact = false,
  narrow = false,
  onPin,
  pinned,
  liveRefresh = false,
  onRefresh
}: {
  data: PnlWidgetData;
  theme: any;
  compact?: boolean;
  /** Drop BAL Δ: compact pin OR narrow/<768 / stack band — Stephy #23/#49. */
  narrow?: boolean;
  onPin?: () => void;
  pinned?: boolean;
  /** Self-poll marks every 5s while mounted (in-log board). */
  liveRefresh?: boolean;
  /** Called each 5s tick when liveRefresh — parent owns balance cadence. */
  onRefresh?: () => void | Promise<void>;
}) {
  const [view, setView] = useState<PnlWidgetData>(data);
  const [nextSec, setNextSec] = useState(PNL_REFRESH_SEC);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    setView(data);
  }, [data]);

  useEffect(() => {
    if (!liveRefresh || !onRefresh) return;
    let cancelled = false;
    const countdown = setInterval(() => {
      setNextSec((s) => {
        if (s <= 1) {
          void (async () => {
            try {
              await onRefreshRef.current?.();
            } catch {
              /* parent sets STALE */
            }
          })();
          return PNL_REFRESH_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(countdown);
      void cancelled;
    };
  }, [liveRefresh, onRefresh]);

  const dropBal = compact || narrow;
  const fetching = !!view.fetching;
  const stale = !!view.stale;
  const pct = pnlPricePct(view.pnlPrice, view.snapNav);

  const shell = compact
    ? `relative group my-1 p-1.5 border ${theme.border} ${theme.cardBg} ${theme.rounded} text-[10px] space-y-1`
    : `relative group my-3 p-2 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-1`;

  const deltaClass = (n: number | null) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return theme.muted;
    if (n < 0) return theme.warn;
    return theme.primary; // 0 and positive → primary
  };

  const formatNet = (n: number | null): string => {
    if (n === null || !Number.isFinite(n)) return "—";
    return `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const snapLabel = `${view.label} · ${
    view.snapshotTime ? new Date(view.snapshotTime).toLocaleString() : "—"
  }`;

  return (
    <div className={shell}>
      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        />
      )}
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
      >
        <span className={`font-bold ${theme.text} normal-case`}>
          PNL vs SNAPSHOT
          {stale && (
            <span className={`ml-2 font-normal ${theme.warn}`}>STALE</span>
          )}
        </span>
        <span className={`${theme.muted} text-[9px] normal-case`}>
          next {liveRefresh ? nextSec : PNL_REFRESH_SEC}s
        </span>
      </div>

      <div className={`flex justify-between items-center text-[9px] ${theme.muted}`}>
        <span className="normal-case truncate pr-2">{snapLabel}</span>
        <span className="shrink-0 uppercase">ESTIMATE</span>
      </div>

      {fetching ? (
        <div className={`${theme.muted} py-2`}>{PNL_FETCHING}</div>
      ) : (
        <div className={`space-y-0.5 tabular-nums ${compact ? "text-[10px]" : "text-[11px]"}`}>
          <div className="flex justify-between gap-2">
            <span className={`${theme.muted} uppercase text-[9px]`}>NET USD</span>
            <span className={`${view.netUsd === null ? theme.muted : theme.text}`}>
              {formatNet(view.netUsd)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className={`${theme.muted} uppercase text-[9px]`}>P/L (PRICE)</span>
            <span className={deltaClass(view.pnlPrice)}>
              {formatPnlUsdSigned(view.pnlPrice)}
              <span className={`ml-1 ${pct === null ? theme.muted : deltaClass(view.pnlPrice)}`}>
                ({formatPnlPct(pct)})
              </span>
            </span>
          </div>
          {!dropBal && (
            <div className="flex justify-between gap-2">
              <span className={`${theme.muted} uppercase text-[9px]`}>BAL Δ</span>
              <span className={deltaClass(view.pnlBalance)}>
                {formatPnlUsdSigned(view.pnlBalance)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className={`text-[9px] ${theme.muted} pt-1 leading-snug`}>{PNL_FOOTER}</div>
      <div className={`text-[9px] ${theme.muted} opacity-70`}>{PNL_FOOTER_MUTED}</div>
    </div>
  );
}
