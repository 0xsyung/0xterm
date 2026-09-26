/**
 * @file TerminalHeader.tsx
 * @description Terminal header — logo + single nav strip + CONSOLE-only F-row (#117)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useEffect, useState } from "react";
import type { ThemeConfig } from "./types";
import { HEADER_H } from "./constants";
import { MODE_LABEL, MODE_ORDER } from "./mode";
import type { TerminalMode } from "./mode";
import type { PrimaryTab } from "./socialUnread";
import { formatBadgeCount } from "./socialUnread";
import { formatLocalHms } from "./localTime";
import type { BindingsState, FKey } from "./keybindings";
import { FKEYS, defaultBindings, resolveBinding } from "./keybindings";

function formatClock(d: Date) {
  return formatLocalHms(d);
}

const FILL_FG = "#000000";

/**
 * Single strip: INVEST · DEV · FORENSIC · CONSOLE · SOCIAL · SETTINGS.
 * Only one chip active across the whole strip (mode OR social OR settings).
 * Mode chips clear primary-tab "terminal" surface; SOCIAL/SETTINGS are peers.
 */
function NavStrip({
  theme,
  mode,
  onModeChange,
  primaryTab,
  onPrimaryTabChange,
  socialBadge
}: {
  theme: ThemeConfig;
  mode: TerminalMode;
  onModeChange?: (m: TerminalMode) => void;
  primaryTab: PrimaryTab;
  onPrimaryTabChange?: (tab: PrimaryTab) => void;
  socialBadge: number;
}) {
  const radius = "rounded-none";
  const badge = formatBadgeCount(socialBadge);
  const surfaceIsMode = primaryTab === "terminal";

  return (
    <div
      className="flex items-center gap-1 shrink-0 min-w-0 max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Surface"
      data-testid="nav-strip"
    >
      {MODE_ORDER.map((m) => {
        const active = surfaceIsMode && mode === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              onModeChange?.(m);
              onPrimaryTabChange?.("terminal");
            }}
            className={`relative inline-flex items-center justify-center gap-1 px-2.5 uppercase tracking-widest cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] text-[10px] shrink-0 ${radius} ${
              active
                ? "border border-transparent font-bold"
                : `border ${theme.border} ${theme.muted} bg-transparent`
            }`}
            style={
              active
                ? { background: theme.phosphor, color: FILL_FG }
                : undefined
            }
          >
            {MODE_LABEL[m]}
          </button>
        );
      })}

      <span
        className={`px-1 select-none ${theme.muted}`}
        aria-hidden
        data-testid="nav-separator"
      >
        ·
      </span>

      {(
        [
          { id: "social" as const, label: "SOCIAL" },
          { id: "settings" as const, label: "SETTINGS" }
        ] as const
      ).map((t) => {
        const active = primaryTab === t.id;
        const showBadge = t.id === "social" && badge;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPrimaryTabChange?.(t.id)}
            className={`relative inline-flex items-center justify-center gap-1 px-2.5 uppercase tracking-widest cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] text-[10px] shrink-0 ${radius} ${
              active
                ? "border border-transparent font-bold"
                : `border ${theme.border} ${theme.muted} bg-transparent`
            }`}
            style={
              active
                ? { background: theme.phosphor, color: FILL_FG }
                : undefined
            }
          >
            {t.label}
            {showBadge && (
              <span
                className={`inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[9px] leading-none font-bold ${radius}`}
                style={{
                  background: active ? FILL_FG : theme.phosphor,
                  color: active ? theme.phosphor : FILL_FG
                }}
                aria-label={`${badge} unread`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function TerminalHeader({
  theme,
  onCommand,
  mode = "invest",
  onModeChange,
  primaryTab = "terminal",
  onPrimaryTabChange,
  socialBadge = 0,
  bindings
}: {
  theme: ThemeConfig;
  onCommand?: (cmd: string) => void;
  mode?: TerminalMode;
  onModeChange?: (m: TerminalMode) => void;
  primaryTab?: PrimaryTab;
  onPrimaryTabChange?: (tab: PrimaryTab) => void;
  socialBadge?: number;
  /** Live bindings keymap — the header F-row mirrors it (#28). */
  bindings?: BindingsState;
}) {
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  const resolve = (key: FKey) =>
    bindings ? resolveBinding(bindings, key) : resolveBinding(defaultBindings(), key);
  // Header button label: F4 theme cycling → THEME; else first token uppercased,
  // truncated to 6 chars; cleared → —.
  const labelFor = (cmd: string): string => {
    if (!cmd) return "—";
    const first = cmd.split(/\s+/)[0].toUpperCase();
    return first === "THEME" ? "THEME" : first.slice(0, 6);
  };
  const keys: { id: string; label: string; run: () => void }[] = FKEYS.slice(
    0,
    5
  ).map((k) => {
    const r = resolve(k);
    return {
      id: k,
      label: labelFor(r.cmd),
      run: () => r.cmd && onCommand?.(r.cmd)
    };
  });

  // F-row is CONSOLE-only (slice 1 chrome floor §2).
  const showFRow =
    primaryTab === "terminal" && mode === "console" && !!onCommand;

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-30 flex items-center gap-x-4 gap-y-1 flex-wrap pl-[calc(0.75rem_+_env(safe-area-inset-left))] pr-[calc(0.75rem_+_env(safe-area-inset-right))] max-md:items-start max-md:py-1 ${theme.primary} ${HEADER_H}`}
      style={{ borderBottom: `2px solid ${theme.phosphor}` }}
    >
      <div className="flex items-center gap-3 flex-wrap min-w-0 max-md:w-full uppercase text-[10px] tracking-widest">
        {/* Brand cluster: logo mandatory; wordmark optional (hides max-md). */}
        <div
          className="flex items-center gap-2 shrink-0"
          data-testid="brand-cluster"
        >
          <img
            src="/logo.svg"
            alt="0xTERM"
            width={20}
            height={20}
            className="w-5 h-5 pointer-coarse:w-6 pointer-coarse:h-6 shrink-0"
            draggable={false}
            data-testid="header-logo"
          />
          <span className={`font-bold max-md:hidden ${theme.primary}`}>
            0xTERM
          </span>
        </div>
        <span className="tabular-nums">{clock}</span>
        {(onModeChange || onPrimaryTabChange) && (
          <NavStrip
            theme={theme}
            mode={mode}
            onModeChange={onModeChange}
            primaryTab={primaryTab}
            onPrimaryTabChange={onPrimaryTabChange}
            socialBadge={socialBadge}
          />
        )}
      </div>
      {showFRow && (
        <div
          className="flex items-center gap-3 flex-wrap uppercase text-[10px] tracking-widest max-md:w-full max-md:justify-between"
          data-testid="fkey-row"
        >
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
      )}
    </div>
  );
}
