/**
 * @file DigRunWidget.tsx
 * @description Dig run panel — deploy/at/call/send/receipt (#40 Stephy lock)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import type { ThemeConfig } from "../types";
import type { DigRunPanelState } from "../dig/session";
import { truncateAddress } from "../dig/encode";
import { envLabel } from "../dig/session";
import PinButton from "./PinButton";

export function digRunPinTitle(panel: DigRunPanelState): string {
  const addr = truncateAddress(panel.address);
  const fn = panel.lastFn || "—";
  const gas = panel.gas || "—";
  return `${addr} · ${fn} · ${gas}`;
}

export default function DigRunWidget({
  panel,
  theme,
  onPin,
  pinned,
  compact,
  onFillPrompt
}: {
  panel: DigRunPanelState;
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
  compact?: boolean;
  onFillPrompt?: (text: string) => void;
}) {
  if (compact) {
    return (
      <div className={`text-[10px] font-bold ${theme.primary} tabular-nums`}>
        {digRunPinTitle(panel)}
      </div>
    );
  }

  const envLine = envLabel(panel.env, panel.chainName);

  return (
    <div
      className={`relative group my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-md ${theme.text}`}
    >
      <div
        className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider ${theme.primary} flex items-baseline gap-2 flex-wrap`}
      >
        <span>RUN</span>
        <span className={`font-bold ${theme.text}`}>{panel.name}</span>
        <span className={`tabular-nums font-mono ${theme.text}`}>
          {truncateAddress(panel.address)}
        </span>
      </div>

      <div className={`text-[10px] ${theme.muted} mb-2`}>{envLine}</div>

      {panel.lastFn && (
        <div className={`text-[10px] ${theme.muted} mb-2`}>
          {panel.lastFn}
          {panel.argsSummary ? `(${panel.argsSummary})` : ""}
        </div>
      )}

      {panel.returnValues != null && (
        <div className={`text-[10px] mb-2 tabular-nums ${theme.primary}`}>
          <span className={theme.muted}>return </span>
          {panel.returnValues}
        </div>
      )}
      {panel.rawReturn && (
        <div className={`text-[10px] mb-2 ${theme.muted} break-all`}>
          raw {panel.rawReturn}
        </div>
      )}

      {panel.events.length > 0 && (
        <div className="mb-2">
          <div
            className={`grid grid-cols-[minmax(0,max-content)_1fr] gap-x-3 gap-y-0.5 text-[10px]`}
          >
            <div className={theme.muted}>EVENT</div>
            <div className={theme.muted}>ARGS</div>
            {panel.events.map((e, i) => (
              <React.Fragment key={`${e.eventName}-${i}`}>
                <div className={`${theme.text} break-words`}>{e.eventName}</div>
                <div className={`${theme.text} break-words`}>{e.argsSummary}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div className={`text-[10px] tabular-nums ${theme.text}`}>
        <span className={theme.muted}>{panel.gasLabel} </span>
        {panel.gas}
      </div>

      {panel.warnLine && (
        <div className={`text-[10px] mt-2 ${theme.warn}`}>{panel.warnLine}</div>
      )}

      {onFillPrompt && panel.lastFn && (
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            className={`text-[10px] px-2 border ${theme.border} ${theme.muted} pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px] [@media(hover:none)]:min-h-[44px]`}
            onClick={() => onFillPrompt(`dig call ${panel.lastFn} `)}
          >
            call
          </button>
          <button
            type="button"
            className={`text-[10px] px-2 border ${theme.border} ${theme.muted} pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px] [@media(hover:none)]:min-h-[44px]`}
            onClick={() => onFillPrompt(`dig send ${panel.lastFn} `)}
          >
            send
          </button>
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
