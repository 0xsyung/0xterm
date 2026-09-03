/**
 * @file portfolio.test.ts
 * @description Unit tests for portfolio holdings builder
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import { base } from "viem/chains";
import {
  fetchPortfolioHoldings,
  fetchPortfolioSnapshot,
  fetchTokenBalanceData,
  type FetchPortfolioDeps,
  type FetchTokenBalanceDeps
} from "./portfolio";
import { NATIVE_TOKEN_ADDRESS, SUPPORTED_CHAINS } from "./constants";
import type { CustomTokensMap } from "./types";

const USER = "0x1111111111111111111111111111111111111111" as Address;
const TOKEN = "0x2222222222222222222222222222222222222222" as Address;

const jsonRes = (body: any) => ({ ok: true, json: async () => body });

function mockClient(overrides: {
  getBalance?: (args: any) => Promise<any>;
  readContract?: (args: any) => Promise<any>;
} = {}): PublicClient {
  return {
    getBalance: vi.fn(overrides.getBalance ?? (async () => 1n)),
    readContract: vi.fn(overrides.readContract ?? (async () => 100n))
  } as unknown as PublicClient;
}

function deps(overrides: Partial<FetchPortfolioDeps> = {}): FetchPortfolioDeps {
  return {
    getClient: vi.fn(() => mockClient()),
    // Avoid real network: pricing falls through to null without a matching pair.
    fetchImpl: (vi.fn(async () => jsonRes({ pairs: [] })) as unknown) as typeof fetch,
    ...overrides
  };
}

function oneTokenMap(): CustomTokensMap {
  return {
    [base.id]: [
      { id: "c_tok", address: TOKEN, symbol: "FOO", name: "Foo", decimals: 6, isNative: false }
    ]
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("fetchPortfolioHoldings", () => {
  it("includes a native holding for every supported chain", async () => {
    const d = deps();
    const res = await fetchPortfolioHoldings(USER, {}, undefined, d);
    const natives = res.filter((h) => h.type === "native");
    expect(natives.length).toBe(SUPPORTED_CHAINS.length);
    for (const h of natives) {
      expect(h.balance).not.toBe("");
      expect(h.symbol).toBeTruthy();
    }
  });

  it("reads a custom token balance and formats it", async () => {
    const client = mockClient({ readContract: async () => 1000n });
    const d = deps({ getClient: vi.fn(() => client) });
    const res = await fetchPortfolioHoldings(USER, oneTokenMap(), "erc20", d);
    const foo = res.find((h) => h.symbol === "FOO");
    expect(foo).toBeDefined();
    expect(foo!.balance).toBe("0.001"); // 1000 / 1e6
    expect(foo!.type).toBe("erc20");
    expect(foo!.address).toBe(TOKEN);
  });

  it("skips zero-balance tokens", async () => {
    const client = mockClient({ readContract: async () => 0n });
    const d = deps({ getClient: vi.fn(() => client) });
    const res = await fetchPortfolioHoldings(USER, oneTokenMap(), "erc20", d);
    expect(res.find((h) => h.symbol === "FOO")).toBeUndefined();
  });

  it("respects the native filter", async () => {
    const client = mockClient({ readContract: async () => 100n });
    const d = deps({ getClient: vi.fn(() => client) });
    const res = await fetchPortfolioHoldings(USER, oneTokenMap(), "native", d);
    for (const h of res) expect(h.type).toBe("native");
  });

  it("respects the erc20 filter (excludes native)", async () => {
    const client = mockClient({ readContract: async () => 100n });
    const d = deps({ getClient: vi.fn(() => client) });
    const res = await fetchPortfolioHoldings(USER, oneTokenMap(), "erc20", d);
    for (const h of res) expect(h.type).toBe("erc20");
  });

  it("merges COMMON_TOKENS entries not shadowed by a custom token", async () => {
    const client = mockClient({ readContract: async () => 100n });
    const d = deps({ getClient: vi.fn(() => client) });
    const res = await fetchPortfolioHoldings(USER, {}, "erc20", d);
    expect(res.some((h) => h.symbol === "USDC")).toBe(true);
  });

  it("skips the zero-address custom entry", async () => {
    const client = mockClient({ readContract: async () => 100n });
    const d = deps({ getClient: vi.fn(() => client) });
    const map: CustomTokensMap = {
      [base.id]: [
        { id: "c_zero", address: NATIVE_TOKEN_ADDRESS as Address, symbol: "ZERO", name: "Zero", decimals: 18, isNative: false }
      ]
    };
    const res = await fetchPortfolioHoldings(USER, map, undefined, d);
    expect(res.some((h) => h.symbol === "ZERO")).toBe(false);
  });

  it("uses a fetched price for value when available", async () => {
    const client = mockClient({ readContract: async () => 1_000_000n }); // 1 FOO (decimals 6)
    const fetchImpl = (vi.fn(async () =>
      jsonRes({ pairs: [{ chainId: "base", baseToken: { symbol: "FOO", address: TOKEN }, priceUsd: "5" }] })
    ) as unknown) as typeof fetch;
    const d = deps({ getClient: vi.fn(() => client), fetchImpl });
    const res = await fetchPortfolioHoldings(USER, oneTokenMap(), "erc20", d);
    const foo = res.find((h) => h.symbol === "FOO");
    expect(foo!.priceUsd).toBe(5);
    expect(foo!.valueUsd).toBe(5);
  });
});

describe("fetchTokenBalanceData", () => {
  function balDeps(overrides: Partial<FetchTokenBalanceDeps> = {}): FetchTokenBalanceDeps {
    return {
      getClient: vi.fn(() => mockClient()),
      resolveToken: vi.fn(async () => ({
        address: TOKEN,
        symbol: "FOO",
        name: "Foo",
        decimals: 6,
        isNative: false
      })),
      ...overrides
    };
  }

  it("returns native balance when no query token", async () => {
    const client = mockClient({ getBalance: async () => 2n * 10n ** 18n });
    const d = balDeps({ getClient: vi.fn(() => client) });
    const res = await fetchTokenBalanceData(USER, base, undefined, d);
    expect(res).toEqual({ balance: "2", symbol: base.nativeCurrency.symbol });
  });

  it("returns native balance for a native token symbol", async () => {
    const client = mockClient({ getBalance: async () => 3n * 10n ** 18n });
    const d = balDeps({
      getClient: vi.fn(() => client),
      resolveToken: vi.fn(async () => ({
        address: NATIVE_TOKEN_ADDRESS as Address,
        symbol: "ETH",
        name: "Ether",
        decimals: 18,
        isNative: true
      }))
    });
    const res = await fetchTokenBalanceData(USER, base, "eth", d);
    expect(res).toEqual({ balance: "3", symbol: "ETH" });
  });

  it("reads an ERC20 balance and formats with token decimals", async () => {
    const client = mockClient({ readContract: async () => 1_500_000n });
    const d = balDeps({ getClient: vi.fn(() => client) });
    const res = await fetchTokenBalanceData(USER, base, "FOO", d);
    expect(res).toEqual({ balance: "1.5", symbol: "FOO" });
  });
});

describe("fetchPortfolioSnapshot", () => {
  it("records a native holding per chain keyed by chain: symbol", async () => {
    const d = deps();
    const res = await fetchPortfolioSnapshot(USER, {}, d);
    for (const chain of SUPPORTED_CHAINS) {
      const key = `${chain.id}:${chain.nativeCurrency.symbol}`;
      expect(res[key]).toBeDefined();
      expect(res[key]!.balance).toBe("0.000000000000000001"); // 1n wei
    }
  });

  it("records custom token balances keyed by chain: address", async () => {
    const client = mockClient({ readContract: async () => 1000n });
    const d = deps({ getClient: vi.fn(() => client) });
    const res = await fetchPortfolioSnapshot(USER, oneTokenMap(), d);
    const key = `${base.id}:${TOKEN.toLowerCase()}`;
    expect(res[key]).toBeDefined();
    expect(res[key]!.balance).toBe("0.001"); // 1000 / 1e6
  });

  it("skips the zero-address custom entry", async () => {
    const d = deps();
    const map: CustomTokensMap = {
      [base.id]: [
        { id: "c_zero", address: NATIVE_TOKEN_ADDRESS as Address, symbol: "ZERO", name: "Zero", decimals: 18, isNative: false }
      ]
    };
    const res = await fetchPortfolioSnapshot(USER, map, d);
    expect(res[`${base.id}:zero`]).toBeUndefined();
  });

  it("uses a fetched price for the token when available", async () => {
    const client = mockClient({ readContract: async () => 1_000_000n }); // 1 FOO (decimals 6)
    const fetchImpl = (vi.fn(async () =>
      jsonRes({ pairs: [{ chainId: "base", baseToken: { symbol: "FOO", address: TOKEN }, priceUsd: "5" }] })
    ) as unknown) as typeof fetch;
    const d = deps({ getClient: vi.fn(() => client), fetchImpl });
    const res = await fetchPortfolioSnapshot(USER, oneTokenMap(), d);
    const key = `${base.id}:${TOKEN.toLowerCase()}`;
    expect(res[key]!.price).toBe(5);
  });
});
