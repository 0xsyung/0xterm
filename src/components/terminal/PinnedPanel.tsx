/**
 * @file PinnedPanel.tsx
 * @description Floating right-hand column of pinned widgets
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import HelpManual from "./widgets/HelpManual";
import NetworksList from "./widgets/NetworksList";
import CreatePoolWidget from "./widgets/CreatePoolWidget";
import InitializePoolWidget from "./widgets/InitializePoolWidget";
import AddLiquidityWidget from "./widgets/AddLiquidityWidget";
import BalanceWidget from "./widgets/BalanceWidget";
import PortfolioWidget from "./widgets/PortfolioWidget";
import ChatWidget from "./widgets/ChatWidget";
import BillboardWidget from "./widgets/BillboardWidget";
import PriceCard from "./widgets/PriceCard";
import type { PinnedManifest, ThemeConfig } from "./types";
import { HEADER_TOP } from "./constants";

const REFRESH_INTERVAL = 60;

export default function PinnedPanel({
  pinned,
  theme,
  refreshing,
  countdowns,
  onRefresh,
  onMinimize,
  onUnpin
}: {
  pinned: PinnedManifest[];
  theme: ThemeConfig;
  refreshing?: string | null;
  countdowns?: Record<string, number>;
  onRefresh: (id: string) => void;
  onMinimize: (id: string) => void;
  onUnpin: (id: string) => void;
}) {
  if (pinned.length === 0) return null;

  return (
    <div className={`absolute ${HEADER_TOP[theme.headerStyle]} right-2 bottom-14 w-72 overflow-y-auto z-30 space-y-2 pointer-events-none`}>
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
            className={`pointer-events-auto border ${theme.border} ${theme.cardBg} ${theme.rounded} p-1.5 text-[10px] ${theme.text} backdrop-blur-md bg-black/40`}
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
    case "help":
      return <HelpManual theme={theme} />;
    case "networks":
      return <NetworksList theme={theme} />;
    case "createpool":
      return <CreatePoolWidget {...payload} theme={theme} />;
    case "initialize":
      return <InitializePoolWidget {...payload} theme={theme} />;
    case "addliq":
      return <AddLiquidityWidget {...payload} theme={theme} />;
    case "balance":
      return <BalanceWidget {...payload} theme={theme} />;
    case "portfolio":
      return <PortfolioWidget {...payload} theme={theme} />;
    case "chat":
      return <ChatWidget {...payload} theme={theme} />;
    case "billboard":
      return (
        <BillboardWidget
          posts={payload.posts || []}
          total={payload.total || 0}
          pageSize={payload.pageSize || 5}
          theme={theme}
        />
      );
    default:
      return <div className={`${theme.text}/90 whitespace-pre-wrap`}>{payload.text}</div>;
  }
}
