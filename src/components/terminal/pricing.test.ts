/**
 * @file pricing.test.ts
 * @description Unit tests for USD price lookups
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { base, mainnet } from "viem/chains";

const MAINNET_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";

type JsonResponse = { ok: boolean; json: () => Promise<any> };
const jsonRes = (body: any): JsonResponse => ({ ok: true, json: async () => body });
const errRes = (): JsonResponse => ({ ok: false, json: async () => ({}) });

const usdPair = (overrides: Record<string, any> = {}) => ({
  chainId: "base",
  pairAddress: "0xpair",
  priceUsd: "2437.5",
  liquidity: { usd: 1_000_000 },
  priceChange: { h24: 1 },
  baseToken: { symbol: "WETH", address: WETH },
  quoteToken: { symbol: "USDC", address: USDC },
  ...overrides
});

function mockClient(overrides: { readContract?: (args: any) => Promise<any> } = {}): PublicClient {
  return {
    readContract: vi.fn(overrides.readContract ?? (async () => { throw new Error("reverted"); }))
  } as unknown as PublicClient;
}

beforeEach(() => {
  vi.resetModules();
});

describe("getNativePriceUsd", () => {
  it("fetches and caches the native price via tokens/v1 + pickDexPair", async () => {
    const { getNativePriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/tokens/v1/")) {
        return jsonRes([usdPair({ priceUsd: "2437.5", baseToken: { symbol: "WETH", address: WETH } })]);
      }
      return jsonRes({ pairs: [] });
    });
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBe(2437.5);
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBe(2437.5);
    expect(fetchMock).toHaveBeenCalledTimes(1); // cached
  });

  it("returns null and caches null when fetch fails", async () => {
    const { getNativePriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => { throw new Error("network down"); });
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBeNull();
    const callsAfterFirst = fetchMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0); // tokens/v1 + search retries
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirst); // cached
  });

  it("returns null when the response is not ok", async () => {
    const { getNativePriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => errRes());
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when there is no DexScreener slug for the chain", async () => {
    const { getNativePriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => { throw new Error("should not be called"); });
    const fakeChain = { ...base, id: 99999, nativeCurrency: { name: "X", symbol: "X", decimals: 18 } };
    expect(await getNativePriceUsd(fakeChain, fetchMock as unknown as typeof fetch)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getTokenPriceUsd", () => {
  it("returns the DexScreener price via tokens/v1 for a matching token", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/tokens/v1/")) {
        return jsonRes([
          usdPair({
            priceUsd: "0.9999",
            baseToken: { symbol: "USDC", address: USDC },
            quoteToken: { symbol: "USDC", address: USDC }
          })
        ]);
      }
      return jsonRes({ pairs: [] });
    });
    const res = await getTokenPriceUsd(base, "USDC", USDC, false, mockClient(), fetchMock as unknown as typeof fetch);
    // USDC quoted against USDC may fail pickDexPair quote filter — use WETH quote
    // Re-run with proper quote:
    const fetchMock2 = vi.fn(async () =>
      jsonRes([
        usdPair({
          priceUsd: "0.9999",
          baseToken: { symbol: "USDC", address: USDC },
          quoteToken: { symbol: "USDT", address: "0xusdt" }
        })
      ])
    );
    const res2 = await getTokenPriceUsd(base, "USDC", USDC, false, mockClient(), fetchMock2 as unknown as typeof fetch);
    expect(res2).toBe(0.9999);
    void res;
  });

  it("falls through to on-chain when DexScreener has no matching pair", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async (url: string) => {
      // tokens/v1 empty; search returns only native-ish pair for nativeUsd path
      if (String(url).includes("/tokens/v1/")) {
        return jsonRes([]);
      }
      if (String(url).includes("/search")) {
        return jsonRes({
          pairs: [
            usdPair({
              priceUsd: "0.5",
              baseToken: { symbol: "WETH", address: WETH },
              quoteToken: { symbol: "USDC", address: USDC }
            })
          ]
        });
      }
      return jsonRes({ pairs: [] });
    });
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "getPool") return "0xpool";
        if (args.functionName === "token0") return USDC;
        if (args.functionName === "slot0") return [2n ** 96n, 0, 0, 0, 0, 0, 0, 0];
        throw new Error("unexpected");
      }
    });
    const res = await getTokenPriceUsd(base, "USDC", USDC, false, client, fetchMock as unknown as typeof fetch);
    expect(res).toBe(0.5);
  });

  it("returns native price via getNativePriceUsd when isNative", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () =>
      jsonRes([usdPair({ priceUsd: "2437.5", baseToken: { symbol: "WETH", address: WETH } })])
    );
    const res = await getTokenPriceUsd(base, "ETH", WETH, true, mockClient(), fetchMock as unknown as typeof fetch);
    expect(res).toBe(2437.5);
  });

  it("falls through to a V2 pool when V3 reads fail", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/tokens/v1/")) return jsonRes([]);
      if (String(url).includes("/search")) {
        return jsonRes({
          pairs: [
            usdPair({
              chainId: "ethereum",
              priceUsd: "3000",
              baseToken: { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
              quoteToken: { symbol: "USDC", address: MAINNET_USDC }
            })
          ]
        });
      }
      return jsonRes({ pairs: [] });
    });
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "getPool") throw new Error("no v3 pool");
        if (args.functionName === "getPair") return "0xpair";
        if (args.functionName === "token0") return MAINNET_USDC;
        if (args.functionName === "getReserves") return [200n, 100n, 0n];
        throw new Error("unexpected");
      }
    });
    const res = await getTokenPriceUsd(mainnet, "USDC", MAINNET_USDC, false, client, fetchMock as unknown as typeof fetch);
    expect(res).toBe(6000);
  });

  it("returns null when the chain has no wrapped native or dexes", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => jsonRes([]));
    const fakeChain = { ...base, id: 99999 };
    const res = await getTokenPriceUsd(fakeChain, "USDC", USDC, false, mockClient(), fetchMock as unknown as typeof fetch);
    expect(res).toBeNull();
  });

  it("returns null when on-chain pools all fail", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => jsonRes([]));
    const client = mockClient({ readContract: async () => { throw new Error("reverted"); } });
    const res = await getTokenPriceUsd(base, "USDC", USDC, false, client, fetchMock as unknown as typeof fetch);
    expect(res).toBeNull();
  });
});

describe("getTokenQuoteUsd", () => {
  it("returns price + change24h from the same DexScreener pair (#22)", async () => {
    const { getTokenQuoteUsd } = await import("./pricing");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/tokens/v1/")) {
        return jsonRes([
          usdPair({
            priceUsd: "0.9999",
            baseToken: { symbol: "USDC", address: USDC },
            quoteToken: { symbol: "USDT", address: "0xusdt" },
            priceChange: { h24: 0.1 }
          })
        ]);
      }
      return jsonRes({ pairs: [] });
    });
    const res = await getTokenQuoteUsd(base, "USDC", USDC, false, mockClient(), fetchMock as unknown as typeof fetch);
    expect(res.priceUsd).toBe(0.9999);
    expect(res.change24h).toBe(0.1);
  });

  it("returns null change24h for on-chain fallback quotes", async () => {
    const { getTokenQuoteUsd } = await import("./pricing");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/tokens/v1/")) return jsonRes([]);
      if (String(url).includes("/search")) {
        return jsonRes({
          pairs: [
            usdPair({
              priceUsd: "0.5",
              baseToken: { symbol: "WETH", address: WETH },
              quoteToken: { symbol: "USDC", address: USDC }
            })
          ]
        });
      }
      return jsonRes({ pairs: [] });
    });
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "getPool") return "0xpool";
        if (args.functionName === "token0") return USDC;
        if (args.functionName === "slot0") return [2n ** 96n, 0, 0, 0, 0, 0, 0, 0];
        throw new Error("unexpected");
      }
    });
    const res = await getTokenQuoteUsd(base, "USDC", USDC, false, client, fetchMock as unknown as typeof fetch);
    expect(res.priceUsd).toBe(0.5);
    expect(res.change24h).toBeNull();
  });
});
