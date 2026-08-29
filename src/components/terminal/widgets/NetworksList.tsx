/**
 * @file NetworksList.tsx
 * @description Networks list widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { SUPPORTED_CHAINS } from "../constants";
import type { ThemeConfig } from "../types";
import PinButton from "./PinButton";

export default function NetworksList({
  theme,
  onPin,
  pinned
}: {
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
}) {
  return (
    <div
      className={`relative group my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-3`}
    >
      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
      <div
        className={`flex justify-between items-center border-b ${theme.border} pb-2`}
      >
        <span className={`font-bold ${theme.primary}`}>
          AVAILABLE NETWORKS REGISTRY
        </span>
        <span className={`${theme.text}/70`}>
          TOTAL: {SUPPORTED_CHAINS.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {SUPPORTED_CHAINS.map((chain) => {
          const isTestnet =
            chain.testnet ||
            chain.name.toLowerCase().includes("sepolia") ||
            chain.name.toLowerCase().includes("amoy") ||
            chain.name.toLowerCase().includes("test");

          return (
            <div
              key={chain.id}
              className={`p-2.5 border ${theme.border} bg-current/5 rounded flex flex-col justify-between`}
            >
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center space-x-2">
                  <span className={`font-bold ${theme.primary}`}>
                    {chain.name}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      isTestnet ? theme.warn : theme.primary
                    }`}
                  >
                    {isTestnet ? "TESTNET" : "MAINNET"}
                  </span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded bg-current/10 ${theme.text}/80`}
                >
                  ID: {chain.id}
                </span>
              </div>
              <div
                className={`text-[11px] ${theme.text}/70 flex justify-between`}
              >
                <span>
                  Native:{" "}
                  <strong className={theme.primary}>
                    {chain.nativeCurrency.symbol}
                  </strong>
                </span>
                {chain.blockExplorers?.default && (
                  <a
                    href={chain.blockExplorers.default.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:opacity-80"
                  >
                    Explorer ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`text-[10px] ${theme.text}/60 pt-1`}>
        💡 Tip: Use{" "}
        <span className={`font-bold ${theme.primary}`}>
          network &lt;name|id&gt;
        </span>{" "}
        to switch active connection.
      </div>
    </div>
  );
}
