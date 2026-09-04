/**
 * @file TerminalHeader.tsx
 * @description Terminal header component
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useEffect, useState } from "react";
import type { ThemeConfig, ThemeMode } from "./types";
import { HEADER_H, THEME_ORDER } from "./constants";

function TermLogo({ size, className = "" }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden
    >
      <polygon
        fill="currentColor"
        opacity="0.15"
        points="420.5448,351.0 256.0,446.0 91.4552,351.0 91.4552,161.0 256.0,66.0 420.5448,161.0"
      />
      <polygon
        fill="currentColor"
        opacity="0.35"
        points="411.8846,346.0 256.0,436.0 100.1154,346.0 100.1154,166.0 256.0,76.0 411.8846,166.0"
      />
      <text
        fill="currentColor"
        fontFamily="Arial, sans-serif"
        fontSize="150"
        fontWeight="bold"
        textAnchor="middle"
        x="256"
        y="311"
      >
        0x_
      </text>
    </svg>
  );
}

function formatClock(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatStamp(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TerminalHeader({
  theme,
  currentThemeKey,
  onThemeChange,
  onCommand,
  chainName
}: {
  theme: ThemeConfig;
  currentThemeKey: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onCommand?: (cmd: string) => void;
  chainName?: string;
}) {
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [stamp] = useState(() => formatStamp(new Date()));
  const hClass = HEADER_H[theme.headerStyle];

  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(currentThemeKey);
    const next = THEME_ORDER[(idx + 1 + THEME_ORDER.length) % THEME_ORDER.length];
    onThemeChange(next);
  };

  useEffect(() => {
    if (theme.headerStyle !== "bloomberg") return;
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, [theme.headerStyle]);

  // Real F1–F5 match the header buttons. Capture so the prompt and the
  // browser (F1 help) do not swallow them. Other themes leave F-keys alone.
  useEffect(() => {
    if (theme.headerStyle !== "bloomberg") return;
    const run: Record<string, () => void> = {
      F1: () => onCommand?.("help"),
      F2: () => onCommand?.("networks"),
      F3: () => onCommand?.("dexes"),
      F4: cycleTheme,
      F5: () => onCommand?.("swap")
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const fn = run[e.key];
      if (!fn) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      fn();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [theme.headerStyle, currentThemeKey, onCommand, onThemeChange]);

  if (theme.headerStyle === "crt") {
    return (
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 rounded-none border-b ${theme.border} ${hClass}`}
      >
        <div className={`flex items-center gap-2 ${theme.primary}`}>
          <TermLogo size={20} />
          <span className="tracking-widest text-[12px]">0xTERM</span>
        </div>
        <span className={`uppercase text-[10px] ${theme.muted}`}>{theme.name}</span>
      </div>
    );
  }

  if (theme.headerStyle === "bloomberg") {
    const keys: { id: string; label: string; run: () => void }[] = [
      { id: "F1", label: "HELP", run: () => onCommand?.("help") },
      { id: "F2", label: "NET", run: () => onCommand?.("networks") },
      { id: "F3", label: "DEX", run: () => onCommand?.("dexes") },
      { id: "F4", label: "THEME", run: cycleTheme },
      { id: "F5", label: "SWAP", run: () => onCommand?.("swap") }
    ];
    return (
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center gap-4 flex-wrap pl-[calc(0.75rem_+_env(safe-area-inset-left))] pr-[calc(0.75rem_+_env(safe-area-inset-right))] max-md:items-start max-md:py-1 ${theme.primary} ${hClass}`}
        style={{ borderBottom: `2px solid ${theme.phosphor}` }}
      >
        <div className="flex items-center gap-3 shrink-0 uppercase text-[10px] tracking-widest">
          <span className="font-bold">0xTERM</span>
          <span className="tabular-nums">{clock}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap uppercase text-[10px] tracking-widest max-md:w-full max-md:justify-between">
          {keys.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={k.run}
                className="cursor-pointer bg-transparent border-0 p-0 uppercase text-[10px] tracking-widest max-md:min-h-[44px] max-md:flex max-md:items-center"
                title={k.label}
              >
                {k.id} {k.label}
              </button>
          ))}
        </div>
      </div>
    );
  }

  if (theme.headerStyle === "macintosh") {
    return (
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center px-3 border-b border-white/10 ${hClass}`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full"
            style={{ width: 12, height: 12, background: "#ff5f57" }}
          />
          <span
            className="rounded-full"
            style={{ width: 12, height: 12, background: "#febc2e" }}
          />
          <span
            className="rounded-full"
            style={{ width: 12, height: 12, background: "#28c840" }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`font-mac text-[13px] ${theme.muted}`}>
            0xterm — bash
          </span>
        </div>
      </div>
    );
  }

  if (theme.headerStyle === "ibm") {
    return (
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-2 ${theme.primary} ${hClass}`}
        style={{
          borderBottom: `1px solid color-mix(in srgb, ${theme.phosphor} 40%, transparent)`
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="px-1 text-[11px] font-bold tracking-widest"
            style={{ background: theme.phosphor, color: "#000" }}
          >
            0xTERM
          </span>
          <span className="text-[11px] tracking-wide">IBM 3270</span>
        </div>
        <span className="text-[11px] uppercase tracking-widest">
          {chainName ? `NET ${chainName}` : "X SYSTEM"}
        </span>
      </div>
    );
  }

  if (theme.headerStyle === "dos") {
    return (
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-2 text-[12px] font-bold tracking-wide ${hClass}`}
        style={{ background: "#aaaaaa", color: "#000000" }}
      >
        <span>0xTERM.EXE</span>
        <span>{theme.name}</span>
      </div>
    );
  }

  if (theme.headerStyle === "teletype") {
    return (
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center px-3 border-b ${theme.border} ${hClass}`}
      >
        <span className={`text-[11px] ${theme.primary}`}>
          0xTERM / {stamp}
        </span>
      </div>
    );
  }

  // void
  return (
    <div
      className={`absolute top-0 left-0 right-0 z-30 flex items-center gap-2 px-3 border-b border-white/10 ${hClass}`}
    >
      <span className={`${theme.primary} opacity-50`}>
        <TermLogo size={16} />
      </span>
      <span className={`lowercase tracking-tight ${theme.muted}`}>0xterm</span>
    </div>
  );
}
