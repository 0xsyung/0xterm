/**
 * @file ShareCard.tsx
 * @description look / owner-status share widget — Designer chrome lock (#62)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useState } from "react";
import type { Address } from "viem";
import type { ThemeConfig } from "../types";
import {
  formatCopiedAck,
  formatRelative,
  formatSignedPct,
  formatSignedUsd,
  formatUpdatedLocal,
  formatUsd,
  pnlTone,
  shareRevokedMsg,
  truncateAddress,
  type ShareCardV1
} from "../shareCard";
import { NO_ACTIVE_CHANNEL_MSG } from "../chatChannels";

const TAP =
  "pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px] max-md:min-w-[44px] [@media(hover:none)]:min-h-[44px] [@media(hover:none)]:min-w-[44px] inline-flex items-center justify-center";

export type ShareCardPayload = {
  card: ShareCardV1;
  active: boolean;
  explorerUrl?: string | null;
  hasActiveChannel?: boolean;
};

export default function ShareCard({
  card,
  active,
  explorerUrl,
  hasActiveChannel = false,
  theme,
  onFillPrompt,
  onWarn,
  onCopyAck
}: ShareCardPayload & {
  theme: ThemeConfig;
  onFillPrompt?: (text: string) => void;
  onWarn?: (text: string) => void;
  onCopyAck?: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const revoked = !active || card.revoked;
  const owner = card.owner;
  const short = truncateAddress(owner);
  const ens = (card.ens || "").trim();
  const chatDisabled = !owner;

  const badgeClass = revoked
    ? `${theme.warn}`
    : `${theme.border} ${theme.primary}`;

  const onChat = () => {
    if (chatDisabled) return;
    if (!hasActiveChannel) {
      onWarn?.(NO_ACTIVE_CHANNEL_MSG);
      return;
    }
    onFillPrompt?.(`chat ${owner} `);
  };

  const onCopy = async () => {
    if (!owner) return;
    try {
      await navigator.clipboard.writeText(owner);
    } catch {
      // clipboard unavailable
    }
    const ack = formatCopiedAck(owner);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    onCopyAck?.(ack);
  };

  const toneClass = (v: number | null | undefined) => {
    const t = pnlTone(v);
    if (t === "primary") return theme.primary;
    if (t === "warn") return theme.warn;
    return theme.muted;
  };

  return (
    <div
      className={`relative my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-2 w-full max-w-2xl ${theme.text}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {ens ? (
          <span className={`${theme.text} ${theme.primary} [overflow-wrap:anywhere]`}>
            {ens}
          </span>
        ) : null}
        <span className={`${theme.font} tabular-nums [overflow-wrap:anywhere]`}>
          {short}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 border uppercase tracking-wider ${badgeClass}`}
        >
          {revoked ? "REVOKED" : "SHARED"}
        </span>
      </div>

      <div className={`${theme.text} text-[10px]`}>
        UPDATED {formatUpdatedLocal(card.updatedAt)}
        {formatRelative(card.updatedAt) ? (
          <span className={` ${theme.muted}`}>
            {" "}
            · {formatRelative(card.updatedAt)}
          </span>
        ) : null}
      </div>

      {revoked ? (
        <div className={theme.warn}>{shareRevokedMsg()}</div>
      ) : (
        <>
          {card.portfolio ? (
            <div className="space-y-1">
              <div className={`${theme.muted} text-[10px] tracking-wider`}>
                PORTFOLIO
              </div>
              <div className={`tabular-nums ${theme.primary} ${theme.text}`}>
                {formatUsd(card.portfolio.totalUsd)}
              </div>
              <div className="space-y-0.5">
                {card.portfolio.holdings.map((h, i) => (
                  <div
                    key={`${h.chainId}-${h.symbol}-${i}`}
                    className="flex justify-between gap-3 max-md:flex-col max-md:gap-0"
                  >
                    <span className="[overflow-wrap:anywhere]">{h.symbol}</span>
                    <span className="tabular-nums text-right whitespace-nowrap">
                      {h.amount}{" "}
                      <span className={theme.primary}>{formatUsd(h.usd)}</span>
                    </span>
                  </div>
                ))}
                {card.portfolio.moreCount > 0 ? (
                  <div className={theme.muted}>
                    +{card.portfolio.moreCount} more
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {card.pnl ? (
            <div className="space-y-1">
              <div className={`${theme.muted} text-[10px]`}>
                PNL
                {card.pnl.snapshotLabel || card.pnl.snapshotAt ? (
                  <span>
                    {" "}
                    vs · {card.pnl.snapshotLabel}
                    {card.pnl.snapshotAt
                      ? ` ${formatUpdatedLocal(
                          card.pnl.snapshotAt > 1e12
                            ? Math.floor(card.pnl.snapshotAt / 1000)
                            : card.pnl.snapshotAt
                        )}`
                      : ""}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3 tabular-nums">
                <span className={toneClass(card.pnl.pnlPct)}>
                  {formatSignedPct(card.pnl.pnlPct)}
                </span>
                <span className={toneClass(card.pnl.pnlUsd)}>
                  {formatSignedUsd(card.pnl.pnlUsd)}
                </span>
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={chatDisabled}
          onClick={onChat}
          className={`uppercase text-[10px] px-2 border ${TAP} ${
            chatDisabled ? theme.muted : `${theme.border} ${theme.primary}`
          } cursor-pointer disabled:cursor-default`}
        >
          CHAT
        </button>
        <button
          type="button"
          onClick={onCopy}
          className={`uppercase text-[10px] px-2 border ${theme.border} ${theme.primary} cursor-pointer ${TAP}`}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
        {explorerUrl ? (
          <a
            href={`${explorerUrl.replace(/\/$/, "")}/address/${owner as Address}`}
            target="_blank"
            rel="noreferrer"
            className={`underline ${theme.text} pointer-coarse:min-h-[44px] pointer-coarse:inline-flex pointer-coarse:items-center max-md:min-h-[44px] max-md:inline-flex max-md:items-center`}
          >
            Explorer ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
