/**
 * @file FeedList.tsx
 * @description Compact recent-shares list — Designer chrome lock (#62)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React from "react";
import type { ThemeConfig } from "../types";
import {
  formatRelative,
  formatSignedPct,
  formatUpdatedLocal,
  formatUsd,
  pnlTone,
  truncateAddress,
  type FeedItem
} from "../shareCard";

const TAP =
  "pointer-coarse:min-h-[44px] max-md:min-h-[44px] [@media(hover:none)]:min-h-[44px] min-h-[44px] w-full text-left";

export default function FeedList({
  items,
  theme,
  onLook
}: {
  items: FeedItem[];
  theme: ThemeConfig;
  onLook?: (owner: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className={`my-3 text-xs ${theme.muted}`}>No shares yet.</div>
    );
  }

  return (
    <div className={`my-3 space-y-1 w-full max-w-2xl`}>
      {items.map((it) => {
        const short = truncateAddress(it.owner);
        const label = it.ens?.trim() ? it.ens.trim() : short;
        const badge = it.active ? "SHARED" : "REVOKED";
        const badgeClass = it.active
          ? `${theme.border} ${theme.primary}`
          : theme.warn;
        const tone = pnlTone(it.pnlPct);
        const pctClass =
          tone === "primary"
            ? theme.primary
            : tone === "warn"
              ? theme.warn
              : theme.muted;
        return (
          <button
            key={`${it.owner}-${it.updatedAt}`}
            type="button"
            onClick={() => onLook?.(it.owner)}
            className={`${TAP} px-3 py-2 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.text} cursor-pointer flex flex-wrap items-center gap-x-3 gap-y-1`}
          >
            <span
              className={`text-[10px] px-1.5 py-0.5 border uppercase tracking-wider ${badgeClass}`}
            >
              {badge}
            </span>
            <span className="[overflow-wrap:anywhere]">{label}</span>
            {it.ens?.trim() ? (
              <span className={`${theme.font} tabular-nums ${theme.muted}`}>
                {short}
              </span>
            ) : null}
            <span className={`tabular-nums ${theme.primary}`}>
              {formatUsd(it.totalUsd)}
            </span>
            <span className={`tabular-nums ${pctClass}`}>
              {formatSignedPct(it.pnlPct)}
            </span>
            <span className={`${theme.muted} text-[10px]`}>
              UPDATED {formatUpdatedLocal(it.updatedAt)}
              {formatRelative(it.updatedAt)
                ? ` · ${formatRelative(it.updatedAt)}`
                : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
