/**
 * @file resolveToken.test.ts
 * @description Unit tests for token query resolution
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { base } from "viem/chains";
import {
  resolveTokenDetails,
  resolveWithPreferred,
  resolveWithPreferredDecimals,
  type ResolveTokenDeps
} from "./resolveToken";
import type { CustomTokenEntry } from "./types";

const NATIVE = "0x0000000000000000000000000000000000000000";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // base USDC (common)
const CUSTOM_A = "0x1111111111111111111111111111111111111111";
const CUSTOM_B = "0x2222222222222222222222222222222222222222";

const customA: CustomTokenEntry = {
  id: `c_${CUSTOM_A.toLowerCase()}`,
  address: CUSTOM_A as any,
  symbol: "FOO",
  name: "Foo Token",
  decimals: 6,
  isNative: false
};
const customB: CustomTokenEntry = {
  id: `c_${CUSTOM_B.toLowerCase()}`,
  address: CUSTOM_B as any,
  symbol: "FOO",
  name: "Bar Token",
  decimals: 9,
  isNative: false
};

function mockClient(overrides: { readContract?: (args: any) => Promise<any> } = {}): PublicClient {
  return {
    readContract: vi.fn(overrides.readContract ?? (async () => { throw new Error("execution reverted"); }))
  } as unknown as PublicClient;
}

const jsonRes = (body: any) => ({ ok: true, json: async () => body });

function deps(overrides: Partial<ResolveTokenDeps> = {}): ResolveTokenDeps {
  return {
    customList: [],
    client: mockClient(),
    onAmbiguous: vi.fn(async () => null),
    fetchImpl: vi.fn(async () => jsonRes({ pairs: [] })) as unknown as typeof fetch,
    ...overrides
  } as ResolveTokenDeps;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("resolveTokenDetails", () => {
  it("resolves the chain native currency by symbol", async () => {
    const d = deps();
    const res = await resolveTokenDetails("eth", base, d);
    expect(res).toMatchObject({ address: NATIVE, symbol: "ETH", decimals: 18, isNative: true });
  });

  it("resolves native via the zero address", async () => {
    const d = deps();
    const res = await resolveTokenDetails(NATIVE, base, d);
    expect(res.isNative).toBe(true);
  });

  it("resolves an @-label with a full address against a custom token", async () => {
    const d = deps({ customList: [customA] });
    const res = await resolveTokenDetails(`FOO@${CUSTOM_A}`, base, d);
    expect(res).toMatchObject({ address: CUSTOM_A, symbol: "FOO", decimals: 6, isNative: false });
  });

  it("resolves an @-label with only a symbol prefix against a custom token", async () => {
    const d = deps({ customList: [customA] });
    const res = await resolveTokenDetails("FOO@0x1111", base, d);
    expect(res.symbol).toBe("FOO");
  });

  it("resolves an exact address against a custom token", async () => {
    const d = deps({ customList: [customA] });
    const res = await resolveTokenDetails(CUSTOM_A, base, d);
    expect(res).toMatchObject({ address: CUSTOM_A, symbol: "FOO", name: "Foo Token" });
  });

  it("resolves a hardcoded COMMON token by symbol", async () => {
    const d = deps();
    const res = await resolveTokenDetails("usdc", base, d);
    expect(res).toMatchObject({ address: USDC, symbol: "USDC", isNative: false });
  });

  it("resolves a single custom symbol match", async () => {
    const d = deps({ customList: [customA] });
    const res = await resolveTokenDetails("FOO", base, d);
    expect(res).toMatchObject({ address: CUSTOM_A, decimals: 6 });
  });

  it("opens the picker for multiple custom symbol matches", async () => {
    const onAmbiguous = vi.fn(async () => customB);
    const d = deps({ customList: [customA, customB], onAmbiguous });
    const res = await resolveTokenDetails("FOO", base, d);
    expect(onAmbiguous).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ address: CUSTOM_B });
  });

  it("throws a cancellation error when the picker returns null", async () => {
    const d = deps({ customList: [customA, customB] });
    await expect(resolveTokenDetails("FOO", base, d)).rejects.toThrow(
      'Token selection cancelled for symbol "FOO" on Base.'
    );
  });

  it("reads on-chain metadata for an unknown address", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "decimals") return 18n;
        if (args.functionName === "symbol") return "XYZ";
        if (args.functionName === "name") return "Xyz Token";
        throw new Error("unexpected");
      }
    });
    const d = deps({ client });
    const res = await resolveTokenDetails(CUSTOM_A, base, d);
    expect(res).toMatchObject({
      address: CUSTOM_A,
      symbol: "XYZ",
      name: "Xyz Token",
      decimals: 18
    });
  });

  it("falls back to a truncated symbol when the on-chain read fails", async () => {
    const d = deps();
    const res = await resolveTokenDetails(CUSTOM_A, base, d);
    expect(res).toMatchObject({
      address: CUSTOM_A,
      symbol: "0x1111...",
      name: "Custom Token",
      decimals: 18
    });
  });

  it("resolves via DexScreener for an unknown symbol", async () => {
    const client = mockClient({ readContract: async () => 6n });
    const fetchImpl = (vi.fn(async () =>
      jsonRes({
        pairs: [{ chainId: "base", baseToken: { symbol: "FOO", name: "Foo Token", address: CUSTOM_A } }]
      })
    ) as unknown) as typeof fetch;
    const d = deps({ client, fetchImpl });
    const res = await resolveTokenDetails("FOO", base, d);
    expect(res).toMatchObject({ address: CUSTOM_A, symbol: "FOO", name: "Foo Token", decimals: 6 });
  });

  it("defaults decimals to 18 when the DexScreener on-chain read fails", async () => {
    const fetchImpl = (vi.fn(async () =>
      jsonRes({
        pairs: [{ chainId: "base", baseToken: { symbol: "FOO", name: "Foo Token", address: CUSTOM_A } }]
      })
    ) as unknown) as typeof fetch;
    const d = deps({ fetchImpl });
    const res = await resolveTokenDetails("FOO", base, d);
    expect(res).toMatchObject({ decimals: 18 });
  });

  it("throws when DexScreener has no matching pair", async () => {
    const d = deps();
    await expect(resolveTokenDetails("FOO", base, d)).rejects.toThrow(
      'Unable to resolve token "FOO" on Base. Register it first using \'register <address>\'.'
    );
  });

  it("throws when the fetch fails", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("network down"); });
    const d = deps({ fetchImpl });
    await expect(resolveTokenDetails("FOO", base, d)).rejects.toThrow(/Unable to resolve/);
  });
});

describe("resolveWithPreferred", () => {
  it("returns the custom token when preferredAddr matches", async () => {
    const d = deps({ customList: [customA] });
    const res = await resolveWithPreferred("FOO", CUSTOM_A, base, d);
    expect(res).toMatchObject({ address: CUSTOM_A, symbol: "FOO", decimals: 6 });
  });

  it("reads on-chain metadata for a non-custom preferred address", async () => {
    const client = mockClient({
      readContract: async (args: any) => {
        if (args.functionName === "decimals") return 18n;
        if (args.functionName === "name") return "Pref Token";
        throw new Error("unexpected");
      }
    });
    const d = deps({ client });
    const res = await resolveWithPreferred("PREF", CUSTOM_A, base, d);
    expect(res).toMatchObject({
      id: `c_${CUSTOM_A.toLowerCase()}`,
      address: CUSTOM_A,
      symbol: "PREF",
      name: "Pref Token",
      decimals: 18
    });
  });

  it("falls through to symbol resolution when on-chain fails", async () => {
    const d = deps({ customList: [customA] });
    const res = await resolveWithPreferred("FOO", CUSTOM_A, base, d);
    expect(res).toMatchObject({ address: CUSTOM_A, decimals: 6 });
  });

  it("resolves by symbol when there is no preferred address", async () => {
    const d = deps();
    const res = await resolveWithPreferred("usdc", undefined, base, d);
    expect(res).toMatchObject({ address: USDC });
  });
});

describe("resolveWithPreferredDecimals", () => {
  it("normalizes decimals to a concrete number", async () => {
    const entry: CustomTokenEntry = { ...customA, decimals: undefined };
    const d = deps({ customList: [entry] });
    const res = await resolveWithPreferredDecimals("FOO", CUSTOM_A, base, d);
    expect(res.decimals).toBe(18);
  });
});
