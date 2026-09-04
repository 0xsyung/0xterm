/**
 * @file commands.ts
 * @description Pure builders for wallet command log entries (balance / pnl)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address, Chain } from "viem";
import { SUPPORTED_CHAINS } from "./constants";
import type { LogEntry } from "./types";

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
