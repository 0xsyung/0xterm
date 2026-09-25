/**
 * @file FeedbackWidget.tsx
 * @description Compose widget for the feedback command (#19). Sends an
 *   encrypted chat message to the fixed operator address — no GitHub, no
 *   backend. State is React-only: drafts are never persisted.
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useState } from "react";
import type { ThemeConfig } from "../types";
import PinButton from "./PinButton";
import { redactSecrets, requireFeedbackConfirm } from "../../../lib/redactSecrets";

export type FeedbackDraft = {
  text: string;
  email: string | null;
  includeAddress: boolean;
};

export type FeedbackSubmitResult = { ok: true } | { ok: false; error?: string };

const FB_EMPTY = "write a few words first.";
const FB_SECRET =
  "this looks like a key / seed / token. it will be stripped. type YES to send the redacted message.";

export default function FeedbackWidget({
  theme,
  signer,
  themeName,
  chainLabel,
  noAddress,
  initialText,
  initialGate,
  onSubmit,
  onLogText,
  onCancel,
  onPin,
  pinned
}: {
  theme: ThemeConfig;
  signer?: string | null;
  themeName?: string | null;
  chainLabel?: string | null;
  noAddress?: boolean;
  initialText?: string;
  initialGate?: boolean;
  onSubmit: (draft: FeedbackDraft) => Promise<FeedbackSubmitResult> | FeedbackSubmitResult;
  onLogText?: (text: string, warn?: boolean) => void;
  onCancel?: () => void;
  onPin?: () => void;
  pinned?: boolean;
}) {
  const [text, setText] = useState(initialText || "");
  const [email, setEmail] = useState("");
  const [includeAddress, setIncludeAddress] = useState(!noAddress);
  const [secretGate, setSecretGate] = useState(initialGate || false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const redacted = redactSecrets(text);
  const confirmNeeded = requireFeedbackConfirm(redacted.hits);

  const draft = (): FeedbackDraft => ({
    text: redacted.text,
    email: email.trim() || null,
    includeAddress
  });

  const send = async () => {
    setError(null);
    if (!redacted.text.trim()) {
      setError(FB_EMPTY);
      return;
    }
    if (confirmNeeded) {
      setSecretGate(true);
      return;
    }
    await fire();
  };

  const fire = async () => {
    setSending(true);
    try {
      const res = await onSubmit(draft());
      if (!res.ok) setError(res.error || "send failed");
    } finally {
      setSending(false);
    }
  };

  const confirmSend = async () => {
    setSecretGate(false);
    await fire();
  };

  const touch =
    "pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px] [@media(hover:none)]:min-h-[44px]";

  return (
    <div
      data-retain-focus
      className={`relative my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-xl ${theme.text}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`flex justify-between items-center border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider ${theme.primary}`}
      >
        <span className="font-bold">FEEDBACK</span>
        <span className="flex items-center gap-2">
          <PinButton
            onPin={onPin}
            theme={theme}
            className="opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100"
          />
          {!pinned && (
            <button
              type="button"
              className={`px-2 py-0.5 border ${theme.border} ${theme.muted} ${touch}`}
              onClick={() => {
                setError(null);
                setSecretGate(false);
                onCancel?.();
              }}
            >
              cancel
            </button>
          )}
        </span>
      </div>

      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={4}
          disabled={pinned || sending}
          placeholder="what broke or what you want. do not paste seeds, keys, or RPC URLs."
          className={`w-full p-2 text-[11px] font-mono bg-transparent border ${theme.border} ${theme.text} ${theme.rounded} ${pinned ? "opacity-70" : ""}`}
        />

        <div className="flex flex-wrap gap-2 items-center text-[10px]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pinned || sending}
            placeholder="email (optional)"
            className={`flex-1 min-w-[120px] p-1.5 bg-transparent border ${theme.border} ${theme.muted} ${theme.rounded}`}
          />
          <label className={`flex items-center gap-1.5 select-none ${pinned ? "opacity-70" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={includeAddress}
              onChange={(e) => setIncludeAddress(e.target.checked)}
              disabled={pinned || sending}
            />
            <span className={theme.muted}>
              include truncated address + theme + chain
            </span>
          </label>
        </div>

        {secretGate && (
          <div className={`p-2 border ${theme.warn} text-[10px]`}>
            {FB_SECRET}
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                className={`px-2 py-1 border ${theme.warn} font-bold ${touch}`}
                onClick={() => void confirmSend()}
              >
                YES
              </button>
              <button
                type="button"
                className={`px-2 py-1 border ${theme.muted} ${touch}`}
                onClick={() => setSecretGate(false)}
              >
                no
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className={`text-[10px] ${theme.warn}`}>
            [!] {error}
          </div>
        )}

        {sending && (
          <div className={`text-[10px] ${theme.muted}`}>sending…</div>
        )}

        {!pinned && (
          <button
            type="button"
            className={`px-3 py-1 border ${theme.border} ${theme.primary} font-bold text-[10px] ${touch}`}
            disabled={sending}
            onClick={() => void send()}
          >
            send feedback
          </button>
        )}
      </div>
    </div>
  );
}
