import React from "react";
import { SUPPORTED_CHAINS, DEX_REGISTRY } from "./constants";

interface TerminalPromptProps {
  theme: any;
  input: string;
  setInput: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestions: string[];
  suggestionIdx: number;
  activeChainId: number | null;
  activeDexId: string | null;
  isConnected: boolean;
  address?: string;
  mounted: boolean;
}

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
}: TerminalPromptProps) {
  const activeChainObj = SUPPORTED_CHAINS.find((c) => c.id === activeChainId);
  const activeDexObj = activeChainId
    ? DEX_REGISTRY[activeChainId]?.find((d) => d.id === activeDexId)
    : null;

  return (
    <div
      className={`mt-4 border-t ${theme.border} pt-3 shrink-0 flex flex-col space-y-1.5`}
    >
      {/* Line 1: Status Bar */}
      {mounted && (
        <div
          className={`text-[11px] ${theme.text}/70 flex items-center space-x-2 px-1`}
        >
          <span className={`font-bold ${theme.primary}`}>
            [{activeChainObj ? activeChainObj.name.toUpperCase() : "NO NET"} |{" "}
            {activeDexObj ? activeDexObj.id.toUpperCase() : "NO DEX"} |{" "}
            {isConnected && address
              ? `${address.slice(0, 6)}...${address.slice(-4)}`
              : "DISCONNECTED"}
            ]
          </span>
        </div>
      )}

      {/* Line 2: Input */}
      <div className="flex items-center">
        <span
          className={`mr-2 font-bold ${theme.glow} shrink-0 whitespace-nowrap ${theme.primary}`}
        >
          &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`w-full bg-transparent outline-none ${theme.text} caret-current ${theme.glow}`}
          autoFocus
          spellCheck={false}
        />
      </div>

      {/* Line 3: Autocomplete */}
      {suggestions.length > 0 && (
        <div
          className={`flex flex-wrap gap-3 px-4 pb-1 text-[11px] ${theme.text}/80`}
        >
          {suggestions.map((s, idx) => (
            <span
              key={s}
              className={`transition-colors ${
                idx === suggestionIdx
                  ? `bg-current/20 font-bold ${theme.primary} px-2 py-0.5 rounded`
                  : "px-2 py-0.5"
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
