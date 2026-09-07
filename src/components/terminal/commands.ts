/**
 * @file commands.ts
 * @description Pure builders for wallet command log entries (balance / pnl)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address, Chain } from "viem";
import {
  COMMON_TOKENS,
  SUPPORTED_CHAINS,
  THEME_ORDER,
  THEMES,
  isKnownThemeInput,
  resolveThemeKey
} from "./constants";
import type { CustomTokensMap, LogEntry, ThemeMode } from "./types";

export type BuildBalanceLogDeps = {
  generateId: () => string;
  fetchTokenBalanceData: (
    address: Address,
    chain: Chain,
    queryToken?: string
  ) => Promise<{ balance: string; symbol: string }>;
};

type ConnectedState = {
  isConnected: boolean;
  address: Address | undefined;
  activeChainId: number | null;
};

const notConnected = (id: () => string): LogEntry => ({
  id: id(),
  type: "text",
  text: "Wallet not connected."
});

export const buildBalanceLog = async (
  args: string[],
  state: ConnectedState,
  deps: BuildBalanceLogDeps
): Promise<LogEntry> => {
  if (!state.isConnected || !state.address) return notConnected(deps.generateId);
  const targetChain =
    SUPPORTED_CHAINS.find((c) => c.id === state.activeChainId) ||
    SUPPORTED_CHAINS[5];
  const balData = await deps.fetchTokenBalanceData(
    state.address,
    targetChain,
    args[1]
  );
  return { id: deps.generateId(), type: "balance", payload: balData };
};

export type BuildPnlLogDeps = {
  generateId: () => string;
  readPreference: (address: Address) => {
    portfolioSnapshot?: {
      label: string;
      timestamp: number;
      holdings: Record<string, unknown>;
    };
  };
};

export const buildPnlLog = (
  state: ConnectedState,
  deps: BuildPnlLogDeps
): LogEntry => {
  if (!state.isConnected || !state.address) return notConnected(deps.generateId);
  const snap = deps.readPreference(state.address).portfolioSnapshot;
  if (!snap) {
    return {
      id: deps.generateId(),
      type: "text",
      text: "No snapshot found. Run 'snapshot' first to establish a P/L baseline."
    };
  }
  return {
    id: deps.generateId(),
    type: "text",
    text: `Snapshot "${snap.label}" at ${new Date(
      snap.timestamp
    ).toLocaleString()} with ${Object.keys(snap.holdings).length} holdings. Run 'portfolio' for per-token P/L.`
  };
};

type TokenView = {
  symbol: string;
  address: string;
  type: string;
  isCustom: boolean;
};

export type BuildTokensLogDeps = {
  generateId: () => string;
  customTokens: CustomTokensMap;
};

// Build the `tokens` command output for the active chain, merging COMMON_TOKENS
// with user-registered custom tokens and optionally filtering by type.
export const buildTokensLog = (
  args: string[],
  activeChainId: number | null,
  deps: BuildTokensLogDeps
): LogEntry => {
  if (!activeChainId) {
    return {
      id: deps.generateId(),
      type: "text",
      text: "Select network first."
    };
  }

  const filterType = args[1]?.toLowerCase();
  if (filterType && filterType !== "erc20" && filterType !== "erc721") {
    return {
      id: deps.generateId(),
      type: "text",
      text: "Invalid filter. Use 'tokens', 'tokens erc20', or 'tokens erc721'."
    };
  }

  const common = COMMON_TOKENS[activeChainId] || {};

  const allTokens: TokenView[] = [];

  for (const [symbol, info] of Object.entries(common)) {
    allTokens.push({
      symbol,
      address: info.address,
      type: "erc20",
      isCustom: false
    });
  }

  for (const info of deps.customTokens[activeChainId] || []) {
    allTokens.push({
      symbol: info.symbol,
      address: info.address,
      type: info.tokenType || "erc20",
      isCustom: true
    });
  }

  let filteredTokens = allTokens;
  if (filterType) {
    filteredTokens = allTokens.filter((t) => t.type === filterType);
  }

  if (filteredTokens.length === 0) {
    return {
      id: deps.generateId(),
      type: "text",
      text: `No ${filterType ? filterType.toUpperCase() + " " : ""}tokens found for this network.`
    };
  }

  const lines = [
    `[Available ${filterType ? filterType.toUpperCase() + " " : ""}Tokens]`
  ];
  for (const t of filteredTokens) {
    const typeBadge = t.type === "erc721" ? "[ERC721]" : "[ERC20]";
    const customBadge = t.isCustom ? "(Custom)" : "";
    lines.push(
      `${t.symbol.padEnd(8)} | ${typeBadge} ${t.address} ${customBadge}`
    );
  }

  return {
    id: deps.generateId(),
    type: "text",
    text: lines.join("\n")
  };
};

export type BuildThemeLogDeps = {
  generateId: () => string;
  currentThemeKey: ThemeMode;
  themeName: string;
  handleThemeSwitch: (theme: ThemeMode) => void;
};

// Build the `theme` command output. Listing is pure; switching delegates to the
// injected handler that owns the React state + persisted preference.
export const buildThemeLog = (
  args: string[],
  deps: BuildThemeLogDeps
): LogEntry => {
  const list = THEME_ORDER.map(
    (k) => `${k === deps.currentThemeKey ? "*" : " "} ${k}`
  ).join("\n");
  if (!args[1]) {
    return {
      id: deps.generateId(),
      type: "text",
      text: `Active Theme: ${deps.themeName}.\n${list}`
    };
  }

  if (!isKnownThemeInput(args[1])) {
    return {
      id: deps.generateId(),
      type: "text",
      text: `[!] Error: Theme "${args[1]}" not found.\n${list}`
    };
  }

  const targetThemeKey = resolveThemeKey(args[1]);
  deps.handleThemeSwitch(targetThemeKey);
  return {
    id: deps.generateId(),
    type: "text",
    text: `[✓] Theme switched to ${THEMES[targetThemeKey].name}`
  };
};
