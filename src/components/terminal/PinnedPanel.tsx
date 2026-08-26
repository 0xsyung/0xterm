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
import type { PinnedManifest } from "./types";

export default function PinnedPanel({
  pinned,
  theme,
  refreshing,
  onUnpin
}: {
  pinned: PinnedManifest[];
  theme: any;
  refreshing?: string | null;
  onUnpin: (id: string) => void;
}) {
  if (pinned.length === 0) return null;

  return (
    <div className="absolute top-14 right-2 bottom-14 w-80 overflow-y-auto z-30 space-y-3 pointer-events-none">
      {pinned.map((p) => (
        <div
          key={p.id}
          className={`pointer-events-auto border ${theme.border} ${theme.cardBg} ${theme.rounded} p-2 text-xs ${theme.text}`}
        >
          <div
            className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1 mb-2`}
          >
            <span className="font-bold flex items-center gap-1.5">
              <span>{p.title}</span>
              {p.payload && (
                <span
                  className={`uppercase text-[9px] ${refreshing === p.id ? "opacity-70" : "opacity-50"}`}
                >
                  {refreshing === p.id ? "live…" : "live · 60s"}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onUnpin(p.id)}
              title="Unpin"
              className={`uppercase text-[10px] underline cursor-pointer ${theme.primary}`}
            >
              unpin ✕
            </button>
          </div>
          {renderPinned(p, theme)}
        </div>
      ))}
    </div>
  );
}

function renderPinned(p: PinnedManifest, theme: any) {
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
