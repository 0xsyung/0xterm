/**
 * @file SocialPanel.tsx
 * @description Social surface: Inbox + Board sub-tabs (#63). No pin affordances.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import type { ThemeConfig } from "./types";
import type { SocialSubTab } from "./socialUnread";
import { formatBadgeCount } from "./socialUnread";
import type { ChatMessage } from "./widgets/ChatWidget";
import type { BillboardPost } from "./widgets/BillboardWidget";

function errMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export type InboxSenderSummary = {
  peer: Address;
  count: number;
  label?: string;
};

export type InboxThreadView = {
  messages: ChatMessage[];
  peer: Address;
  self: Address;
  peerLabel?: string;
  peerFingerprint?: string;
  keyChanged?: boolean;
};

export type BoardView = {
  posts: BillboardPost[];
  total: number;
  pageSize: number;
  onLoadPage?: (offset: number) => Promise<BillboardPost[]>;
};

function segmentRadius(theme: ThemeConfig): string {
  return theme.headerStyle === "macintosh" ? theme.rounded : "rounded-none";
}

function SegmentButton({
  label,
  active,
  badge,
  theme,
  quiet,
  onClick
}: {
  label: string;
  active: boolean;
  badge?: number;
  theme: ThemeConfig;
  quiet?: boolean;
  onClick: () => void;
}) {
  const badgeLabel = formatBadgeCount(badge ?? 0);
  const radius = segmentRadius(theme);
  const fillFg =
    theme.headerStyle === "teletype"
      ? "#F3F0E6"
      : theme.headerStyle === "dos"
        ? "#0000aa"
        : theme.headerStyle === "macintosh"
          ? "#ffffff"
          : "#000000";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative inline-flex items-center justify-center gap-1.5 px-3 uppercase tracking-widest cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] ${radius} ${
        quiet ? "text-[10px]" : "text-[11px]"
      } ${
        active
          ? "border border-transparent font-bold"
          : `border ${theme.border} ${theme.muted} bg-transparent`
      }`}
      style={
        active
          ? { background: theme.phosphor, color: fillFg }
          : undefined
      }
    >
      {label}
      {badgeLabel && (
        <span
          className={`inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[9px] leading-none font-bold ${radius}`}
          style={{
            background: active ? fillFg : theme.phosphor,
            color: active ? theme.phosphor : fillFg
          }}
          aria-label={`${badgeLabel} unread`}
        >
          {badgeLabel}
        </span>
      )}
    </button>
  );
}

export default function SocialPanel({
  theme,
  subTab,
  onSubTabChange,
  inboxUnread,
  boardUnread,
  channelLabel,
  isConnected,
  loadSenders,
  loadThread,
  loadBoard
}: {
  theme: ThemeConfig;
  subTab: SocialSubTab;
  onSubTabChange: (tab: SocialSubTab) => void;
  inboxUnread: number;
  boardUnread: number;
  /** Active chat channel name/address, or null when none. */
  channelLabel: string | null;
  isConnected: boolean;
  loadSenders: () => Promise<InboxSenderSummary[]>;
  loadThread: (peer: Address) => Promise<InboxThreadView>;
  loadBoard: () => Promise<BoardView | null>;
}) {
  const [senders, setSenders] = useState<InboxSenderSummary[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [thread, setThread] = useState<InboxThreadView | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const [board, setBoard] = useState<BoardView | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardItems, setBoardItems] = useState<BillboardPost[]>([]);
  const [boardOffset, setBoardOffset] = useState(0);

  const refreshSenders = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const list = await loadSenders();
      setSenders(list);
    } catch (err: unknown) {
      setInboxError(errMessage(err, "Failed to load inbox."));
      setSenders([]);
    } finally {
      setInboxLoading(false);
    }
  }, [loadSenders]);

  const refreshBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const view = await loadBoard();
      setBoard(view);
      setBoardItems(view?.posts ?? []);
      setBoardOffset(0);
    } catch (err: unknown) {
      setBoardError(errMessage(err, "Failed to load board."));
      setBoard(null);
      setBoardItems([]);
    } finally {
      setBoardLoading(false);
    }
  }, [loadBoard]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- tab-driven Social fetch */
    if (subTab === "inbox") {
      setThread(null);
      void refreshSenders();
    } else {
      void refreshBoard();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [subTab, refreshSenders, refreshBoard]);

  const openThread = async (peer: Address) => {
    setThreadLoading(true);
    try {
      const t = await loadThread(peer);
      setThread(t);
    } catch (err: unknown) {
      setInboxError(errMessage(err, "Failed to load thread."));
      setThread(null);
    } finally {
      setThreadLoading(false);
    }
  };

  const goBoardPage = async (newOffset: number) => {
    if (!board?.onLoadPage || boardLoading) return;
    setBoardLoading(true);
    setBoardError(null);
    try {
      const page = await board.onLoadPage(newOffset);
      setBoardItems(page);
      setBoardOffset(newOffset);
    } catch (err: unknown) {
      setBoardError(errMessage(err, "Failed to load posts."));
    } finally {
      setBoardLoading(false);
    }
  };

  const radius = segmentRadius(theme);
  const pageSize = board?.pageSize ?? 5;
  const total = board?.total ?? 0;
  const hasPrev = boardOffset > 0;
  const hasNext = boardOffset + boardItems.length < total;

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col overflow-hidden pt-2">
      <div className="flex items-center gap-1.5 shrink-0 mb-2">
        <SegmentButton
          label="INBOX"
          active={subTab === "inbox"}
          badge={inboxUnread}
          theme={theme}
          quiet
          onClick={() => onSubTabChange("inbox")}
        />
        <SegmentButton
          label="BOARD"
          active={subTab === "board"}
          badge={boardUnread}
          theme={theme}
          quiet
          onClick={() => onSubTabChange("board")}
        />
      </div>

      {subTab === "inbox" && (
        <div className={`text-[10px] ${theme.muted} mb-2 shrink-0`}>
          CHANNEL: {channelLabel || "—"}
          <span className="opacity-70"> · type channel</span>
        </div>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto border ${theme.border} ${theme.cardBg} ${radius} p-3 text-xs space-y-2`}
      >
        {subTab === "inbox" && (
          <>
            {!isConnected && (
              <div className={theme.muted}>Connect a wallet to read chat.</div>
            )}
            {isConnected && !channelLabel && (
              <div className={theme.muted}>
                No active chat channel. Type{" "}
                <span className={theme.primary}>channel list</span> or{" "}
                <span className={theme.primary}>channel deploy &lt;name&gt;</span>.
              </div>
            )}
            {isConnected && channelLabel && inboxLoading && !senders && (
              <div className={theme.muted}>Loading inbox…</div>
            )}
            {inboxError && <div className={theme.muted}>{inboxError}</div>}
            {isConnected &&
              channelLabel &&
              senders &&
              senders.length === 0 &&
              !inboxLoading && (
                <div className={theme.muted}>
                  No messages yet. Send with{" "}
                  <span className={theme.primary}>
                    chat &lt;address|ens&gt; &lt;message&gt;
                  </span>
                  .
                </div>
              )}
            {senders && senders.length > 0 && !thread && (
              <div className="space-y-1">
                <div className={`font-bold ${theme.primary} text-[10px] uppercase tracking-widest`}>
                  Threads
                </div>
                {senders.map((s) => {
                  const short = `${s.peer.slice(0, 6)}…${s.peer.slice(-4)}`;
                  return (
                    <button
                      key={s.peer}
                      type="button"
                      onClick={() => void openThread(s.peer)}
                      className={`w-full text-left px-2 py-2 border ${theme.border} ${theme.text} cursor-pointer pointer-coarse:min-h-[44px] hover:opacity-90 ${radius}`}
                    >
                      <span className="font-bold">{s.label || short}</span>
                      <span className={`ml-2 ${theme.muted}`}>
                        {s.count} msg{s.count === 1 ? "" : "s"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {threadLoading && <div className={theme.muted}>Decrypting…</div>}
            {thread && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setThread(null);
                                }}
                  className={`uppercase text-[10px] underline cursor-pointer ${theme.primary} pointer-coarse:min-h-[44px]`}
                >
                  ‹ threads
                </button>
                <div
                  className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
                >
                  <span className="font-bold">
                    CHAT ·{" "}
                    {thread.peerLabel ||
                      `${thread.peer.slice(0, 6)}…${thread.peer.slice(-4)}`}
                  </span>
                  <span className={`uppercase text-[10px] ${theme.muted}`}>
                    encrypted
                  </span>
                </div>
                {thread.peerFingerprint && (
                  <div className={`text-[10px] ${theme.muted}`}>
                    KEY {thread.peerFingerprint}
                  </div>
                )}
                {thread.keyChanged && (
                  <div className={`text-[10px] ${theme.muted}`}>
                    Peer chat key changed since last contact — verify before
                    trusting.
                  </div>
                )}
                {thread.messages.length === 0 ? (
                  <div className={theme.muted}>No messages in this conversation.</div>
                ) : (
                  thread.messages.map((m, i) => {
                    const isSelf =
                      m.from.toLowerCase() === thread.self.toLowerCase();
                    const dt = new Date(m.timestamp * 1000);
                    const time = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col gap-0.5 ${
                          isSelf ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`px-3 py-1.5 border ${theme.border} ${
                            isSelf ? theme.primary : theme.text
                          } bg-black/30`}
                        >
                          {m.decryptFailed ? (
                            <span className={theme.muted}>
                              [cannot decrypt — wrong key]
                            </span>
                          ) : m.decrypted !== undefined ? (
                            m.decrypted
                          ) : (
                            <span className={theme.muted}>[encrypted]</span>
                          )}
                        </div>
                        <div className={`text-[10px] ${theme.muted}`}>
                          {isSelf ? "you" : "peer"} · {time}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {subTab === "board" && (
          <>
            {boardLoading && boardItems.length === 0 && (
              <div className={theme.muted}>Loading board…</div>
            )}
            {boardError && <div className={theme.muted}>{boardError}</div>}
            {!boardLoading && !board && !boardError && (
              <div className={theme.muted}>
                No billboard on this network. Testnets only — post with{" "}
                <span className={theme.primary}>board post &lt;content&gt;</span>
                .
              </div>
            )}
            {board && boardItems.length === 0 && (
              <div className={theme.muted}>
                No posts yet. Post with{" "}
                <span className={theme.primary}>board post &lt;content&gt;</span>.
              </div>
            )}
            {boardItems.map((p, i) => {
              const time = new Date(p.timestamp * 1000).toLocaleString();
              const short = `${p.author.slice(0, 6)}…${p.author.slice(-4)}`;
              return (
                <div
                  key={`${boardOffset}-${i}`}
                  className={`px-3 py-2 ${theme.text} bg-black/30 border ${theme.border}`}
                >
                  <div className="whitespace-pre-wrap break-words">{p.content}</div>
                  <div className={`text-[10px] mt-1 ${theme.muted}`}>
                    from {short} · {time}
                  </div>
                </div>
              );
            })}
            {board && total > 0 && (
              <div className={`flex items-center gap-3 ${theme.muted}`}>
                <button
                  type="button"
                  onClick={() => void goBoardPage(Math.max(0, boardOffset - pageSize))}
                  disabled={boardLoading || !hasPrev}
                  className={`uppercase text-[10px] underline cursor-pointer ${theme.primary} pointer-coarse:min-h-[44px] ${
                    boardLoading || !hasPrev ? "opacity-40 cursor-default" : ""
                  }`}
                >
                  ‹ prev
                </button>
                <button
                  type="button"
                  onClick={() => void goBoardPage(boardOffset + pageSize)}
                  disabled={boardLoading || !hasNext}
                  className={`uppercase text-[10px] underline cursor-pointer ${theme.primary} pointer-coarse:min-h-[44px] ${
                    boardLoading || !hasNext ? "opacity-40 cursor-default" : ""
                  }`}
                >
                  next ›
                </button>
                <span className="text-[10px]">
                  page {Math.floor(boardOffset / pageSize) + 1} /{" "}
                  {Math.max(1, Math.ceil(total / pageSize))}
                </span>
              </div>
            )}
            {board && (
              <div className={`text-[10px] ${theme.muted} pt-1`}>
                Post with{" "}
                <span className={theme.primary}>board post &quot;…&quot;</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
