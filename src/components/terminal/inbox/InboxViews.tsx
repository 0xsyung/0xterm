/**
 * @file InboxViews.tsx
 * @description Shared Social Inbox thread-list + thread-view (#82) — used by SocialPanel and FloatingChat.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useState } from "react";
import type { Address } from "viem";
import type { ThemeConfig } from "../types";
import type { ChatMessage } from "../widgets/ChatWidget";

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

export function shortAddr(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export type InboxThreadListProps = {
  theme: ThemeConfig;
  senders: InboxSenderSummary[];
  onOpenThread: (peer: Address) => void;
  /** Empty when senders.length === 0. Floater uses Stephy one-liner. */
  emptyLabel?: string;
  radius?: string;
};

/** Thread list rows — shared by Social Inbox and floating messenger. */
export function InboxThreadList({
  theme,
  senders,
  onOpenThread,
  emptyLabel = "No conversations",
  radius = "rounded-none"
}: InboxThreadListProps) {
  if (senders.length === 0) {
    return <div className={theme.muted}>{emptyLabel}</div>;
  }
  return (
    <div className="space-y-1">
      <div
        className={`font-bold ${theme.primary} text-[10px] uppercase tracking-widest`}
      >
        Threads
      </div>
      {senders.map((s) => {
        const short = shortAddr(s.peer);
        return (
          <button
            key={s.peer}
            type="button"
            onClick={() => onOpenThread(s.peer)}
            className={`w-full text-left px-2 py-2 border ${theme.border} ${theme.text} cursor-pointer pointer-coarse:min-h-[44px] [@media(hover:none)]:min-h-[44px] hover:opacity-90 ${radius}`}
          >
            <span className="font-bold">{s.label || short}</span>
            <span className={`ml-2 ${theme.muted}`}>
              {s.count} msg{s.count === 1 ? "" : "s"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type InboxThreadMessagesProps = {
  theme: ThemeConfig;
  thread: InboxThreadView;
  onBack?: () => void;
  /** Empty thread copy. Floater: "No messages yet". */
  emptyLabel?: string;
  /** Optional send composer (floater). Social Inbox omits — send via `chat`. */
  onSend?: (text: string) => Promise<void> | void;
  sending?: boolean;
};

/** Thread header + message bubbles (+ optional composer). */
export function InboxThreadMessages({
  theme,
  thread,
  onBack,
  emptyLabel = "No messages yet",
  onSend,
  sending = false
}: InboxThreadMessagesProps) {
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !onSend || sending) return;
    setSendError(null);
    try {
      await onSend(text);
      setDraft("");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message || "Send failed")
          : "Send failed";
      setSendError(msg);
    }
  };

  return (
    <div className="space-y-2 flex flex-col min-h-0 flex-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`uppercase text-[10px] underline cursor-pointer ${theme.primary} pointer-coarse:min-h-[44px] [@media(hover:none)]:min-h-[44px] self-start`}
        >
          ‹ threads
        </button>
      )}
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1 shrink-0`}
      >
        <span className="font-bold">
          CHAT · {thread.peerLabel || shortAddr(thread.peer)}
        </span>
        <span className={`uppercase text-[10px] ${theme.muted}`}>encrypted</span>
      </div>
      {thread.peerFingerprint && (
        <div className={`text-[10px] ${theme.muted} shrink-0`}>
          KEY {thread.peerFingerprint}
        </div>
      )}
      {thread.keyChanged && (
        <div className={`text-[10px] ${theme.muted} shrink-0`}>
          Peer chat key changed since last contact — verify before trusting.
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {thread.messages.length === 0 ? (
          <div className={theme.muted}>{emptyLabel}</div>
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
      {onSend && (
        <div className="shrink-0 flex flex-col gap-1 pt-1 border-t border-transparent">
          {sendError && (
            <div className={`text-[10px] ${theme.muted}`}>{sendError}</div>
          )}
          <div className="flex gap-1.5 items-stretch">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  void submit();
                }
              }}
              placeholder="Message…"
              disabled={sending}
              className={`flex-1 min-w-0 px-2 py-1.5 text-xs bg-transparent outline-none border ${theme.border} ${theme.text} pointer-coarse:min-h-[44px] [@media(hover:none)]:min-h-[44px]`}
              spellCheck={false}
              autoComplete="off"
              aria-label="Message"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={sending || !draft.trim()}
              className={`px-3 uppercase text-[10px] tracking-widest border ${theme.border} cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] ${
                sending || !draft.trim() ? "opacity-40 cursor-default" : theme.primary
              }`}
              aria-label="Send"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
