/**
 * @file TerminalPrompt.tsx
 * @description Terminal prompt input component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import type { ThemeConfig } from "./types";
import { SUPPORTED_CHAINS, DEX_REGISTRY } from "./constants";
import { isCoarsePointer } from "./viewport";
import {
  DEFAULT_MODE,
  MODE_BOOT_HINT,
  MODE_LABEL,
  type TerminalMode
} from "./mode";

export default function TerminalPrompt({
  theme,
  input,
  setInput,
  handleKeyDown,
  inputRef,
  suggestions,
  suggestionIdx,
  onSelectSuggestion,
  activeChainId,
  activeDexId,
  isConnected,
  address,
  mounted,
  isNarrow,
  chatChannelLabel,
  mode = DEFAULT_MODE,
  onModeChipTap
}: {
  theme: ThemeConfig;
  input: string;
  setInput: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestions: string[];
  suggestionIdx: number;
  onSelectSuggestion?: (idx: number) => void;
  activeChainId: number | null;
  activeDexId: string | null;
  isConnected: boolean;
  address: string | undefined;
  mounted: boolean;
  isNarrow?: boolean;
  /** Active chat channel chip label (name or short addr), or null → CHAT: — */
  chatChannelLabel?: string | null;
  /** Purpose lens (#54) — prompt MODE chip only (Stephy option A). */
  mode?: TerminalMode;
  /** Tap MODE chip → CHOICES of three modes (no cycle-on-tap). */
  onModeChipTap?: () => void;
}) {
  const chainObj = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
  const activeDexObj = DEX_REGISTRY[activeChainId!]?.find(
    (d) => d.id === activeDexId
  );

  const modeLabel = MODE_LABEL[mode];
  const forensicChip = mode === "forensic";
  // invest/dev: border+muted like WALLET/NET/CHAT; forensic: theme.warn text+border only
  const modeChipClass = forensicChip
    ? theme.warn
    : `${theme.border} ${theme.muted}`;

  return (
    <div
      className={`mt-2 border ${theme.border} ${theme.cardBg} ${theme.rounded} p-3 flex flex-col gap-2 ${theme.glow} shadow-xl`}
    >
      {/* LINE 1: Status Bar Metadata */}
      <div className="flex flex-wrap items-center justify-between text-[11px] gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {mounted && isConnected && address ? (
            <span
              className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 ${theme.primary}`}
            >
              WALLET: {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          ) : (
            <span
              className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 ${theme.muted}`}
            >
              WALLET: DISCONNECTED
            </span>
          )}
          {chainObj ? (
            <span
              className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 ${theme.primary}`}
            >
              NET: {chainObj.name}
            </span>
          ) : (
            <span
              className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 ${theme.muted}`}
            >
              NET: —
            </span>
          )}
          <button
            type="button"
            onClick={() => onModeChipTap?.()}
            aria-label={`Mode ${modeLabel}. Tap to switch.`}
            title="Switch mode"
            className={`px-2 py-0.5 rounded border bg-current/10 inline-flex items-center justify-center pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px] [@media(hover:none)]:min-h-[44px] [@media(hover:none)]:min-w-[44px] ${modeChipClass}`}
          >
            MODE: {modeLabel}
          </button>
          {activeDexObj && (
            <span
              className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 ${theme.primary} hidden sm:inline-block`}
            >
              DEX: {activeDexObj.name}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded border ${theme.border} bg-current/10 ${theme.muted}`}
            title="Active chat channel"
          >
            CHAT:{" "}
            {chatChannelLabel && chatChannelLabel !== "—"
              ? chatChannelLabel
              : "—"}
          </span>
        </div>
      </div>

      {/* Boot copy: teaching lives on the prompt, not in the log (#4). Mode-aware (#54). */}
      <div className="text-[10px] leading-tight">
        <div className={theme.text}>0xTERM v1.5.0</div>
        <div className={theme.muted}>{MODE_BOOT_HINT[mode]}</div>
      </div>

      {/* LINE 2: Interactive Input Field */}
      <div className="flex items-center gap-2 relative">
        <span className={`font-bold ${theme.primary} tracking-widest`}>
          {theme.promptSymbol === "■" ? (
            <span className="inline-block text-[8px] leading-none">■</span>
          ) : (
            theme.promptSymbol
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder=""
          // 16px below 768 avoids iOS zoom-on-focus (issue #49).
          className={`flex-1 bg-transparent outline-none ${isNarrow ? "text-base" : "text-xs"} ${theme.text} [caret-color:var(--phosphor)] [caret-shape:block]`}
          autoFocus={!isCoarsePointer()}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* LINE 3: Inline Suggestion Choices */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs pb-0.5">
          <span className="text-[9px] opacity-40 shrink-0">
            CHOICES [← →]:
          </span>
          {suggestions.map((s, idx) => (
            <button
              key={s}
              type="button"
              onClick={() => onSelectSuggestion?.(idx)}
              className={`px-2 py-0.5 rounded border whitespace-nowrap shrink-0 transition-colors max-md:min-h-[44px] max-md:flex max-md:items-center ${
                idx === suggestionIdx
                  ? `${theme.primary} bg-current/15 border-current font-bold`
                  : `${theme.border} ${theme.text} opacity-60`
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
