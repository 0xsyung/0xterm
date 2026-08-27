/**
 * @file TerminalPrompt.tsx
 * @description Terminal prompt input component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import type { ThemeConfig } from "./types";
import { SUPPORTED_CHAINS, DEX_REGISTRY } from "./constants";

export default function TerminalPrompt({
  theme,
  input,
  setInput,
  handleKeyDown,
  inputRef,
  suggestions,
  suggestionIdx,
  activeChainId,
  activeDexId,
  isConnected,
  address,
  mounted
}: {
  theme: ThemeConfig;
  input: string;
  setInput: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestions: string[];
  suggestionIdx: number;
  activeChainId: number | null;
  activeDexId: string | null;
  isConnected: boolean;
  address: string | undefined;
  mounted: boolean;
}) {
  const chainObj = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
  const activeDexObj = DEX_REGISTRY[activeChainId!]?.find(
    (d) => d.id === activeDexId
  );

  return (
    <div
      className={`mt-2 border ${theme.border} ${theme.cardBg} ${theme.rounded} p-3 flex flex-col gap-2 ${theme.glow} shadow-xl`}
    >
      {/* LINE 1: Status Bar Metadata */}
      <div className="flex flex-wrap items-center justify-between text-[11px] gap-2">
        <div className="flex items-center gap-2">
          {mounted && isConnected && address ? (
            <span
              className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 font-mono ${theme.primary}`}
            >
              WALLET: {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 font-mono">
              WALLET: DISCONNECTED (Type `connect`)
            </span>
          )}
          {chainObj ? (
            <span
              className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 font-mono ${theme.primary}`}
            >
              NET: {chainObj.name}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded border border-orange-500/50 bg-orange-500/10 text-orange-400 font-mono">
              NET: NOT SELECTED (Type `networks`)
            </span>
          )}
          {activeDexObj && (
            <span
              className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 font-mono ${theme.primary} hidden sm:inline-block`}
            >
              DEX: {activeDexObj.name}
            </span>
          )}
        </div>
      </div>

      {/* LINE 2: Interactive Input Field */}
      <div className="flex items-center gap-2 relative">
        <span className={`font-bold ${theme.primary} tracking-widest`}>$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Type "help" to view available commands...'
          className={`flex-1 bg-transparent outline-none font-mono text-xs ${theme.text} placeholder:opacity-40 placeholder:${theme.text}`}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* LINE 3: Inline Suggestion Choices */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs pb-0.5">
          <span className="text-[9px] opacity-40 font-mono shrink-0">
            CHOICES [← →]:
          </span>
          {suggestions.map((s, idx) => (
            <span
              key={s}
              className={`px-2 py-0.5 rounded border font-mono whitespace-nowrap shrink-0 transition-colors ${
                idx === suggestionIdx
                  ? `${theme.primary} bg-current/15 border-current font-bold`
                  : `${theme.border} ${theme.text} opacity-60`
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
