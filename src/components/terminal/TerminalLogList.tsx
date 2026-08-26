/**
 * @file TerminalLogList.tsx
 * @description Terminal log list component
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
import { DEX_REGISTRY } from "./constants";
import PinButton from "./widgets/PinButton";
import type { LogEntry, DexProtocol } from "./types";

export default function TerminalLogList({
  logs,
  theme,
  activeChainId,
  onPin,
  pinnedIds
}: {
  logs: LogEntry[];
  theme: any;
  activeChainId: number | null;
  onPin: (log: LogEntry) => void;
  pinnedIds: Set<string>;
}) {
  return (
    <>
      {logs.map((log) => {
        const isPinned = pinnedIds.has(log.id);
        return (
          <div key={log.id}>
            {renderLog(log, theme, activeChainId, onPin, isPinned)}
          </div>
        );
      })}
    </>
  );
}

function renderLog(
  log: LogEntry,
  theme: any,
  activeChainId: number | null,
  onPin: (log: LogEntry) => void,
  isPinned: boolean
) {
  if (log.type === "input") {
    return (
      <div className={`${theme.primary} font-bold ${theme.glow}`}>
        {log.text}
      </div>
    );
  }
  if (log.type === "help") {
    return <HelpManual theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  }
  if (log.type === "dexes") {
    const dexList = DEX_REGISTRY[activeChainId!] || [];
    return (
      <div className={`text-xs space-y-1 my-2 ${theme.text}`}>
        {dexList.length === 0 ? (
          <div className="text-yellow-400">
            No DEX available on this chain. swap / createpool / price pool
            require a DEX.
          </div>
        ) : (
          dexList.map((d: DexProtocol) => (
            <div key={d.id}>
              • {d.name} ({d.type}) - ID:{" "}
              <span className={`font-bold ${theme.primary}`}>{d.id}</span>
            </div>
          ))
        )}
      </div>
    );
  }
  if (log.type === "networks")
    return <NetworksList theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "createpool")
    return <CreatePoolWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "initialize")
    return <InitializePoolWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "addliq")
    return <AddLiquidityWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "balance")
    return <BalanceWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "portfolio")
    return <PortfolioWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "chat")
    return <ChatWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "billboard")
    return <BillboardWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;

  // Plain text / component logs. Only real widgets (log.component, e.g. the
  // price widget) get a pin — bare text lines (banners, tx hashes, errors)
  // have nothing to pin.
  return (
    <div className="relative group">
      <div className={`${theme.text}/90`}>
        {log.text}
        {log.component}
      </div>
      {log.component && !isPinned && (
        <PinButton
          onPin={() => onPin(log)}
          theme={theme}
          className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
    </div>
  );
}
