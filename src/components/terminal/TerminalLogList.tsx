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
import PriceCard from "./widgets/PriceCard";
import type { LogEntry, DexProtocol } from "./types";
import { DEFAULT_MODE, type TerminalMode } from "./mode";

export default function TerminalLogList({
  logs,
  theme,
  activeChainId,
  onPin,
  pinnedIds,
  mode = DEFAULT_MODE
}: {
  logs: LogEntry[];
  theme: any;
  activeChainId: number | null;
  onPin: (log: LogEntry) => void;
  pinnedIds: Set<string>;
  mode?: TerminalMode;
}) {
  return (
    <>
      {logs.map((log) => {
        const isPinned = pinnedIds.has(log.id);
        return (
          <div key={log.id}>
            {renderLog(log, theme, activeChainId, onPin, isPinned, mode)}
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
  isPinned: boolean,
  mode: TerminalMode
) {
  if (log.type === "input") {
    return (
      <div className={`${theme.primary} font-bold ${theme.glow}`}>
        {log.text}
      </div>
    );
  }
  if (log.type === "help") {
    return <HelpManual theme={theme} mode={mode} />;
  }
  if (log.type === "dexes") {
    const dexList = DEX_REGISTRY[activeChainId!] || [];
    return (
      <div className={`text-xs space-y-1 my-2 ${theme.text}`}>
        {dexList.length === 0 ? (
          <div className={theme.warn}>
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
  // Only live monitors are pinnable (issue #35): price / balance / portfolio.
  // Networks, tx-flow widgets (createpool/initialize/addliq), chat and board
  // are not — they get no onPin so PinButton self-hides.
  if (log.type === "networks")
    return <NetworksList theme={theme} />;
  if (log.type === "createpool")
    return <CreatePoolWidget {...log.payload} theme={theme} />;
  if (log.type === "initialize")
    return <InitializePoolWidget {...log.payload} theme={theme} />;
  if (log.type === "addliq")
    return <AddLiquidityWidget {...log.payload} theme={theme} />;
  if (log.type === "balance")
    return <BalanceWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "portfolio")
    return <PortfolioWidget {...log.payload} theme={theme} onPin={() => onPin(log)} pinned={isPinned} />;
  if (log.type === "chat")
    return <ChatWidget {...log.payload} theme={theme} />;
  if (log.type === "billboard")
    return <BillboardWidget {...log.payload} theme={theme} />;

  // Plain text / component logs. Only the price widget is pinnable — bare
  // text lines (banners, tx hashes, errors) and non-live component widgets
  // (swap/pool/deploy/export) have nothing to pin (issue #35).
  return (
    <div className="relative group">
      <div className={log.warn ? theme.warn : `${theme.text}/90`}>
        {log.text}
        {log.componentData?.kind === "price" ? (
          <PriceCard data={log.componentData} theme={theme} />
        ) : (
          log.component
        )}
      </div>
      {log.componentData?.kind === "price" && !isPinned && (
        <PinButton
          onPin={() => onPin(log)}
          theme={theme}
          className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        />
      )}
    </div>
  );
}
