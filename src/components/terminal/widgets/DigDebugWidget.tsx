/**
 * @file DigDebugWidget.tsx
 * @description Dig debug card — pinnable dig-debug (#41 Stephy chrome lock)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useCallback, useRef } from "react";
import type { ThemeConfig } from "../types";
import type { DigDebugPanelState } from "../dig/debug";
import { digDebugPinTitle } from "../dig/debug";
import PinButton from "./PinButton";

export { digDebugPinTitle };

const HIT =
  "pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px] max-md:min-w-[44px] [@media(hover:none)]:min-h-[44px] [@media(hover:none)]:min-w-[44px]";

export default function DigDebugWidget({
  panel,
  theme,
  onPin,
  pinned,
  compact,
  onCommand
}: {
  panel: DigDebugPanelState;
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
  compact?: boolean;
  /** Run dig step / back / over / debug stop — read-only, never sends a tx. */
  onCommand?: (cmd: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!onCommand) return;
      const k = e.key;
      if (k === "j" || k === "n" || k === "J" || k === "N") {
        e.preventDefault();
        e.stopPropagation();
        onCommand("dig step");
        return;
      }
      if (k === "k" || k === "K") {
        e.preventDefault();
        e.stopPropagation();
        onCommand("dig back");
        return;
      }
      if (k === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onCommand("dig over");
        return;
      }
      if (k === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        rootRef.current?.blur();
      }
    },
    [onCommand]
  );

  if (compact) {
    return (
      <div className={`text-[10px] font-bold ${theme.primary} tabular-nums`}>
        {digDebugPinTitle(panel)}
      </div>
    );
  }

  const statusWarn = panel.status === "REVERT";

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`relative group my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-xl ${theme.text} outline-none focus:ring-1 focus:ring-current`}
      style={{ ["--tw-ring-color" as string]: "currentColor" }}
    >
      <div
        className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider flex items-baseline gap-2 flex-wrap`}
      >
        <span className={theme.primary}>DEBUG</span>
        <span className={`tabular-nums ${theme.text}`}>
          step {panel.stepIndex} / {panel.totalSteps}
        </span>
        <span
          className={`tabular-nums px-1 border text-[10px] ${
            statusWarn
              ? `${theme.warn} border-current`
              : `${theme.muted} ${theme.border}`
          }`}
        >
          {panel.status}
        </span>
      </div>

      {panel.mapMismatch && (
        <div className={`text-[10px] mb-2 ${theme.warn}`}>
          [!] dig.map_mismatch — artifact does not match code at address.
        </div>
      )}

      <div className="flex flex-col max-md:flex-col md:flex-row gap-3">
        <div className="flex-1 min-w-0">
          {panel.hasSourceMap && panel.sourceLines ? (
            <pre
              className={`text-[10px] font-mono overflow-auto max-h-48 m-0 ${theme.text}`}
            >
              {panel.sourceLines.map((line, i) => {
                const current = panel.sourceLine === i;
                return (
                  <div
                    key={i}
                    className={
                      current
                        ? `${theme.primary} bg-current/10`
                        : undefined
                    }
                    style={
                      current
                        ? { backgroundColor: "color-mix(in srgb, currentColor 10%, transparent)" }
                        : undefined
                    }
                  >
                    <span
                      className={`inline-block w-8 text-right mr-2 tabular-nums ${theme.muted}`}
                      style={{ fontSize: "9px" }}
                    >
                      {i + 1}
                    </span>
                    {line || " "}
                  </div>
                );
              })}
            </pre>
          ) : (
            <div>
              <div className={`text-[10px] mb-1 ${theme.muted}`}>no source map</div>
              <div className={`text-[10px] font-mono space-y-0.5 ${theme.text}`}>
                {panel.opcodeRows.map((row) => (
                  <div
                    key={`${row.pc}-${row.op}-${row.current}`}
                    className={row.current ? theme.primary : theme.muted}
                  >
                    <span className="tabular-nums inline-block w-10">
                      {row.pc}
                    </span>{" "}
                    {row.op}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="md:w-44 shrink-0 space-y-2">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-[10px]">
            <span className={theme.muted}>PC</span>
            <span className={`tabular-nums ${theme.text}`}>{panel.pc}</span>
            <span className={theme.muted}>OPCODE</span>
            <span className={theme.text}>{panel.op}</span>
            <span className={theme.muted}>GAS</span>
            <span className={`tabular-nums ${theme.text}`}>{panel.gas}</span>
          </div>
          <div>
            <div className={`text-[10px] ${theme.muted} mb-0.5`}>STACK</div>
            {panel.stackTop8.length === 0 ? (
              <div className={`text-[10px] ${theme.muted}`}>—</div>
            ) : (
              <div className={`text-[10px] font-mono tabular-nums space-y-0.5 ${theme.text}`}>
                {panel.stackTop8.map((w, i) => (
                  <div key={i} style={{ overflowWrap: "anywhere" }}>
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {panel.truncated && (
        <div className={`text-[10px] mt-2 ${theme.muted}`}>
          · dig.debug_too_long — trace capped.
        </div>
      )}

      {onCommand && (
        <div className="mt-3 flex flex-wrap gap-1">
          {(
            [
              ["STEP", "dig step"],
              ["BACK", "dig back"],
              ["OVER", "dig over"],
              ["STOP", "dig debug stop"]
            ] as const
          ).map(([label, cmd]) => (
            <button
              key={label}
              type="button"
              className={`text-[10px] px-2 border ${theme.border} ${
                label === "STOP" ? theme.muted : theme.text
              } ${HIT}`}
              onClick={() => onCommand(cmd)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        />
      )}
    </div>
  );
}
