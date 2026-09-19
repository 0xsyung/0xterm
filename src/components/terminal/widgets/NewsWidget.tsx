/**
 * @file NewsWidget.tsx
 * @description Allowlisted RSS headlines board (#14 / Stephy chrome lock)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useEffect, useRef, useState } from "react";
import PinButton from "./PinButton";
import {
  buildNewsFooter,
  formatNewsAsOf,
  formatNewsTime,
  openNewsArticle,
  sourceLabel,
  type NewsItem,
  type NewsSourceId
} from "../news";

export type NewsWidgetData = {
  kind: "news";
  widgetId: string;
  tag: string;
  items: NewsItem[];
  fetchedAt: number;
  usedRss2json?: boolean;
  missing?: NewsSourceId[];
  loading?: boolean;
};

export default function NewsWidget({
  data,
  theme,
  compact = false,
  narrow = false,
  onPin,
  pinned,
  autoFocus = false,
  onFocusPrompt
}: {
  data: NewsWidgetData;
  theme: any;
  compact?: boolean;
  /** Drop TIME: compact pin OR narrow||band===stack (same as ticker VOL). */
  narrow?: boolean;
  onPin?: () => void;
  pinned?: boolean;
  /** Focus widget once after `news` so j/k work until Esc. */
  autoFocus?: boolean;
  onFocusPrompt?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const items = data.items || [];
  const dropTime = compact || narrow;
  const tagChip = (data.tag || "all").toUpperCase();
  const footer = buildNewsFooter(!!data.usedRss2json, data.missing || []);

  useEffect(() => {
    setActiveIdx(0);
  }, [data.widgetId, data.fetchedAt, items.length]);

  useEffect(() => {
    if (autoFocus && rootRef.current) {
      rootRef.current.focus();
      setFocused(true);
    }
  }, [autoFocus, data.fetchedAt]);

  const shell = compact
    ? `relative group my-1 p-1.5 border ${theme.border} ${theme.cardBg} ${theme.rounded} text-[10px] space-y-1 outline-none`
    : `relative group my-3 p-2 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-1 outline-none`;

  const colTemplate = dropTime
    ? "grid-cols-[minmax(0,12ch)_minmax(0,1fr)]"
    : "grid-cols-[6ch_minmax(0,12ch)_minmax(0,1fr)]";

  const openAt = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    // Gesture-safe open; only return focus to prompt on success (#89).
    // Blocked/failed open: keep widget focused so j/k still work.
    const ok = openNewsArticle(it.url);
    if (!ok) return;
    onFocusPrompt?.();
    setFocused(false);
    rootRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!focused) return;
    // Do not steal keys while a nested control isn't us — we only listen on our root.
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      openAt(activeIdx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setFocused(false);
      rootRef.current?.blur();
      onFocusPrompt?.();
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-retain-focus=""
      className={shell}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocused(false);
        }
      }}
      onKeyDown={onKeyDown}
      // Keep focus on widget — TerminalShell content onClick focuses the prompt.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <PinButton
        onPin={onPin}
        theme={theme}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
      />
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
      >
        <span className={`font-bold ${theme.text} normal-case`}>
          NEWS
          <span
            className={`ml-2 text-[9px] px-1 border ${theme.border} ${theme.muted} normal-case`}
          >
            {tagChip}
          </span>
          {pinned && (
            <span className={`ml-2 text-[9px] ${theme.muted}`}>pinned</span>
          )}
        </span>
        <span className={`${theme.muted} text-[9px] normal-case tabular-nums`}>
          as of {formatNewsAsOf(data.fetchedAt || Date.now())}
        </span>
      </div>

      {data.loading ? (
        <div className={`${theme.muted} normal-case`}>Fetching headlines…</div>
      ) : items.length === 0 ? (
        <div className={`${theme.muted} normal-case`}>
          {data.tag
            ? `No headlines matched '${data.tag}'.`
            : "No headlines right now."}
        </div>
      ) : (
        <>
          <div
            className={`grid ${colTemplate} gap-x-2 ${theme.muted} text-[9px] uppercase`}
          >
            {!dropTime && <div>TIME</div>}
            <div>SOURCE</div>
            <div>TITLE</div>
          </div>
          {items.map((it, idx) => {
            const active = focused && idx === activeIdx;
            return (
              <button
                key={it.id}
                type="button"
                onMouseDown={(e) => {
                  // Select + keep focus: no preventDefault (fights focus); stop bubble.
                  e.stopPropagation();
                  setActiveIdx(idx);
                  setFocused(true);
                  rootRef.current?.focus();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx(idx);
                  setFocused(true);
                  rootRef.current?.focus();
                }}
                className={`grid ${colTemplate} gap-x-2 w-full text-left tabular-nums ${
                  compact ? "text-[10px]" : "text-[11px]"
                } ${active ? theme.primary : theme.text} bg-transparent border-0 p-0 cursor-pointer`}
              >
                {!dropTime && (
                  <div className={`${theme.muted} overflow-hidden tabular-nums`}>
                    {formatNewsTime(it.publishedAt)}
                  </div>
                )}
                <div className={`${theme.muted} uppercase truncate`}>
                  {sourceLabel(it.sourceId)}
                </div>
                <div className="truncate normal-case">{it.title}</div>
              </button>
            );
          })}
        </>
      )}

      <div
        className={`text-[9px] ${theme.muted} pt-1 border-t ${theme.border} normal-case leading-snug`}
      >
        {footer}
      </div>
    </div>
  );
}
