/**
 * @file PinnedPanel.tsx
 * @description Right-hand (md+) / above-prompt (<md) column of pinned widgets
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import BalanceWidget from "./widgets/BalanceWidget";
import PortfolioWidget from "./widgets/PortfolioWidget";
import PriceCard from "./widgets/PriceCard";
import DigArtifactWidget from "./widgets/DigArtifactWidget";
import DigRunWidget from "./widgets/DigRunWidget";
import DigDebugWidget from "./widgets/DigDebugWidget";
import type { PinnedManifest, ThemeConfig } from "./types";

const REFRESH_INTERVAL = 60;

export default function PinnedPanel({
  pinned,
  theme,
  refreshing,
  countdowns,
  onRefresh,
  onMinimize,
  onUnpin,
  stacked
}: {
  pinned: PinnedManifest[];
  theme: ThemeConfig;
  refreshing?: string | null;
  countdowns?: Record<string, number>;
  onRefresh: (id: string) => void;
  onMinimize: (id: string) => void;
  onUnpin: (id: string) => void;
  stacked?: boolean;
}) {
  if (pinned.length === 0) return null;

  return (
    <div
      className={
        stacked
          ? "w-full max-h-[30vh] min-h-0 overflow-y-auto space-y-2"
          : "w-full h-full min-h-0 overflow-y-auto space-y-2"
      }
    >
      {pinned.map((p) => {
        const hasRefresh = countdowns && countdowns[p.id] !== undefined;
        const secs =
          countdowns && countdowns[p.id] !== undefined
            ? countdowns[p.id]
            : REFRESH_INTERVAL;
        const isRefreshing = refreshing === p.id;
        const minimized = !!p.minimized;
        return (
          <div
            key={p.id}
            className={`border ${theme.border} ${theme.cardBg} ${theme.rounded} p-1.5 text-[10px] ${theme.text}`}
          >
            <div
              className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-0.5 ${minimized ? "" : "mb-1"}`}
            >
              <span className="font-bold flex items-center gap-1.5">
                <span>{p.title}</span>
                {!minimized && hasRefresh && (
                  <button
                    type="button"
                    onClick={() => onRefresh(p.id)}
                    title="Refresh now (resets countdown)"
                    disabled={isRefreshing}
                    className={`uppercase text-[10px] cursor-pointer ${theme.primary} ${isRefreshing ? "opacity-40 cursor-default" : ""}`}
                  >
                    {isRefreshing ? "…" : "↻"}
                  </button>
                )}
                {!minimized && hasRefresh && (
                  <span
                    className={`uppercase text-[9px] ${isRefreshing ? "opacity-70" : "opacity-50"}`}
                  >
                    {isRefreshing ? "refresh…" : `next ${secs}s`}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onMinimize(p.id)}
                  title={minimized ? "Expand" : "Minimize"}
                  className={`uppercase text-[10px] cursor-pointer ${theme.primary}`}
                >
                  {minimized ? "+" : "-"}
                </button>
                <button
                  type="button"
                  onClick={() => onUnpin(p.id)}
                  title="Unpin"
                  className={`uppercase text-[10px] cursor-pointer ${theme.primary}`}
                >
                  ✕
                </button>
              </span>
            </div>
            {!minimized && renderPinned(p, theme)}
          </div>
        );
      })}
    </div>
  );
}

function renderPinned(p: PinnedManifest, theme: any) {
  if (p.kind === "component") {
    // Re-render from stored data when available so the pinned widget follows
    // theme switches; fall back to the original element otherwise.
    if (p.componentData?.kind === "price")
      return <PriceCard data={p.componentData} theme={theme} compact />;
    return p.component || <div className={`${theme.text}/50`}>widget unavailable</div>;
  }
  const payload = p.payload || {};
  switch (p.kind) {
    // Only live monitors are pinnable (issue #35): price (above), balance,
    // portfolio. Non-live kinds are dropped on load/import and never render.
    case "balance":
      return <BalanceWidget {...payload} theme={theme} />;
    case "portfolio":
      return <PortfolioWidget {...payload} theme={theme} />;
    case "dig-artifact":
      return payload.artifact ? (
        <DigArtifactWidget artifact={payload.artifact} theme={theme} compact pinned />
      ) : (
        <div className={`${theme.text}/50`}>artifact unavailable</div>
      );
    case "dig-run":
      return payload.panel ? (
        <DigRunWidget panel={payload.panel} theme={theme} compact pinned />
      ) : (
        <div className={`${theme.text}/50`}>run unavailable</div>
      );
    case "dig-debug":
      return payload.panel ? (
        <DigDebugWidget panel={payload.panel} theme={theme} compact pinned />
      ) : (
        <div className={`${theme.text}/50`}>debug unavailable</div>
      );
    default:
      return <div className={`${theme.text}/90 whitespace-pre-wrap`}>{payload.text}</div>;
  }
}
