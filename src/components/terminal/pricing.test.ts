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
const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";

type JsonResponse = { ok: boolean; json: () => Promise<any> };
const jsonRes = (body: any): JsonResponse => ({ ok: true, json: async () => body });
const errRes = (): JsonResponse => ({ ok: false, json: async () => ({}) });

function mockClient(overrides: { readContract?: (args: any) => Promise<any> } = {}): PublicClient {
  return {
    readContract: vi.fn(overrides.readContract ?? (async () => { throw new Error("reverted"); }))
  } as unknown as PublicClient;
}

// The native-price cache is keyed by chain.id at module scope. Reset the
// module between tests so a prior test's cached value can't leak in.
beforeEach(() => {
  vi.resetModules();
});

describe("getNativePriceUsd", () => {
  it("fetches and caches the native price from DexScreener", async () => {
    const { getNativePriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => jsonRes({ pairs: [{ chainId: "base", priceUsd: "2437.5" }] }));
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBe(2437.5);
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBe(2437.5);
    expect(fetchMock).toHaveBeenCalledTimes(1); // cached
  });

  it("returns null and caches null when fetch fails", async () => {
    const { getNativePriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => { throw new Error("network down"); });
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBeNull();
    expect(await getNativePriceUsd(base, fetchMock as unknown as typeof fetch)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
  it("returns the DexScreener price for a matching base token", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () =>
      jsonRes({
        pairs: [
          { chainId: "base", baseToken: { symbol: "USDC", address: USDC }, priceUsd: "0.9999" },
          { chainId: "ethereum", baseToken: { symbol: "USDC", address: "0xother" }, priceUsd: "9.99" }
        ]
      })
    );
    const res = await getTokenPriceUsd(base, "USDC", USDC, false, mockClient(), fetchMock as unknown as typeof fetch);
    expect(res).toBe(0.9999);
  });

  it("falls through to on-chain when DexScreener has no matching pair", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    // Same fetch serves both the token lookup (no address match → skip) and the
    // native-price lookup (chainId "base" matches → nativeUsd = 0.5).
    const fetchMock = vi.fn(async () =>
      jsonRes({ pairs: [{ chainId: "base", baseToken: { symbol: "USDC", address: "0xother" }, priceUsd: "0.5" }] })
    );
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "getPool") return "0xpool";
        if (args.functionName === "token0") return USDC;
        if (args.functionName === "slot0") return [2n ** 96n, 0, 0, 0, 0, 0, 0, 0];
        throw new Error("unexpected");
      }
    });
    // sqrtPrice = 2^96/2^96 = 1 → price = 1 native; times nativeUsd 0.5 → 0.5.
    const res = await getTokenPriceUsd(base, "USDC", USDC, false, client, fetchMock as unknown as typeof fetch);
    expect(res).toBe(0.5);
  });

  it("returns native price via getNativePriceUsd when isNative", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => jsonRes({ pairs: [{ chainId: "base", priceUsd: "2437.5" }] }));
    const res = await getTokenPriceUsd(base, "ETH", WETH, true, mockClient(), fetchMock as unknown as typeof fetch);
    expect(res).toBe(2437.5);
  });

  it("falls through to a V2 pool when V3 reads fail", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    // mainnet has both V3 and V2 dexes; V3 getPool throws so we reach V2.
    const fetchMock = vi.fn(async () => jsonRes({ pairs: [{ chainId: "ethereum", priceUsd: "3000" }] }));
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "getPool") throw new Error("no v3 pool");
        if (args.functionName === "getPair") return "0xpair";
        if (args.functionName === "token0") return MAINNET_USDC;
        if (args.functionName === "getReserves") return [200n, 100n, 0n];
        throw new Error("unexpected");
      }
    });
    // priceInNative = 200/100 = 2; * nativeUsd 3000 = 6000.
    const res = await getTokenPriceUsd(mainnet, "USDC", MAINNET_USDC, false, client, fetchMock as unknown as typeof fetch);
    expect(res).toBe(6000);
  });

  it("returns null when the chain has no wrapped native or dexes", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => jsonRes({ pairs: [] }));
    const fakeChain = { ...base, id: 99999 };
    const res = await getTokenPriceUsd(fakeChain, "USDC", USDC, false, mockClient(), fetchMock as unknown as typeof fetch);
    expect(res).toBeNull();
  });

  it("returns null when on-chain pools all fail", async () => {
    const { getTokenPriceUsd } = await import("./pricing");
    const fetchMock = vi.fn(async () => jsonRes({ pairs: [] }));
    const client = mockClient({ readContract: async () => { throw new Error("reverted"); } });
    const res = await getTokenPriceUsd(base, "USDC", USDC, false, client, fetchMock as unknown as typeof fetch);
    expect(res).toBeNull();
  });
});
