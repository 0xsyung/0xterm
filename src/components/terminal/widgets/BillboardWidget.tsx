/**
 * @file BillboardWidget.tsx
 * @description Public notice board widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useState } from "react";

export type BillboardPost = {
  author: string;
  timestamp: number;
  content: string;
};

export default function BillboardWidget({
  posts,
  total,
  pageSize = 5,
  onLoadPage,
  theme
}: {
  posts: BillboardPost[];
  total: number;
  pageSize?: number;
  onLoadPage?: (offset: number) => Promise<BillboardPost[]> | BillboardPost[];
  theme: any;
}) {
  const [items, setItems] = useState<BillboardPost[]>(posts);
  const [offset, setOffset] = useState(0); // skip-newest offset of the shown page
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPrev = offset > 0;
  const hasNext = offset + items.length < total;

  const goTo = async (newOffset: number) => {
    if (!onLoadPage || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await onLoadPage(newOffset);
      setItems(page);
      setOffset(newOffset);
    } catch (err: any) {
      setError(err.message || "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  };

  const pageLabel = total > 0 ? `page ${Math.floor(offset / pageSize) + 1} / ${Math.ceil(total / pageSize)}` : "";

  return (
    <div
      className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} text-xs space-y-2 max-w-2xl`}
    >
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
      >
        <span className="font-bold">BILLBOARD · public on-chain</span>
        <span className="uppercase text-[10px]">no encryption</span>
      </div>

      {items.length === 0 ? (
        <div className={`${theme.text}/50`}>No posts yet. Post with `board post &lt;content&gt;`.</div>
      ) : (
        items.map((p, i) => {
          const time = new Date(p.timestamp * 1000).toLocaleString();
          const short = `${p.author.slice(0, 6)}…${p.author.slice(-4)}`;
          return (
            <div
              key={`${offset}-${i}`}
              className={`px-3 py-2 ${theme.text} bg-black/30 ${theme.border} border`}
            >
              <div className="whitespace-pre-wrap break-words">{p.content}</div>
              <div className={`text-[10px] mt-1 ${theme.text}/50`}>
                from {short} · {time}
              </div>
            </div>
          );
        })
      )}

      <div className={`flex items-center gap-3 ${theme.text}/70`}>
        {onLoadPage && total > 0 && (
          <button
            type="button"
            onClick={() => goTo(Math.max(0, offset - pageSize))}
            disabled={loading || !hasPrev}
            className={`uppercase text-[10px] underline cursor-pointer ${theme.primary} ${loading || !hasPrev ? "opacity-40 cursor-default" : ""}`}
          >
            ‹ prev
          </button>
        )}
        {onLoadPage && total > 0 && (
          <button
            type="button"
            onClick={() => goTo(offset + pageSize)}
            disabled={loading || !hasNext}
            className={`uppercase text-[10px] underline cursor-pointer ${theme.primary} ${loading || !hasNext ? "opacity-40 cursor-default" : ""}`}
          >
            next ›
          </button>
        )}
        {pageLabel && <span className="text-[10px] opacity-60">{pageLabel}</span>}
        {error && <span className="text-red-400 text-[10px]">error: {error}</span>}
      </div>
    </div>
  );
}
