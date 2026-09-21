/**
 * @file SettingsPanel.tsx
 * @description Bloomberg Settings surface — RPC, tokens, theme, channels, mode, export (#81)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import React, { useMemo, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import type { ThemeConfig, ThemeMode, CustomTokensMap, CustomTokenEntry, PinnedManifest } from "../types";
import type { RpcProviders, ActiveRpcProviders } from "../rpc";
import type { TerminalMode } from "../mode";
import { MODE_LABEL, MODE_ORDER } from "../mode";
import { SUPPORTED_CHAINS, THEME_ORDER, THEMES } from "../constants";
import type { ChannelStore, ChatChannel } from "../chatChannels";
import {
  channelId,
  formatChannelLabel,
  listChannelsOrdered,
  shortAddress
} from "../chatChannels";
import {
  applyImportBlob,
  buildExportBlob,
  maskSecret,
  parseImportJson,
  truncateMid
} from "../settingsPrefs";

const FILL_FG = "#000000";

function SectionLabel({
  theme,
  children
}: {
  theme: ThemeConfig;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`sticky top-0 z-[1] uppercase tracking-widest text-[10px] py-1 ${theme.muted} ${theme.bg}`}
    >
      {children}
    </div>
  );
}

function PhosphorChip({
  theme,
  label,
  onClick,
  disabled,
  warn
}: {
  theme: ThemeConfig;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center px-2 py-0.5 uppercase tracking-widest text-[10px] cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] rounded-none font-bold disabled:opacity-40 disabled:cursor-not-allowed border ${
        warn ? theme.warn : "border-transparent"
      }`}
      style={
        warn ? undefined : { background: theme.phosphor, color: FILL_FG }
      }
    >
      {label}
    </button>
  );
}

function GhostChip({
  theme,
  label,
  onClick,
  disabled
}: {
  theme: ThemeConfig;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center px-2 py-0.5 uppercase tracking-widest text-[10px] cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] rounded-none border ${theme.border} ${theme.muted} bg-transparent disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

function FieldInput({
  theme,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
  title
}: {
  theme: ThemeConfig;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      title={title}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full min-w-0 px-1.5 py-0.5 text-[11px] outline-none border ${theme.border} ${theme.bg} ${theme.text} ${
        mono ? "font-mono tabular-nums" : "font-mono"
      } rounded-none`}
      style={{ caretColor: theme.phosphor }}
    />
  );
}

export type SettingsPanelProps = {
  theme: ThemeConfig;
  currentThemeKey: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  mode: TerminalMode;
  onModeChange: (mode: TerminalMode) => void;
  rpcProviders: RpcProviders;
  activeRpcProviders: ActiveRpcProviders;
  onRpcChange: (
    next: RpcProviders,
    active: ActiveRpcProviders
  ) => void;
  customTokens: CustomTokensMap;
  onCustomTokensChange: (next: CustomTokensMap) => void;
  channelStore: ChannelStore;
  onChannelStoreChange: (next: ChannelStore) => void;
  pinned: PinnedManifest[];
  onPinnedChange: (next: PinnedManifest[]) => void;
  walletAddress: string | null;
  isConnected: boolean;
  /** Existing wallet prefs blob (for export merge). */
  existingPreferences?: Record<string, unknown>;
  /** Apply full import (persist + React state). */
  onApplyImport: (patch: ReturnType<typeof applyImportBlob>) => void;
};

export default function SettingsPanel(props: SettingsPanelProps) {
  const {
    theme,
    currentThemeKey,
    onThemeChange,
    mode,
    onModeChange,
    rpcProviders,
    activeRpcProviders,
    onRpcChange,
    customTokens,
    onCustomTokensChange,
    channelStore,
    onChannelStoreChange,
    pinned,
    onPinnedChange: _onPinnedChange,
    walletAddress,
    isConnected,
    existingPreferences,
    onApplyImport
  } = props;

  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [rpcDraft, setRpcDraft] = useState({
    chainId: String(SUPPORTED_CHAINS[0]?.id ?? 1),
    name: "",
    url: ""
  });
  const [tokenDraft, setTokenDraft] = useState({
    symbol: "",
    address: "",
    chainId: String(SUPPORTED_CHAINS[0]?.id ?? 1),
    decimals: "18",
    tokenType: "erc20" as "erc20" | "erc721",
    isNative: false
  });
  const [channelDraft, setChannelDraft] = useState({
    name: "",
    address: "",
    chainId: String(SUPPORTED_CHAINS[0]?.id ?? 1)
  });
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importConfirm, setImportConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const rpcRows = useMemo(() => {
    const rows: {
      key: string;
      chainId: number;
      chainName: string;
      name: string;
      url: string;
      active: boolean;
    }[] = [];
    for (const chain of SUPPORTED_CHAINS) {
      const providers = rpcProviders[chain.id] || {};
      const active = activeRpcProviders[chain.id] || "default";
      for (const [name, url] of Object.entries(providers)) {
        rows.push({
          key: `${chain.id}:${name}`,
          chainId: chain.id,
          chainName: chain.name,
          name,
          url,
          active: active === name
        });
      }
    }
    return rows;
  }, [rpcProviders, activeRpcProviders]);

  const tokenRows = useMemo(() => {
    const rows: (CustomTokenEntry & { chainId: number; chainName: string })[] =
      [];
    for (const chain of SUPPORTED_CHAINS) {
      for (const t of customTokens[chain.id] || []) {
        rows.push({
          ...t,
          chainId: chain.id,
          chainName: chain.name
        });
      }
    }
    return rows;
  }, [customTokens]);

  const channels = useMemo(
    () => listChannelsOrdered(channelStore),
    [channelStore]
  );

  const toggleReveal = (key: string) =>
    setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  const setActiveRpc = (chainId: number, name: string) => {
    onRpcChange(rpcProviders, { ...activeRpcProviders, [chainId]: name });
  };

  const removeRpc = (chainId: number, name: string) => {
    const updated = { ...(rpcProviders[chainId] || {}) };
    delete updated[name];
    const nextProviders = { ...rpcProviders, [chainId]: updated };
    const nextActive = { ...activeRpcProviders };
    if (nextActive[chainId] === name) nextActive[chainId] = "default";
    onRpcChange(nextProviders, nextActive);
    setPendingRemove(null);
  };

  const addRpc = () => {
    const chainId = Number(rpcDraft.chainId);
    const name = rpcDraft.name.trim().toLowerCase();
    const url = rpcDraft.url.trim();
    if (!name || !url.startsWith("http")) {
      setStatusMsg("RPC add needs a name and http(s) URL.");
      return;
    }
    if (name === "default") {
      setStatusMsg("Cannot override default public RPC via Settings.");
      return;
    }
    const updated = {
      ...(rpcProviders[chainId] || {}),
      [name]: url
    };
    onRpcChange(
      { ...rpcProviders, [chainId]: updated },
      { ...activeRpcProviders, [chainId]: name }
    );
    setRpcDraft((d) => ({ ...d, name: "", url: "" }));
    setStatusMsg(null);
  };

  const removeToken = (chainId: number, id: string) => {
    const list = (customTokens[chainId] || []).filter((t) => t.id !== id);
    const next = { ...customTokens };
    if (list.length === 0) delete next[chainId];
    else next[chainId] = list;
    onCustomTokensChange(next);
    setPendingRemove(null);
  };

  const addToken = () => {
    const chainId = Number(tokenDraft.chainId);
    const symbol = tokenDraft.symbol.trim().toUpperCase();
    let addr = tokenDraft.address.trim();
    if (!symbol || !addr) {
      setStatusMsg("Token needs symbol and address.");
      return;
    }
    if (!isAddress(addr)) {
      setStatusMsg("Invalid token address.");
      return;
    }
    addr = getAddress(addr);
    const list = customTokens[chainId] || [];
    if (list.some((t) => t.address.toLowerCase() === addr.toLowerCase())) {
      setStatusMsg("Address already registered on that chain.");
      return;
    }
    const entry: CustomTokenEntry = {
      id: `c_${addr.toLowerCase()}`,
      address: addr as Address,
      symbol,
      name: symbol,
      decimals:
        tokenDraft.tokenType === "erc20"
          ? Number(tokenDraft.decimals) || 18
          : undefined,
      tokenType: tokenDraft.tokenType,
      isNative: !!tokenDraft.isNative
    };
    onCustomTokensChange({
      ...customTokens,
      [chainId]: [...list, entry]
    });
    setTokenDraft((d) => ({
      ...d,
      symbol: "",
      address: "",
      decimals: "18",
      isNative: false
    }));
    setStatusMsg(null);
  };

  const updateToken = (
    chainId: number,
    id: string,
    patch: Partial<CustomTokenEntry>
  ) => {
    const list = (customTokens[chainId] || []).map((t) =>
      t.id === id ? { ...t, ...patch } : t
    );
    onCustomTokensChange({ ...customTokens, [chainId]: list });
  };

  const setActiveChannel = (ch: ChatChannel) => {
    onChannelStoreChange({
      ...channelStore,
      activeId: channelId(ch.chainId, ch.address)
    });
  };

  const removeChannel = (ch: ChatChannel) => {
    const id = channelId(ch.chainId, ch.address);
    const nextChannels = channelStore.channels.filter(
      (c) => channelId(c.chainId, c.address) !== id
    );
    const nextActive =
      channelStore.activeId === id ? null : channelStore.activeId;
    onChannelStoreChange({ channels: nextChannels, activeId: nextActive });
    setPendingRemove(null);
  };

  const addChannel = () => {
    const chainId = Number(channelDraft.chainId);
    let addr = channelDraft.address.trim();
    if (!addr || !isAddress(addr)) {
      setStatusMsg("Channel needs a valid address.");
      return;
    }
    addr = getAddress(addr);
    const id = channelId(chainId, addr);
    if (
      channelStore.channels.some(
        (c) => channelId(c.chainId, c.address) === id
      )
    ) {
      setStatusMsg("Channel already saved.");
      return;
    }
    const ch: ChatChannel = {
      chainId,
      address: addr as Address,
      name: channelDraft.name.trim(),
      source: "saved"
    };
    onChannelStoreChange({
      channels: [...channelStore.channels, ch],
      activeId: id
    });
    setChannelDraft((d) => ({ ...d, name: "", address: "" }));
    setStatusMsg(null);
  };

  const handleExport = async () => {
    const blob = buildExportBlob({
      wallet: walletAddress,
      theme: currentThemeKey,
      mode,
      rpcProviders,
      activeRpcProviders,
      customTokens,
      pinned,
      channelStore,
      existingPreferences
    });
    const json = JSON.stringify(blob, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setStatusMsg("Export copied to clipboard.");
    } catch {
      // fallback: download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([json], { type: "application/json" })
      );
      a.download = "0xterm-settings.json";
      a.click();
      setStatusMsg("Export downloaded.");
    }
  };

  const tryImport = () => {
    const parsed = parseImportJson(importText);
    if (!parsed.ok) {
      setImportError(parsed.error);
      setImportConfirm(false);
      return;
    }
    setImportError(null);
    setImportConfirm(true);
  };

  const confirmImport = () => {
    const parsed = parseImportJson(importText);
    if (!parsed.ok) {
      setImportError(parsed.error);
      setImportConfirm(false);
      return;
    }
    const patch = applyImportBlob(parsed.data, channelStore);
    onApplyImport(patch);
    setImportConfirm(false);
    setImportText("");
    setStatusMsg("Import applied.");
  };

  return (
    <div
      className="h-full min-h-0 min-w-0 overflow-y-auto pt-2 pr-1 space-y-3 text-[11px] font-mono"
      data-testid="settings-panel"
      data-retain-focus
    >
      {statusMsg && (
        <div className={`${theme.muted} text-[11px]`}>{statusMsg}</div>
      )}

      {/* 1. RPC */}
      <section className="space-y-1.5">
        <SectionLabel theme={theme}>RPC / API providers</SectionLabel>
        {!isConnected && (
          <div className={theme.muted}>Connect wallet to manage RPC providers.</div>
        )}
        {isConnected && rpcRows.length === 0 && (
          <div className={theme.muted}>No providers</div>
        )}
        {isConnected && rpcRows.length > 0 && (
          <div className={`border ${theme.border}`}>
            <div
              className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,2fr)_auto_auto] gap-1 px-1 py-0.5 uppercase tracking-widest text-[10px] ${theme.muted} border-b ${theme.border}`}
            >
              <span>Chain</span>
              <span>Provider</span>
              <span>Key</span>
              <span>Active</span>
              <span />
            </div>
            {rpcRows.map((row) => {
              const reveal = !!revealedKeys[row.key];
              const confirmKey = `rpc:${row.key}`;
              return (
                <div
                  key={row.key}
                  className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,2fr)_auto_auto] gap-1 px-1 py-0.5 items-center border-b ${theme.border} last:border-b-0 ${
                    row.active ? "border-l-2" : ""
                  }`}
                  style={
                    row.active
                      ? { borderLeftColor: theme.phosphor }
                      : undefined
                  }
                >
                  <span className="truncate" title={row.chainName}>
                    {row.chainName}
                  </span>
                  <span className="uppercase truncate">{row.name}</span>
                  <span className="font-mono tabular-nums truncate" title={reveal ? row.url : undefined}>
                    {maskSecret(row.url, { reveal })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveRpc(row.chainId, row.name)}
                    className={`uppercase text-[10px] px-1 border ${theme.border} cursor-pointer pointer-coarse:min-h-[44px]`}
                    style={
                      row.active
                        ? { background: theme.phosphor, color: FILL_FG }
                        : undefined
                    }
                  >
                    {row.active ? "ON" : "SET"}
                  </button>
                  <div className="flex items-center gap-1">
                    <GhostChip
                      theme={theme}
                      label={reveal ? "HIDE" : "SHOW"}
                      onClick={() => toggleReveal(row.key)}
                    />
                    {pendingRemove === confirmKey ? (
                      <>
                        <PhosphorChip
                          theme={theme}
                          label="Confirm"
                          warn
                          onClick={() => removeRpc(row.chainId, row.name)}
                        />
                        <GhostChip
                          theme={theme}
                          label="Cancel"
                          onClick={() => setPendingRemove(null)}
                        />
                      </>
                    ) : (
                      <GhostChip
                        theme={theme}
                        label="Remove"
                        onClick={() => setPendingRemove(confirmKey)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {isConnected && (
          <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_auto] gap-1 items-center">
            <select
              value={rpcDraft.chainId}
              onChange={(e) =>
                setRpcDraft((d) => ({ ...d, chainId: e.target.value }))
              }
              className={`border ${theme.border} ${theme.bg} ${theme.text} text-[11px] font-mono px-1 py-0.5`}
            >
              {SUPPORTED_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldInput
              theme={theme}
              value={rpcDraft.name}
              onChange={(v) => setRpcDraft((d) => ({ ...d, name: v }))}
              placeholder="name"
            />
            <FieldInput
              theme={theme}
              value={rpcDraft.url}
              onChange={(v) => setRpcDraft((d) => ({ ...d, url: v }))}
              placeholder="https://…"
              mono
            />
            <PhosphorChip theme={theme} label="Add" onClick={addRpc} />
          </div>
        )}
      </section>

      {/* 2. Tokens */}
      <section className="space-y-1.5">
        <SectionLabel theme={theme}>Custom tokens</SectionLabel>
        {!isConnected && (
          <div className={theme.muted}>Connect wallet to manage custom tokens.</div>
        )}
        {isConnected && tokenRows.length === 0 && (
          <div className={theme.muted}>No custom tokens</div>
        )}
        {isConnected && tokenRows.length > 0 && (
          <div className={`border ${theme.border} overflow-x-auto`}>
            <div
              className={`grid grid-cols-[4rem_minmax(6rem,1.5fr)_minmax(4rem,1fr)_3.5rem_4rem_3.5rem_auto] gap-1 px-1 py-0.5 uppercase tracking-widest text-[10px] ${theme.muted} border-b ${theme.border} min-w-[36rem]`}
            >
              <span>Symbol</span>
              <span>Address</span>
              <span>Chain</span>
              <span>Dec</span>
              <span>Type</span>
              <span>Native</span>
              <span />
            </div>
            {tokenRows.map((t) => {
              const confirmKey = `tok:${t.chainId}:${t.id}`;
              return (
                <div
                  key={`${t.chainId}:${t.id}`}
                  className={`grid grid-cols-[4rem_minmax(6rem,1.5fr)_minmax(4rem,1fr)_3.5rem_4rem_3.5rem_auto] gap-1 px-1 py-0.5 items-center border-b ${theme.border} last:border-b-0 min-w-[36rem]`}
                >
                  <FieldInput
                    theme={theme}
                    value={t.symbol}
                    onChange={(v) =>
                      updateToken(t.chainId, t.id, {
                        symbol: v.toUpperCase()
                      })
                    }
                  />
                  <span
                    className="font-mono tabular-nums truncate"
                    title={t.address}
                  >
                    {truncateMid(t.address, 6, 4)}
                  </span>
                  <span className="truncate">{t.chainName}</span>
                  <FieldInput
                    theme={theme}
                    value={
                      t.decimals !== undefined ? String(t.decimals) : ""
                    }
                    onChange={(v) =>
                      updateToken(t.chainId, t.id, {
                        decimals: v === "" ? undefined : Number(v) || 0
                      })
                    }
                    mono
                  />
                  <select
                    value={t.tokenType || "erc20"}
                    onChange={(e) =>
                      updateToken(t.chainId, t.id, {
                        tokenType: e.target.value as "erc20" | "erc721"
                      })
                    }
                    className={`border ${theme.border} ${theme.bg} ${theme.text} text-[11px] font-mono`}
                  >
                    <option value="erc20">erc20</option>
                    <option value="erc721">erc721</option>
                  </select>
                  <input
                    type="checkbox"
                    checked={!!t.isNative}
                    onChange={(e) =>
                      updateToken(t.chainId, t.id, {
                        isNative: e.target.checked
                      })
                    }
                  />
                  {pendingRemove === confirmKey ? (
                    <div className="flex gap-1">
                      <PhosphorChip
                        theme={theme}
                        label="Confirm"
                        warn
                        onClick={() => removeToken(t.chainId, t.id)}
                      />
                      <GhostChip
                        theme={theme}
                        label="Cancel"
                        onClick={() => setPendingRemove(null)}
                      />
                    </div>
                  ) : (
                    <GhostChip
                      theme={theme}
                      label="Remove"
                      onClick={() => setPendingRemove(confirmKey)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {isConnected && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-1 items-center">
            <FieldInput
              theme={theme}
              value={tokenDraft.symbol}
              onChange={(v) => setTokenDraft((d) => ({ ...d, symbol: v }))}
              placeholder="SYMBOL"
            />
            <FieldInput
              theme={theme}
              value={tokenDraft.address}
              onChange={(v) => setTokenDraft((d) => ({ ...d, address: v }))}
              placeholder="0x…"
              mono
            />
            <select
              value={tokenDraft.chainId}
              onChange={(e) =>
                setTokenDraft((d) => ({ ...d, chainId: e.target.value }))
              }
              className={`border ${theme.border} ${theme.bg} ${theme.text} text-[11px] font-mono px-1`}
            >
              {SUPPORTED_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldInput
              theme={theme}
              value={tokenDraft.decimals}
              onChange={(v) => setTokenDraft((d) => ({ ...d, decimals: v }))}
              placeholder="decimals"
              mono
            />
            <select
              value={tokenDraft.tokenType}
              onChange={(e) =>
                setTokenDraft((d) => ({
                  ...d,
                  tokenType: e.target.value as "erc20" | "erc721"
                }))
              }
              className={`border ${theme.border} ${theme.bg} ${theme.text} text-[11px] font-mono`}
            >
              <option value="erc20">erc20</option>
              <option value="erc721">erc721</option>
            </select>
            <PhosphorChip theme={theme} label="Add" onClick={addToken} />
          </div>
        )}
      </section>

      {/* 3. Theme */}
      <section className="space-y-1.5">
        <SectionLabel theme={theme}>Theme</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {THEME_ORDER.map((key) => {
            const active = currentThemeKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onThemeChange(key)}
                className={`inline-flex items-center justify-center px-2 py-0.5 uppercase tracking-widest text-[10px] cursor-pointer pointer-coarse:min-h-[44px] rounded-none border ${
                  active
                    ? "border-transparent font-bold"
                    : `${theme.border} ${theme.muted} bg-transparent`
                }`}
                style={
                  active
                    ? { background: theme.phosphor, color: FILL_FG }
                    : undefined
                }
                title={THEMES[key].name}
              >
                {key}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Channels */}
      <section className="space-y-1.5">
        <SectionLabel theme={theme}>Channels</SectionLabel>
        {channels.length === 0 && (
          <div className={theme.muted}>No channels</div>
        )}
        {channels.length > 0 && (
          <div className={`border ${theme.border}`}>
            <div
              className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] gap-1 px-1 py-0.5 uppercase tracking-widest text-[10px] ${theme.muted} border-b ${theme.border}`}
            >
              <span>Name</span>
              <span>Address</span>
              <span>Chain</span>
              <span>Active</span>
              <span />
            </div>
            {channels.map((ch) => {
              const id = channelId(ch.chainId, ch.address);
              const active = channelStore.activeId === id;
              const confirmKey = `ch:${id}`;
              const chain = SUPPORTED_CHAINS.find((c) => c.id === ch.chainId);
              return (
                <div
                  key={id}
                  className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] gap-1 px-1 py-0.5 items-center border-b ${theme.border} last:border-b-0 ${
                    active ? "border-l-2" : ""
                  }`}
                  style={
                    active ? { borderLeftColor: theme.phosphor } : undefined
                  }
                >
                  <span className="truncate">
                    {formatChannelLabel(ch) || "—"}
                  </span>
                  <span
                    className="font-mono tabular-nums truncate"
                    title={ch.address}
                  >
                    {shortAddress(ch.address)}
                  </span>
                  <span className="truncate">{chain?.name || ch.chainId}</span>
                  <button
                    type="button"
                    onClick={() => setActiveChannel(ch)}
                    className={`uppercase text-[10px] px-1 border ${theme.border} cursor-pointer pointer-coarse:min-h-[44px]`}
                    style={
                      active
                        ? { background: theme.phosphor, color: FILL_FG }
                        : undefined
                    }
                  >
                    {active ? "ON" : "SET"}
                  </button>
                  {ch.source === "preset" ? (
                    <span className={theme.muted}>preset</span>
                  ) : pendingRemove === confirmKey ? (
                    <div className="flex gap-1">
                      <PhosphorChip
                        theme={theme}
                        label="Confirm"
                        warn
                        onClick={() => removeChannel(ch)}
                      />
                      <GhostChip
                        theme={theme}
                        label="Cancel"
                        onClick={() => setPendingRemove(null)}
                      />
                    </div>
                  ) : (
                    <GhostChip
                      theme={theme}
                      label="Remove"
                      onClick={() => setPendingRemove(confirmKey)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-1 items-center">
          <select
            value={channelDraft.chainId}
            onChange={(e) =>
              setChannelDraft((d) => ({ ...d, chainId: e.target.value }))
            }
            className={`border ${theme.border} ${theme.bg} ${theme.text} text-[11px] font-mono px-1`}
          >
            {SUPPORTED_CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldInput
            theme={theme}
            value={channelDraft.name}
            onChange={(v) => setChannelDraft((d) => ({ ...d, name: v }))}
            placeholder="name"
          />
          <FieldInput
            theme={theme}
            value={channelDraft.address}
            onChange={(v) => setChannelDraft((d) => ({ ...d, address: v }))}
            placeholder="0x…"
            mono
          />
          <PhosphorChip theme={theme} label="Add" onClick={addChannel} />
        </div>
      </section>

      {/* 5. Default mode */}
      <section className="space-y-1.5">
        <SectionLabel theme={theme}>Default mode</SectionLabel>
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Default mode"
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
                className={`inline-flex items-center justify-center px-2.5 uppercase tracking-widest text-[10px] cursor-pointer pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px] [@media(hover:none)]:min-h-[44px] rounded-none ${
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
        </div>
      </section>

      {/* 6. Export / Import */}
      <section className="space-y-1.5 pb-4">
        <SectionLabel theme={theme}>Export / Import</SectionLabel>
        <div className="flex flex-wrap gap-1 items-center">
          <PhosphorChip theme={theme} label="Export" onClick={() => void handleExport()} />
          <span className={theme.muted}>
            JSON of RPC, tokens, theme, mode, channels, pins
          </span>
        </div>
        <p className={`text-[10px] leading-snug ${theme.muted}`}>
          localStorage is host-scoped — after moving to app.0xterm.xyz, Export here
          (or on 0xterm.xyz) and Import on the app host.
        </p>
        <textarea
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportError(null);
            setImportConfirm(false);
          }}
          placeholder="Paste export JSON here…"
          rows={4}
          className={`w-full px-1.5 py-1 text-[11px] font-mono outline-none border ${theme.border} ${theme.bg} ${theme.text} rounded-none`}
          style={{ caretColor: theme.phosphor }}
        />
        {importError && (
          <div className={`${theme.warn} text-[11px] px-1 py-0.5 border`}>
            {importError}
          </div>
        )}
        <div className="flex flex-wrap gap-1 items-center">
          {!importConfirm ? (
            <PhosphorChip theme={theme} label="Import" onClick={tryImport} />
          ) : (
            <>
              <span className={theme.muted}>Overwrite preferences?</span>
              <PhosphorChip
                theme={theme}
                label="Confirm"
                warn
                onClick={confirmImport}
              />
              <GhostChip
                theme={theme}
                label="Cancel"
                onClick={() => setImportConfirm(false)}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
