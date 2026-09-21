/**
 * @file FloatingChat.tsx
 * @description LinkedIn-style floating messenger bubble + overlay (#82). Skins-only.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import type { ThemeConfig } from "../types";
import type { PrimaryTab } from "../socialUnread";
import { formatBadgeCount } from "../socialUnread";
import {
  InboxThreadList,
  InboxThreadMessages,
  type InboxSenderSummary,
  type InboxThreadView
} from "../inbox/InboxViews";

function errMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export type FloatingChatProps = {
  theme: ThemeConfig;
  /** Prefer theme.rounded only when soft (macintosh); else 0-radius per Stephy. */
  themeKey?: string;
  inboxUnread: number;
  channelLabel: string | null;
  isConnected: boolean;
  /** Pixels from shell bottom to clear above prompt (≥12px gap applied here). */
  promptClearancePx: number;
  primaryTab: PrimaryTab;
  loadSenders: () => Promise<InboxSenderSummary[]>;
  loadThread: (peer: Address) => Promise<InboxThreadView>;
  /** Advance/clear inbox baseline (same as opening Social Inbox). */
  onAckInbox: () => void;
  /** Notify shell so poller keeps badge clear while open. */
  onOpenChange?: (open: boolean) => void;
  sendMessage?: (peer: Address, text: string) => Promise<void>;
  onFocusPrompt?: () => void;
};

const PANEL_W = 360;
const PANEL_H = 480;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 360;
const BUBBLE = 48;
const GAP = 12;

export default function FloatingChat({
  theme,
  themeKey,
  inboxUnread,
  channelLabel,
  isConnected,
  promptClearancePx,
  primaryTab,
  loadSenders,
  loadThread,
  onAckInbox,
  onOpenChange,
  sendMessage,
  onFocusPrompt
}: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [senders, setSenders] = useState<InboxSenderSummary[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [thread, setThread] = useState<InboxThreadView | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const radius =
    themeKey === "macintosh" || (theme.rounded && theme.rounded !== "rounded-none")
      ? theme.rounded || "rounded-none"
      : "rounded-none";

  const badgeLabel = formatBadgeCount(inboxUnread);
  const bubbleBottom = Math.max(GAP, promptClearancePx + GAP);
  const rightPx = 12;
  // Panel bottom shares bubble clearance (≥12px above prompt). Bubble hides while open
  // so it does not cover the panel; collapse via × / Esc (or re-show bubble).

  const setExpanded = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
      if (next) {
        onAckInbox();
      } else if (primaryTab === "terminal") {
        onFocusPrompt?.();
      }
    },
    [onAckInbox, onFocusPrompt, onOpenChange, primaryTab]
  );

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

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- open-driven fetch */
    setThread(null);
    void refreshSenders();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, refreshSenders, channelLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const root = panelRef.current;
      if (!root) return;
      const active = document.activeElement;
      if (active && root.contains(active)) {
        e.preventDefault();
        e.stopPropagation();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setExpanded]);

  // Autofocus panel root when opened so Esc works without requiring a click first.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  const openThread = async (peer: Address) => {
    setThreadLoading(true);
    setInboxError(null);
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

  const handleSend = async (text: string) => {
    if (!thread || !sendMessage) return;
    setSending(true);
    try {
      await sendMessage(thread.peer, text);
      const t = await loadThread(thread.peer);
      setThread(t);
      void refreshSenders();
    } finally {
      setSending(false);
    }
  };

  const title = channelLabel ? `CHAT · ${channelLabel}` : "CHAT";

  const panelStyle: React.CSSProperties = {
    bottom: bubbleBottom,
    right: rightPx,
    width: `min(calc(100vw - 16px), ${PANEL_W}px)`,
    height: `min(60vh, ${PANEL_H}px)`,
    minWidth: Math.min(PANEL_MIN_W, 280),
    minHeight: Math.min(PANEL_MIN_H, 240),
    maxWidth: PANEL_W,
    maxHeight: PANEL_H
  };

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Floating chat"
          data-retain-focus=""
          data-floating-chat-panel=""
          tabIndex={-1}
          className={`absolute z-[25] flex flex-col border ${theme.border} ${theme.cardBg} ${radius} text-xs shadow-xl overflow-hidden outline-none`}
          style={panelStyle}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${theme.border} shrink-0`}
          >
            <span
              className={`font-bold uppercase tracking-widest text-[11px] ${theme.primary} truncate`}
            >
              {title}
            </span>
            <button
              type="button"
              aria-label="Collapse chat"
              onClick={() => setExpanded(false)}
              className={`inline-flex items-center justify-center w-8 h-8 pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] [@media(hover:none)]:min-w-[44px] border ${theme.border} ${theme.muted} cursor-pointer ${radius}`}
            >
              ×
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden p-3 flex flex-col text-[11px] md:text-xs space-y-2">
            {!isConnected && (
              <div className={theme.muted}>Connect a wallet to read chat.</div>
            )}
            {isConnected && !channelLabel && (
              <div className={theme.muted}>
                No active channel · type channel
              </div>
            )}
            {isConnected &&
              channelLabel &&
              inboxLoading &&
              !senders &&
              !thread && <div className={theme.muted}>Loading…</div>}
            {inboxError && <div className={theme.muted}>{inboxError}</div>}
            {isConnected &&
              channelLabel &&
              senders &&
              !thread &&
              !threadLoading && (
                <InboxThreadList
                  theme={theme}
                  senders={senders}
                  onOpenThread={(peer) => void openThread(peer)}
                  emptyLabel="No conversations"
                  radius={radius}
                />
              )}
            {threadLoading && <div className={theme.muted}>Decrypting…</div>}
            {thread && (
              <InboxThreadMessages
                theme={theme}
                thread={thread}
                onBack={() => setThread(null)}
                emptyLabel="No messages yet"
                onSend={sendMessage ? (t) => handleSend(t) : undefined}
                sending={sending}
              />
            )}
          </div>
        </div>
      )}

      {/* Bubble: mouse/tap only — no data-retain-focus (must not steal prompt).
          Hidden while expanded so panel owns the corner; × / Esc collapse. */}
      {!open && (
        <button
          type="button"
          data-floating-chat-bubble=""
          aria-label={
            badgeLabel
              ? `Open chat, ${badgeLabel} unread`
              : "Open chat"
          }
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          className={`absolute z-[20] inline-flex items-center justify-center border ${theme.border} ${theme.cardBg} cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] [@media(hover:none)]:min-w-[44px] ${radius} [@media(hover:hover)]:hover:[border-color:var(--phosphor)]`}
          style={{
            bottom: bubbleBottom,
            right: rightPx,
            width: BUBBLE,
            height: BUBBLE
          }}
        >
          <span
            className={`text-[9px] uppercase tracking-widest font-bold ${theme.muted}`}
          >
            CHAT
          </span>
          {badgeLabel && (
            <span
              className={`absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[9px] leading-none font-bold ${radius}`}
              style={{
                background: theme.phosphor,
                color: "#000000"
              }}
              aria-hidden
            >
              {badgeLabel}
            </span>
          )}
        </button>
      )}
    </>
  );
}
