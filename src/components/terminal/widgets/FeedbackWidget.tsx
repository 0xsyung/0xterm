/**
 * @file FeedbackWidget.tsx
 * @description Compose widget for the feedback command (#19). v1 opens a
 *   prefilled GitHub new-issue URL — no token, no backend. State is React-only:
 *   drafts are never persisted (they might contain secrets).
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useState } from "react";
import type { ThemeConfig } from "../types";
import PinButton from "./PinButton";
import { redactSecrets, requireFeedbackConfirm } from "../../../lib/redactSecrets";
import {
  buildContextBlock,
  FB_EMPTY,
  FB_LONG,
  FB_OPENED,
  FB_POPUP,
  FB_SECRET,
  feedbackTitle,
  makeFeedbackUrl,
  type MakeFeedbackUrlResult
} from "../../../lib/feedbackUrl";

export default function FeedbackWidget({
  theme,
  signer,
  themeName,
  chainLabel,
  noAddress,
  initialText,
  initialGate,
  initialPopupUrl,
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
  initialPopupUrl?: string | null;
  onLogText?: (text: string, warn?: boolean) => void;
  onCancel?: () => void;
  onPin?: () => void;
  pinned?: boolean;
}) {
  const [text, setText] = useState(initialText || "");
  const [email, setEmail] = useState("");
  const [includeAddress, setIncludeAddress] = useState(!noAddress);
  const [showPreview, setShowPreview] = useState(false);
  const [secretGate, setSecretGate] = useState(initialGate || false);
  const [popupUrl, setPopupUrl] = useState<string | null>(initialPopupUrl || null);
  const [error, setError] = useState<string | null>(null);

  const redacted = redactSecrets(text);
  const confirmNeeded = requireFeedbackConfirm(redacted.hits);

  const build = (): MakeFeedbackUrlResult => {
    const ctx = buildContextBlock({
      theme: themeName,
      chainLabel,
      signer: includeAddress && signer ? signer : null,
      noAddress: !includeAddress,
      email: email.trim() || null
    });
    return makeFeedbackUrl({
      title: feedbackTitle(redacted.text),
      body: redacted.text || FB_EMPTY,
      context: ctx
    });
  };

  // Clipboard mode writes the full markdown and opens the short form URL.
  const fire = async (res: MakeFeedbackUrlResult): Promise<void> => {
    if (res.mode === "clipboard") {
      try {
        await navigator.clipboard.writeText(res.clipboardText);
        onLogText?.(FB_LONG, true);
      } catch {
        // Clipboard unavailable — show the full body as a copy-able block.
        setPopupUrl(res.clipboardText);
        return;
      }
    }
    // `noopener` makes window.open return null even on success, so open
    // without it and null out `opener` manually to keep the security property.
    const win = window.open(res.url, "_blank");
    if (!win) {
      // Popup blocked — the popupUrl block below surfaces the message + URL.
      setPopupUrl(res.url);
      return;
    }
    win.opener = null;
    onLogText?.(FB_OPENED);
  };

  const submit = async () => {
    setError(null);
    setPopupUrl(null);
    if (!redacted.text.trim()) {
      setError(FB_EMPTY);
      return;
    }
    if (confirmNeeded) {
      setSecretGate(true);
      return;
    }
    await fire(build());
  };

  const confirmSend = async () => {
    setSecretGate(false);
    await fire(build());
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
                setPopupUrl(null);
                setSecretGate(false);
                setShowPreview(false);
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
            setShowPreview(false);
          }}
          rows={4}
          disabled={pinned}
          placeholder="what broke or what you want. do not paste seeds, keys, or RPC URLs."
          className={`w-full p-2 text-[11px] font-mono bg-transparent border ${theme.border} ${theme.text} ${theme.rounded} ${pinned ? "opacity-70" : ""}`}
        />

        <div className="flex flex-wrap gap-2 items-center text-[10px]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pinned}
            placeholder="email (optional)"
            className={`flex-1 min-w-[120px] p-1.5 bg-transparent border ${theme.border} ${theme.muted} ${theme.rounded}`}
          />
          <label className={`flex items-center gap-1.5 select-none ${pinned ? "opacity-70" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={includeAddress}
              onChange={(e) => setIncludeAddress(e.target.checked)}
              disabled={pinned}
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

        {popupUrl && (
          <div className="space-y-1">
            <div className={`text-[10px] ${theme.warn}`}>[!] {FB_POPUP}</div>
            <pre className={`p-2 border ${theme.border} ${theme.muted} text-[9px] break-all whitespace-pre-wrap`}>
              {popupUrl}
            </pre>
          </div>
        )}

        {showPreview && (
          <pre
            className={`p-2 border ${theme.border} ${theme.muted} text-[9px] break-words whitespace-pre-wrap`}
          >
            {previewMarkdown()}
          </pre>
        )}

        {!pinned && (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className={`px-3 py-1 border ${theme.border} ${theme.primary} text-[10px] ${touch}`}
              onClick={() => setShowPreview((v) => !v)}
            >
              preview
            </button>
            <button
              type="button"
              className={`px-3 py-1 border ${theme.border} ${theme.primary} font-bold text-[10px] ${touch}`}
              onClick={() => void submit()}
            >
              open github
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // The exact markdown that will go into the GitHub form (clipboard mode shows
  // the full body; open mode shows body + context).
  function previewMarkdown(): string {
    const res = build();
    if (res.mode === "clipboard") return res.clipboardText ?? "";
    const ctx = buildContextBlock({
      theme: themeName,
      chainLabel,
      signer: includeAddress && signer ? signer : null,
      noAddress: !includeAddress,
      email: email.trim() || null
    });
    return `${redacted.text}\n\n${ctx}`;
  }
}
