/**
 * @file TerminalHeader.tsx
 * @description Terminal header component
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

function PrimaryTabSwitch({
  theme,
  primaryTab,
  onPrimaryTabChange,
  socialBadge
}: {
  theme: ThemeConfig;
  primaryTab: PrimaryTab;
  onPrimaryTabChange: (tab: PrimaryTab) => void;
  socialBadge: number;
}) {
  const radius = "rounded-none";
  const fillFg = "#000000";
  const badge = formatBadgeCount(socialBadge);
  const tabs: { id: PrimaryTab; label: string }[] = [
    { id: "terminal", label: "TERMINAL" },
    { id: "social", label: "SOCIAL" },
    { id: "settings", label: "SETTINGS" }
  ];

  return (
    <div
      className="flex items-center gap-1 shrink-0 max-md:basis-full max-md:min-w-0 max-md:overflow-x-auto"
      role="tablist"
      aria-label="Primary surface"
      data-testid="primary-tab-strip"
    >
      {tabs.map((t) => {
        const active = primaryTab === t.id;
        const showBadge = t.id === "social" && badge;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPrimaryTabChange(t.id)}
            className={`relative inline-flex items-center justify-center gap-1 px-2.5 uppercase tracking-widest cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] text-[10px] ${radius} ${
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
            {t.label}
            {showBadge && (
              <span
                className={`inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[9px] leading-none font-bold ${radius}`}
                style={{
                  background: active ? fillFg : theme.phosphor,
                  color: active ? theme.phosphor : fillFg
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

/** Mode switcher (#80) — workspaces + console, mirrors PrimaryTabSwitch. */
function ModeTabs({
  theme,
  mode,
  onModeChange
}: {
  theme: ThemeConfig;
  mode: TerminalMode;
  onModeChange: (m: TerminalMode) => void;
}) {
  const radius = "rounded-none";
  const fillFg = "#000000";
  return (
    <div
      className="flex items-center gap-1 shrink-0"
      role="tablist"
      aria-label="Purpose mode"
    >
      {MODE_ORDER.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onModeChange(m)}
            className={`relative inline-flex items-center justify-center gap-1 px-2.5 uppercase tracking-widest cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] text-[10px] ${radius} ${
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
            {MODE_LABEL[m]}
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
  const modeTabsEl = onModeChange ? (
    <ModeTabs theme={theme} mode={mode} onModeChange={onModeChange} />
  ) : null;
  const switchEl = onPrimaryTabChange ? (
    <PrimaryTabSwitch
      theme={theme}
      primaryTab={primaryTab}
      onPrimaryTabChange={onPrimaryTabChange}
      socialBadge={socialBadge}
    />
  ) : null;

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
  return (
    <div
      className={`absolute top-0 left-0 right-0 z-30 flex items-center gap-x-4 gap-y-1 flex-wrap pl-[calc(0.75rem_+_env(safe-area-inset-left))] pr-[calc(0.75rem_+_env(safe-area-inset-right))] max-md:items-start max-md:py-1 ${theme.primary} ${HEADER_H}`}
      style={{ borderBottom: `2px solid ${theme.phosphor}` }}
    >
      <div className="flex items-center gap-3 flex-wrap min-w-0 max-md:w-full uppercase text-[10px] tracking-widest">
        <span className="font-bold">0xTERM</span>
        <span className="tabular-nums">{clock}</span>
        {modeTabsEl}
        {switchEl}
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
