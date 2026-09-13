/**
 * @file DigEditorWidget.tsx
 * @description Dig Solidity source editor — textarea + line gutter (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThemeConfig } from "../types";
import { saveDigSource } from "../dig/idb";

export default function DigEditorWidget({
  theme,
  filename,
  initialContent,
  mode = "edit",
  onClose,
  onChange
}: {
  theme: ThemeConfig;
  filename: string;
  initialContent: string;
  /** edit = textarea; open = file picker first */
  mode?: "edit" | "open";
  onClose?: () => void;
  onChange?: (filename: string, content: string) => void;
}) {
  const [name, setName] = useState(filename);
  const [content, setContent] = useState(initialContent);
  const [phase, setPhase] = useState<"edit" | "pick">(
    mode === "open" ? "pick" : "edit"
  );
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lines = useMemo(() => {
    const n = content.split("\n").length;
    return Array.from({ length: Math.max(n, 1) }, (_, i) => i + 1);
  }, [content]);

  useEffect(() => {
    setName(filename);
    setContent(initialContent);
  }, [filename, initialContent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const persist = useCallback(
    (fn: string, body: string) => {
      void saveDigSource(fn, body);
      onChange?.(fn, body);
    },
    [onChange]
  );

  const onInput = (v: string) => {
    setContent(v);
    persist(name, v);
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const fn = file.name.endsWith(".sol") ? file.name : `${file.name}.sol`;
    setName(fn);
    setContent(text);
    persist(fn, text);
    setPhase("edit");
  };

  if (phase === "pick") {
    return (
      <div
        className={`relative my-3 p-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-2xl ${theme.text}`}
      >
        <div
          className={`border-b ${theme.border} pb-1 mb-2 text-[10px] tracking-wider flex gap-2`}
        >
          <span className={theme.muted}>SOURCE</span>
          <span className={theme.text}>open .sol</span>
        </div>
        <button
          type="button"
          className={`uppercase text-[10px] px-3 border ${theme.border} ${theme.primary} cursor-pointer min-h-[44px] min-w-[44px] pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] max-md:min-h-[44px]`}
          onClick={() => fileRef.current?.click()}
        >
          Choose .sol file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".sol,text/plain"
          className="hidden"
          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
        />
        <div className={`mt-2 text-[10px] ${theme.muted}`}>
          Esc closes · no silent disk read
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative my-3 border ${theme.border} ${theme.cardBg} ${theme.rounded} max-w-2xl w-full overflow-hidden`}
    >
      <div
        className={`border-b ${theme.border} px-2 py-1 text-[10px] tracking-wider flex gap-2 items-center`}
      >
        <span className={theme.muted}>SOURCE</span>
        <span className={theme.text}>{name}</span>
        <button
          type="button"
          title="Close"
          className={`ml-auto uppercase text-[10px] cursor-pointer ${theme.primary} min-h-[44px] min-w-[44px] flex items-center justify-center`}
          onClick={() => onClose?.()}
        >
          Esc
        </button>
      </div>
      <div className="flex min-h-[12rem] max-h-[50vh]">
        <div
          className={`select-none text-right pr-2 pl-1 py-2 ${theme.muted} tabular-nums text-[9px] leading-[1.4] overflow-hidden shrink-0 border-r ${theme.border}`}
          aria-hidden
        >
          {lines.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          ref={taRef}
          value={content}
          spellCheck={false}
          onChange={(e) => onInput(e.target.value)}
          className={`flex-1 min-w-0 resize-y bg-transparent outline-none p-2 leading-[1.4] ${theme.text} text-[16px] md:text-[12px] font-mono`}
          style={{ overflowWrap: "anywhere" }}
          aria-label={`Source ${name}`}
        />
      </div>
    </div>
  );
}
