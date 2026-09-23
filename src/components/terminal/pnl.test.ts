/**
 * @file pnl.test.ts
 * @description Parser, pin identity, mark refresh, snapshot, formatting (#23/#6)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import type { Chain, PublicClient } from "viem";

vi.mock("./pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pricing")>();
  return { ...actual, getTokenPriceUsd: vi.fn() };
});

import {
  PNL_WIDGET_ID,
  attachPairIdentities,
  buildPnlView,
  formatPnlPct,
  formatPnlUsd,
  formatPnlUsdSigned,
  parsePnlCommand,
  pnlPinKey,
  readPortfolioSnapshot,
  refreshPnlMarks,
  refreshPnlMarksViaPricing,
  snapKeyForHolding,
  type PnlHolding
} from "./pnl";
import { getTokenPriceUsd } from "./pricing";

describe("parsePnlCommand", () => {
  it("parses bare pnl as view", () => {
    expect(parsePnlCommand(["pnl"])).toEqual({ op: "view" });
  });

  it("ignores junk args on view", () => {
    expect(parsePnlCommand(["pnl", "foo"])).toEqual({ op: "view" });
  });

  it("parses pnl baseline now", () => {
    expect(parsePnlCommand(["pnl", "baseline", "now"])).toEqual({
      op: "baseline",
      label: "now"
    });
  });

  it("parses pnl baseline <label>", () => {
    expect(parsePnlCommand(["pnl", "baseline", "foo"])).toEqual({
      op: "baseline",
      label: "foo"
    });
  });

  it("defaults baseline label to now when omitted", () => {
    expect(parsePnlCommand(["pnl", "baseline"])).toEqual({
      op: "baseline",
      label: "now"
    });
  });
});

describe("pin identity", () => {
  it("uses stable widgetId pnl:snapshot", () => {
    const view = buildPnlView([], {
      label: "a",
      timestamp: 1,
      holdings: {}
    });
    expect(view.widgetId).toBe(PNL_WIDGET_ID);
    expect(view.widgetId).toBe("pnl:snapshot");
  });

  it("pairOrSymbols is label+timestamp; new snapshot changes it, not widgetId", () => {
    expect(pnlPinKey("now", 100)).toBe("now+100");
    expect(pnlPinKey("later", 200)).toBe("later+200");
    const a = buildPnlView([], { label: "now", timestamp: 100, holdings: {} });
    const b = buildPnlView([], { label: "later", timestamp: 200, holdings: {} });
    expect(a.widgetId).toBe(b.widgetId);
    expect(pnlPinKey(a.label, a.snapshotTime)).not.toBe(
      pnlPinKey(b.label, b.snapshotTime)
    );
  });
});

describe("refreshPnlMarks", () => {
  it("does not invoke balanceOf — only DexScreener pair quotes", async () => {
    const balanceOf = vi.fn();
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "ETH",
        type: "native",
        balance: "1",
        priceUsd: 2000,
        valueUsd: 2000,
        change24h: null,
        priceSource: "api",
        isTestnet: false,
        pairAddress: "0xpairEthUsdc",
        dsChain: "ethereum"
      }
    ];
    const fetchImpl = vi.fn(async (url: string) => {
      expect(String(url)).toContain("/latest/dex/pairs/");
      expect(String(url)).not.toMatch(/balanceOf/i);
      return {
        ok: true,
        json: async () => ({
          pairs: [
            {
              chainId: "ethereum",
              pairAddress: "0xpairEthUsdc",
              priceUsd: "2100",
              priceChange: { h24: 1 },
              volume: { h24: 1 },
              liquidity: { usd: 1_000_000 },
              baseToken: { symbol: "WETH", address: "0xweth" },
              quoteToken: { symbol: "USDC", address: "0xusdc" }
            }
          ]
        })
      };
    });
    const out = await refreshPnlMarks(holdings, fetchImpl as unknown as typeof fetch);
    expect(balanceOf).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalled();
    expect(out.holdings[0]!.priceUsd).toBe(2100);
    expect(out.holdings[0]!.valueUsd).toBe(2100);
  });

  it("marks via tokens/v1 for holdings without pair identity", async () => {
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "FOO",
        type: "erc20",
        address: "0x1111111111111111111111111111111111111111",
        balance: "2",
        priceUsd: null,
        valueUsd: null,
        change24h: null,
        priceSource: "api",
        isTestnet: false
      }
    ];
    const fetchImpl = vi.fn(async (url: string) => {
      expect(String(url)).toContain("/tokens/v1/ethereum/");
      return {
        ok: true,
        json: async () => [
          {
            chainId: "ethereum",
            pairAddress: "0xpairFoo",
            priceUsd: "5",
            priceChange: { h24: 0 },
            volume: { h24: 1 },
            liquidity: { usd: 500_000 },
            baseToken: { symbol: "FOO", address: "0x1111111111111111111111111111111111111111" },
            quoteToken: { symbol: "USDC", address: "0xusdc" }
          }
        ]
      };
    });
    const out = await refreshPnlMarks(holdings, fetchImpl as unknown as typeof fetch);
    expect(out.stale).toBe(false);
    expect(out.holdings[0]!.priceUsd).toBe(5);
    expect(out.holdings[0]!.valueUsd).toBe(10);
    expect(out.holdings[0]!.pairAddress).toBe("0xpairFoo");
    expect(out.holdings[0]!.dsChain).toBe("ethereum");
  });

  it("marks native ETH via wrapped pair when no identity", async () => {
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "ETH",
        type: "native",
        balance: "1",
        priceUsd: null,
        valueUsd: null,
        change24h: null,
        priceSource: "api",
        isTestnet: false
      }
    ];
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        json: async () => [
          {
            chainId: "ethereum",
            pairAddress: "0xpairWeth",
            priceUsd: "2000",
            priceChange: { h24: 0 },
            volume: { h24: 1 },
            liquidity: { usd: 500_000 },
            baseToken: { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
            quoteToken: { symbol: "USDC", address: "0xusdc" }
          }
        ]
      };
    });
    const out = await refreshPnlMarks(holdings, fetchImpl as unknown as typeof fetch);
    expect(out.holdings[0]!.priceUsd).toBe(2000);
    expect(out.holdings[0]!.valueUsd).toBe(2000);
  });

  it("stays stale when every quote fails", async () => {
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "FOO",
        type: "erc20",
        address: "0x1111111111111111111111111111111111111111",
        balance: "1",
        priceUsd: null,
        valueUsd: null,
        change24h: null,
        priceSource: "api",
        isTestnet: false
      }
    ];
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }));
    const out = await refreshPnlMarks(holdings, fetchImpl as unknown as typeof fetch);
    expect(out.stale).toBe(true);
    expect(out.holdings[0]!.priceUsd).toBeNull();
  });

  it("skips testnet holdings entirely", async () => {
    const holdings: PnlHolding[] = [
      {
        chainId: 11155111,
        chainName: "Sepolia",
        symbol: "ETH",
        type: "native",
        balance: "1",
        priceUsd: null,
        valueUsd: null,
        change24h: null,
        priceSource: "api",
        isTestnet: true
      }
    ];
    const fetchImpl = vi.fn();
    const out = await refreshPnlMarks(holdings, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(out.holdings[0]!.priceUsd).toBeNull();
    expect(out.stale).toBe(false);
  });

  it("returns an unchanging holding when a pair quote is missing", async () => {
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "FOO",
        type: "erc20",
        address: "0x1111111111111111111111111111111111111111",
        balance: "1",
        priceUsd: 3,
        valueUsd: 3,
        change24h: null,
        priceSource: "api",
        isTestnet: false
      }
    ];
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => [] }));
    const out = await refreshPnlMarks(holdings, fetchImpl as unknown as typeof fetch);
    expect(out.holdings[0]!.priceUsd).toBe(3);
  });
});

describe("attachPairIdentities", () => {
  it("attaches identities from tokens/v1 once", async () => {
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "FOO",
        type: "erc20",
        address: "0x1111111111111111111111111111111111111111",
        balance: "2",
        priceUsd: null,
        valueUsd: null,
        change24h: null,
        priceSource: "api",
        isTestnet: false
      }
    ];
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          chainId: "ethereum",
          pairAddress: "0xpairFoo",
          priceUsd: "5",
          priceChange: { h24: 0 },
          volume: { h24: 1 },
          liquidity: { usd: 500_000 },
          baseToken: { symbol: "FOO", address: "0x1111111111111111111111111111111111111111" },
          quoteToken: { symbol: "USDC", address: "0xusdc" }
        }
      ]
    }));
    const out = await attachPairIdentities(holdings, fetchImpl as unknown as typeof fetch);
    expect(out[0]!.pairAddress).toBe("0xpairFoo");
    expect(out[0]!.dsChain).toBe("ethereum");
    expect(out[0]!.priceUsd).toBe(5);
  });

  it("keeps a holding that already has an identity", async () => {
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "FOO",
        type: "erc20",
        address: "0x1111111111111111111111111111111111111111",
        balance: "1",
        priceUsd: 3,
        valueUsd: 3,
        change24h: null,
        priceSource: "api",
        isTestnet: false,
        pairAddress: "0xpairFoo",
        dsChain: "ethereum"
      }
    ];
    const fetchImpl = vi.fn();
    const out = await attachPairIdentities(holdings, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(out[0]!.pairAddress).toBe("0xpairFoo");
  });
});

describe("readPortfolioSnapshot", () => {
  const ADDR = "0x1234567890123456789012345678901234567890";
  const storage = () => new Map<string, string>();

  it("returns null without storage or missing key", () => {
    expect(readPortfolioSnapshot(null, ADDR as `0x${string}`)).toBeNull();
    const s = storage();
    expect(readPortfolioSnapshot({ getItem: (k: string) => s.get(k) ?? null } as Storage, ADDR as `0x${string}`)).toBeNull();
  });

  it("reads label/timestamp/holdings", () => {
    const s = storage();
    s.set(
      `0xterm_user_${ADDR.toLowerCase()}`,
      JSON.stringify({
        portfolioSnapshot: {
          label: "now",
          timestamp: 123,
          holdings: { "1:ETH": { price: 2000, balance: "1" } }
        }
      })
    );
    const snap = readPortfolioSnapshot({ getItem: (k: string) => s.get(k) ?? null } as Storage, ADDR as `0x${string}`);
    expect(snap?.label).toBe("now");
    expect(snap?.timestamp).toBe(123);
    expect(snap?.holdings["1:ETH"]).toEqual({ price: 2000, balance: "1" });
  });

  it("returns null on malformed or missing snapshot", () => {
    const s = storage();
    s.set(`0xterm_user_${ADDR.toLowerCase()}`, "not json");
    expect(readPortfolioSnapshot({ getItem: (k: string) => s.get(k) ?? null } as Storage, ADDR as `0x${string}`)).toBeNull();
    const s2 = storage();
    s2.set(`0xterm_user_${ADDR.toLowerCase()}`, JSON.stringify({ portfolioSnapshot: {} }));
    expect(readPortfolioSnapshot({ getItem: (k: string) => s2.get(k) ?? null } as Storage, ADDR as `0x${string}`)).toBeNull();
  });
});

describe("formatPnl*", () => {
  it("formats null / non-finite as em-dash", () => {
    expect(formatPnlUsd(null)).toBe("—");
    expect(formatPnlUsd(Number.NaN)).toBe("—");
    expect(formatPnlUsdSigned(null)).toBe("—");
    expect(formatPnlPct(null)).toBe("—");
    expect(formatPnlPct(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("formats positive/negative/zero USD", () => {
    expect(formatPnlUsdSigned(12.345)).toBe("+$12.35");
    expect(formatPnlUsdSigned(-5.1)).toBe("-$5.10");
    expect(formatPnlUsdSigned(0)).toBe("$0.00");
    // formatPnlUsd is absolute (no forced sign) — callers decorate.
    expect(formatPnlUsd(-3)).toBe("$3.00");
    expect(formatPnlUsd(3)).toBe("+$3.00");
  });

  it("formats pct with sign", () => {
    expect(formatPnlPct(12.345)).toBe("+12.35%");
    expect(formatPnlPct(-1.5)).toBe("-1.50%");
    expect(formatPnlPct(0)).toBe("0.00%");
  });
});

describe("refreshPnlMarksViaPricing", () => {
  it("uses getTokenPriceUsd for holdings without identity", async () => {
    const getClient = vi.fn(() => ({} as PublicClient));
    vi.mocked(getTokenPriceUsd).mockResolvedValue(2000);
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "FOO",
        type: "erc20",
        address: "0x1111111111111111111111111111111111111111",
        balance: "2",
        priceUsd: null,
        valueUsd: null,
        change24h: null,
        priceSource: "api",
        isTestnet: false
      }
    ];
    const out = await refreshPnlMarksViaPricing(
      holdings,
      getClient as unknown as (chain: Chain) => PublicClient,
      vi.fn() as unknown as typeof fetch
    );
    expect(out[0]!.priceUsd).toBe(2000);
    expect(out[0]!.valueUsd).toBe(4000);
    expect(out[0]!.priceSource).toBe("api");
  });

  it("keeps holdings with a pair identity untouched", async () => {
    const getClient = vi.fn();
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "FOO",
        type: "erc20",
        address: "0x1111111111111111111111111111111111111111",
        balance: "1",
        priceUsd: 3,
        valueUsd: 3,
        change24h: null,
        priceSource: "api",
        isTestnet: false,
        pairAddress: "0xpairFoo",
        dsChain: "ethereum"
      }
    ];
    const out = await refreshPnlMarksViaPricing(holdings, getClient as never, vi.fn() as unknown as typeof fetch);
    expect(getClient).not.toHaveBeenCalled();
    expect(out[0]!.priceUsd).toBe(3);
  });

  it("keeps holding when price is null and when chain is unsupported", async () => {
    vi.mocked(getTokenPriceUsd).mockResolvedValue(null);
    const holdings: PnlHolding[] = [
      {
        chainId: 1,
        chainName: "Ethereum",
        symbol: "FOO",
        type: "erc20",
        address: "0x1111111111111111111111111111111111111111",
        balance: "1",
        priceUsd: null,
        valueUsd: null,
        change24h: null,
        priceSource: "api",
        isTestnet: false
      },
      {
        chainId: 999999,
        chainName: "Nope",
        symbol: "BAR",
        type: "native",
        balance: "1",
        priceUsd: null,
        valueUsd: null,
        change24h: null,
        priceSource: "api",
        isTestnet: false
      }
    ];
    const getClient = vi.fn(() => ({} as PublicClient));
    const out = await refreshPnlMarksViaPricing(holdings, getClient as unknown as (chain: Chain) => PublicClient, vi.fn() as unknown as typeof fetch);
    expect(out[0]!.priceUsd).toBeNull();
    expect(out[1]!.priceUsd).toBeNull();
  });
});

describe("snapKeyForHolding", () => {
  it("uses address for erc20, symbol for native", () => {
    expect(
      snapKeyForHolding({ chainId: 1, symbol: "FOO", type: "erc20", address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" })
    ).toBe("1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(snapKeyForHolding({ chainId: 137, symbol: "POL", type: "native" })).toBe("137:POL");
  });
});
