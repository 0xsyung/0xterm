/**
 * @file commands.test.ts
 * @description Unit tests for wallet command log builders (balance / pnl / tokens / theme)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { base } from "viem/chains";
import { SUPPORTED_CHAINS } from "./constants";
import {
  buildBalanceLog,
  buildPnlLog,
  buildThemeLog,
  buildTokensLog,
  type BuildBalanceLogDeps,
  type BuildPnlLogDeps,
  type BuildThemeLogDeps
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

describe("buildTokensLog", () => {
  const CUSTOM = {
    [base.id]: [
      {
        id: "c_1",
        address: "0x2222222222222222222222222222222222222222" as Address,
        symbol: "CUSTOM",
        name: "Custom",
        tokenType: "erc721" as const,
        isNative: false
      }
    ]
  };

  it("returns a select-network-first entry when no chain is active", () => {
    const res = buildTokensLog([], null, { generateId: genId, customTokens: {} });
    expect(res).toEqual({
      id: "id-1",
      type: "text",
      text: "Select network first."
    });
  });

  it("rejects an invalid filter type", () => {
    const res = buildTokensLog(["tokens", "nope"], base.id, {
      generateId: genId,
      customTokens: {}
    });
    expect(res.text).toBe(
      "Invalid filter. Use 'tokens', 'tokens erc20', or 'tokens erc721'."
    );
  });

  it("merges common and custom tokens, filtering by type", () => {
    const res = buildTokensLog(["tokens", "erc721"], base.id, {
      generateId: genId,
      customTokens: CUSTOM
    });
    expect(res.text).toContain("[Available ERC721 Tokens]");
    expect(res.text).toContain("CUSTOM");
    expect(res.text).toContain("[ERC721]");
    expect(res.text).toContain("(Custom)");
  });

  it("returns a no-tokens-found message when the filter has no matches", () => {
    const res = buildTokensLog(["tokens", "erc721"], base.id, {
      generateId: genId,
      customTokens: {}
    });
    expect(res.text).toBe("No ERC721 tokens found for this network.");
  });
});

describe("buildThemeLog", () => {
  const themeDeps = (
    overrides: Partial<BuildThemeLogDeps> = {}
  ): BuildThemeLogDeps => ({
    generateId: genId,
    currentThemeKey: "matrix",
    themeName: "Matrix",
    handleThemeSwitch: vi.fn(),
    ...overrides
  });

  it("lists themes and the active theme when no arg is given", () => {
    const res = buildThemeLog([], themeDeps());
    expect(res.text).toContain("Active Theme: Matrix.");
    expect(res.text).toContain("* matrix");
    expect(res.text).toContain(" amber");
  });

  it("reports an unknown theme", () => {
    const res = buildThemeLog(["theme", "bogus"], themeDeps());
    expect(res.text).toContain('[!] Error: Theme "bogus" not found.');
  });

  it("switches theme via the injected handler on a valid input", () => {
    const deps = themeDeps();
    const res = buildThemeLog(["theme", "amber"], deps);
    expect(deps.handleThemeSwitch).toHaveBeenCalledWith("amber");
    expect(res.text).toBe("[✓] Theme switched to Amber");
  });
});
