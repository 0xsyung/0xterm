/**
 * @file commands.test.ts
 * @description Unit tests for wallet command log builders (balance / pnl)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { SUPPORTED_CHAINS } from "./constants";
import {
  buildBalanceLog,
  buildPnlLog,
  type BuildBalanceLogDeps,
  type BuildPnlLogDeps
} from "./commands";

const ALICE = "0x3333333333333333333333333333333333333333" as Address;

const genId = () => "id-1";

const connected = {
  isConnected: true,
  address: ALICE,
  activeChainId: null
} as const;

const disconnected = {
  isConnected: false,
  address: undefined,
  activeChainId: null
} as const;

describe("buildBalanceLog", () => {
  it("returns a not-connected text entry when disconnected", async () => {
    const fetchTokenBalanceData = vi.fn();
    const res = await buildBalanceLog([], disconnected, {
      generateId: genId,
      fetchTokenBalanceData
    });
    expect(res).toEqual({
      id: "id-1",
      type: "text",
      text: "Wallet not connected."
    });
    expect(fetchTokenBalanceData).not.toHaveBeenCalled();
  });

  it("falls back to SUPPORTED_CHAINS[5] when activeChainId has no match", async () => {
    const fetchTokenBalanceData = vi.fn(async () => ({
      balance: "1.5",
      symbol: "ETH"
    }));
    const deps: BuildBalanceLogDeps = { generateId: genId, fetchTokenBalanceData };
    const res = await buildBalanceLog([], connected, deps);
    expect(fetchTokenBalanceData).toHaveBeenCalledWith(
      ALICE,
      SUPPORTED_CHAINS[5],
      undefined
    );
    expect(res).toEqual({
      id: "id-1",
      type: "balance",
      payload: { balance: "1.5", symbol: "ETH" }
    });
  });

  it("passes the token query through when provided", async () => {
    const fetchTokenBalanceData = vi.fn(async () => ({
      balance: "42",
      symbol: "FOO"
    }));
    const deps: BuildBalanceLogDeps = { generateId: genId, fetchTokenBalanceData };
    const res = await buildBalanceLog(["balance", "FOO"], connected, deps);
    expect(fetchTokenBalanceData).toHaveBeenCalledWith(
      ALICE,
      SUPPORTED_CHAINS[5],
      "FOO"
    );
    expect(res.payload).toEqual({ balance: "42", symbol: "FOO" });
  });
});

describe("buildPnlLog", () => {
  type Snap = {
    label: string;
    timestamp: number;
    holdings: Record<string, unknown>;
  };
  const deps = (snap?: Snap): BuildPnlLogDeps => ({
    generateId: genId,
    readPreference: () => (snap ? { portfolioSnapshot: snap } : {})
  });

  it("returns a not-connected text entry when disconnected", () => {
    const res = buildPnlLog(disconnected, deps());
    expect(res).toEqual({
      id: "id-1",
      type: "text",
      text: "Wallet not connected."
    });
  });

  it("returns a no-snapshot message when none is stored", () => {
    const res = buildPnlLog(connected, deps());
    expect(res).toEqual({
      id: "id-1",
      type: "text",
      text: "No snapshot found. Run 'snapshot' first to establish a P/L baseline."
    });
  });

  it("formats the snapshot label, timestamp, and holdings count", () => {
    const snap = {
      label: "my-snap",
      timestamp: 1700000000000,
      holdings: { a: {}, b: {} }
    };
    const res = buildPnlLog(connected, deps(snap));
    expect(res.text).toBe(
      `Snapshot "my-snap" at ${new Date(1700000000000).toLocaleString()} with 2 holdings. Run 'portfolio' for per-token P/L.`
    );
  });
});
