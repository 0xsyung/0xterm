/**
 * @file NewsReader.tsx
 * @description Editorial news research surface (#83 / Stephy chrome floor)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import PinButton from "./PinButton";
import {
  NEWS_READER_CATEGORIES,
  buildNewsFooter,
  categoryOf,
  estimateReadTime,
  filterByCategory,
  formatNewsAsOf,
  formatNewsEditorialDate,
  newsThumbStyle,
  openNewsArticle,
  type NewsItem,
  type NewsReaderCategoryFilter,
  type NewsSourceId
} from "../news";
import type { ThemeConfig } from "../types";
import type { NewsWidgetData } from "./NewsWidget";

export type NewsReaderData = NewsWidgetData;

function Thumb({
  sourceId,
  theme
}: {
  sourceId: NewsSourceId;
  theme: ThemeConfig;
}) {
  const thumb = newsThumbStyle(sourceId, theme);
  return (
    <div
      className={`relative w-full aspect-video border ${theme.border} overflow-hidden flex items-center justify-center`}
      style={{ background: thumb.background }}
      aria-hidden
    >
      <span
        className="font-bold text-lg md:text-xl tracking-wider select-none"
        style={{ color: thumb.monogramColor }}
      >
        {thumb.monogram}
      </span>
    </div>
  );
}

function CategoryTag({
  label,
  theme
}: {
  label: string;
  theme: ThemeConfig;
}) {
  return (
    <span
      className={`inline-block uppercase text-[9px] px-1.5 py-0.5 border ${theme.border} ${theme.muted} tracking-wide`}
    >
      {label}
    </span>
  );
}

function MetaLine({ item, theme }: { item: NewsItem; theme: ThemeConfig }) {
  const mins = estimateReadTime(item);
  return (
    <div className={`${theme.muted} text-[10px] tabular-nums normal-case`}>
      {`${formatNewsEditorialDate(item.publishedAt)} · ${mins} min read`}
    </div>
  );
}

export default function NewsReader({
  data,
  theme,
  onPin,
  pinned,
  autoFocus = false,
  onFocusPrompt
}: {
  data: NewsReaderData;
  theme: ThemeConfig;
  onPin?: () => void;
  pinned?: boolean;
  autoFocus?: boolean;
  onFocusPrompt?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [category, setCategory] =
    useState<NewsReaderCategoryFilter>("All");

  const allItems = data.items || [];
  const items = useMemo(
    () => filterByCategory(allItems, category),
    [allItems, category]
  );

  const lead = items[0] ?? null;
  const supportingCount = lead
    ? Math.min(4, Math.max(0, items.length - 1))
    : 0;
  const supporting = lead ? items.slice(1, 1 + supportingCount) : [];
  const grid = lead ? items.slice(1 + supportingCount) : [];

  const tagChip = (data.tag || "").trim();
  const footer = buildNewsFooter(!!data.usedRss2json, data.missing || []);
  const isBloomberg = /bloomberg/i.test(theme.name || "");

  useEffect(() => {
    setActiveIdx(0);
  }, [data.widgetId, data.fetchedAt, items.length, category]);

  useEffect(() => {
    if (autoFocus && rootRef.current) {
      rootRef.current.focus();
      setFocused(true);
    }
  }, [autoFocus, data.fetchedAt]);

  const openAt = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    const ok = openNewsArticle(it.url);
    if (!ok) return;
    onFocusPrompt?.();
    setFocused(false);
    rootRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!focused) return;
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (items.length === 0) return;
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

  const renderCard = (
    item: NewsItem,
    idx: number,
    variant: "lead" | "supporting" | "grid"
  ) => {
    const active = focused && idx === activeIdx;
    const cat = categoryOf(item.sourceId);
    const isLead = variant === "lead";
    const showExcerpt = variant === "lead" || variant === "grid";
    return (
      <button
        key={item.id}
        type="button"
        data-news-idx={idx}
        onMouseDown={(e) => {
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
          openAt(idx);
        }}
        className={`w-full text-left cursor-pointer border ${theme.border} ${theme.cardBg} ${theme.rounded} p-1.5 space-y-1.5 outline-none ${
          active ? theme.glow : ""
        }`}
        style={
          active
            ? { boxShadow: `0 0 0 1px ${theme.phosphor}` }
            : undefined
        }
      >
        <Thumb sourceId={item.sourceId} theme={theme} />
        <CategoryTag label={cat} theme={theme} />
        <div
          className={`${theme.primary} normal-case font-bold leading-snug ${
            isLead
              ? "text-base md:text-lg line-clamp-3"
              : "text-xs md:text-[11px] line-clamp-2"
          }`}
        >
          {item.title}
        </div>
        {showExcerpt && (
          <div
            className={`${theme.muted} text-xs normal-case leading-snug line-clamp-2`}
          >
            {item.title}
          </div>
        )}
        <MetaLine item={item} theme={theme} />
      </button>
    );
  };

  const emptyUnderFilters = !data.loading && items.length === 0;
  // Tag miss (upstream filter emptied the set) keeps widget-parity copy.
  const emptyCopy =
    emptyUnderFilters &&
    tagChip &&
    category === "All" &&
    allItems.length === 0
      ? `No headlines matched '${tagChip}'.`
      : "No items found.";

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-retain-focus=""
      data-testid="news-reader"
      className={`relative group my-3 p-2 md:p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} text-xs space-y-3 outline-none ${theme.font}`}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocused(false);
        }
      }}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Masthead */}
      <div className="relative pr-8">
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        />
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-1 md:gap-3">
          <div
            className={`font-bold tracking-widest text-lg md:text-xl lg:text-2xl ${
              isBloomberg ? "uppercase" : ""
            }`}
          >
            <span className={theme.primary}>0xTERM</span>
            <span className={`${theme.muted} font-normal`}> research</span>
          </div>
          <div
            className={`flex flex-wrap items-center gap-2 ${theme.muted} text-[9px] md:text-[10px] tabular-nums normal-case`}
          >
            <span>as of {formatNewsAsOf(data.fetchedAt || Date.now())}</span>
            {tagChip ? (
              <span
                className={`text-[9px] px-1 border ${theme.border} ${theme.muted} uppercase`}
              >
                {tagChip.toUpperCase()}
              </span>
            ) : null}
            {pinned ? (
              <span className={`text-[9px] ${theme.muted}`}>pinned</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Taxonomy pills */}
      <div
        className="flex flex-row gap-2 pb-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="News categories"
      >
        {NEWS_READER_CATEGORIES.map((pill) => {
          const active = category === pill;
          return (
            <button
              key={pill}
              type="button"
              role="tab"
              aria-selected={active}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setCategory(pill);
              }}
              className={`shrink-0 min-h-[32px] pointer-coarse:min-h-[44px] px-3 py-1 border text-[10px] uppercase tracking-wide cursor-pointer ${
                active
                  ? `${theme.primary} ${theme.border}`
                  : `${theme.muted} ${theme.border}`
              }`}
              style={
                active
                  ? { background: `${theme.phosphor}1a` }
                  : { background: "transparent" }
              }
            >
              {pill}
            </button>
          );
        })}
      </div>

      {data.loading ? (
        <div className={`${theme.muted} normal-case text-center py-6`}>
          Fetching headlines…
        </div>
      ) : emptyUnderFilters ? (
        <div className={`${theme.muted} normal-case text-center py-8`}>
          {emptyCopy}
        </div>
      ) : (
        <>
          {lead && (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
              <div>{renderCard(lead, 0, "lead")}</div>
              {supporting.length > 0 && (
                <div
                  className={
                    supporting.length === 1
                      ? "grid grid-cols-1 gap-2 md:flex md:flex-col"
                      : "grid grid-cols-2 gap-2 md:flex md:flex-col"
                  }
                >
                  {supporting.map((it, i) =>
                    renderCard(it, i + 1, "supporting")
                  )}
                </div>
              )}
            </div>
          )}

          {grid.length > 0 && (
            <div className="space-y-2">
              <div
                className={`${theme.muted} text-[9px] uppercase tracking-widest border-b ${theme.border} pb-1`}
              >
                MORE
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {grid.map((it, i) =>
                  renderCard(it, 1 + supportingCount + i, "grid")
                )}
              </div>
            </div>
          )}
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
