/**
 * @file DigAbiWidget.tsx
 * @description Dig ABI JSON card with COPY (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useState } from "react";
import type { ThemeConfig } from "../types";
import type { DigAbiItem } from "../dig/artifact";

export default function DigAbiWidget({
  name,
  abi,
  theme,
  onCopied
}: {
  name: string;
  abi: DigAbiItem[];
  theme: ThemeConfig;
  onCopied?: () => void;
}) {
  const [ack, setAck] = useState(false);
  const json = JSON.stringify(abi, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setAck(true);
      onCopied?.();
      setTimeout(() => setAck(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`relative my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-xl ${theme.text}`}
    >
      <div
        className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider flex items-center gap-2`}
      >
        <span className={theme.primary}>ABI</span>
        <span className={theme.muted}>{name}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className={`ml-auto uppercase text-[10px] px-2 border ${theme.border} ${theme.primary} cursor-pointer min-h-[44px] min-w-[44px] pointer-coarse:min-h-[44px] max-md:min-h-[44px]`}
        >
          COPY
        </button>
      </div>
      <pre
        className={`text-[10px] whitespace-pre-wrap m-0 ${theme.text}`}
        style={{ overflowWrap: "anywhere" }}
      >
        {json}
      </pre>
      {ack && (
        <div className={`mt-2 text-[10px] ${theme.primary}`}>
          [✓] Copied ABI.
        </div>
      )}
    </div>
  );
}
