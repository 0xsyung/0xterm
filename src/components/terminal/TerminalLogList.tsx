import React from "react";
import HelpManual from "./widgets/HelpManual";
import NetworksList from "./widgets/NetworksList";
import CreatePoolWidget from "./widgets/CreatePoolWidget";
import InitializePoolWidget from "./widgets/InitializePoolWidget";
import AddLiquidityWidget from "./widgets/AddLiquidityWidget";
import BalanceWidget from "./widgets/BalanceWidget";
import { DEX_REGISTRY } from "./constants";
import type { LogEntry, DexProtocol } from "./types";

export default function TerminalLogList({
  logs,
  theme,
  activeChainId
}: {
  logs: LogEntry[];
  theme: any;
  activeChainId: number | null;
}) {
  return (
    <>
      {logs.map((log) => {
        if (log.type === "input") {
          return (
            <div
              key={log.id}
              className={`${theme.primary} font-bold ${theme.glow}`}
            >
              {log.text}
            </div>
          );
        }
        if (log.type === "help") {
          return <HelpManual key={log.id} theme={theme} />;
        }
        if (log.type === "dexes") {
          const dexList = DEX_REGISTRY[activeChainId!] || [];
          return (
            <div
              key={log.id}
              className={`text-xs space-y-1 my-2 ${theme.text}`}
            >
              {dexList.map((d: DexProtocol) => (
                <div key={d.id}>
                  • {d.name} ({d.type}) - ID:{" "}
                  <span className={`font-bold ${theme.primary}`}>{d.id}</span>
                </div>
              ))}
            </div>
          );
        }
        if (log.type === "networks")
          return <NetworksList key={log.id} theme={theme} />;
        if (log.type === "createpool")
          return (
            <CreatePoolWidget key={log.id} {...log.payload} theme={theme} />
          );
        if (log.type === "initialize")
          return (
            <InitializePoolWidget key={log.id} {...log.payload} theme={theme} />
          );
        if (log.type === "addliq")
          return (
            <AddLiquidityWidget key={log.id} {...log.payload} theme={theme} />
          );
        if (log.type === "balance")
          return <BalanceWidget key={log.id} {...log.payload} theme={theme} />;

        return (
          <div key={log.id} className={`${theme.text}/90`}>
            {log.text}
            {log.component}
          </div>
        );
      })}
    </>
  );
}
