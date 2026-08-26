/**
 * @file ChatWidget.tsx
 * @description Encrypted 1:1 message thread widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import React, { useState } from "react";
import PinButton from "./PinButton";

export type ChatMessage = {
  from: string;
  timestamp: number;
  iv: string; // 0x-prefixed hex, 12 bytes
  ciphertext: string; // 0x-prefixed hex
  decrypted?: string; // set when decryptable in-browser
  decryptFailed?: boolean;
};

export default function ChatWidget({
  messages,
  peer,
  self,
  theme,
  peerLabel,
  onPin,
  pinned
}: {
  messages: ChatMessage[];
  peer: string;
  self?: string;
  theme: any;
  peerLabel?: string;
  onPin?: () => void;
  pinned?: boolean;
}) {
  const shortPeer = `${peer.slice(0, 6)}…${peer.slice(-4)}`;
  const label = peerLabel || shortPeer;
  const [copied, setCopied] = useState(false);

  const copyPeer = async () => {
    try {
      await navigator.clipboard.writeText(peer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div
      className={`relative group my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} text-xs space-y-2 max-w-2xl`}
    >
      {!pinned && (
        <PinButton
          onPin={onPin}
          theme={theme}
          className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
      <div
        className={`flex justify-between items-center ${theme.text}/70 border-b ${theme.border} pb-1`}
      >
        <span className="font-bold flex items-center gap-1.5" title={peer}>
          CHAT · from {label}
          <button
            type="button"
            onClick={copyPeer}
            title={`Copy ${peer} to reply`}
            className={`uppercase text-[10px] underline cursor-pointer ${theme.primary}`}
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </span>
        <span className="uppercase text-[10px]">encrypted on-chain</span>
      </div>
      {messages.length === 0 ? (
        <div className={`${theme.text}/50`}>
          No messages in this conversation.
        </div>
      ) : (
        messages.map((m, i) => {
          const isSelf = self ? m.from.toLowerCase() === self.toLowerCase() : false;
          const time = new Date(m.timestamp * 1000).toLocaleTimeString();
          return (
            <div
              key={i}
              className={`flex flex-col gap-0.5 ${
                isSelf ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`px-3 py-1.5 rounded ${
                  isSelf
                    ? `${theme.primary} bg-black/40`
                    : `${theme.text} bg-black/30`
                } ${theme.border} border`}
              >
                {m.decryptFailed ? (
                  <span className="text-red-400">[cannot decrypt — wrong key]</span>
                ) : m.decrypted !== undefined ? (
                  m.decrypted
                ) : (
                  <span className="opacity-60">[encrypted — run inbox to decrypt]</span>
                )}
              </div>
              <div className={`text-[10px] ${theme.text}/50`}>
                {isSelf
                  ? "you"
                  : `from ${m.from.toLowerCase() === peer.toLowerCase() ? label : `${m.from.slice(0, 6)}…${m.from.slice(-4)}`}`}{" "}
                · {time}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
