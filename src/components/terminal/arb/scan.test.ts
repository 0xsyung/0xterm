/**
 * @file scan.test.ts
 * @description 3-venue arb scan unit tests — pure quotes + scan flow (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { sepolia } from "viem/chains";
import type { ArbVenue, ArbScanDeps } from "./scan";
import {
  arbScan,
  quote,
  roundTripGross,
  v2AmountOut,
  v3AmountOut,
  V3_FEE_TIERS,
} from "./scan";

const TOKEN_START = "0x1111111111111111111111111111111111111111";
const TOKEN_OTHER = "0x2222222222222222222222222222222222222222";

function v2Venue(overrides: Partial<ArbVenue> = {}): ArbVenue {
  return {
    dexId: "univ2",
    name: "Uniswap V2",
    isV3: false,
    pool: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    factory: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    router: "0xcccccccccccccccccccccccccccccccccccccccc",
    fee: 0,
    tokenStartToken: TOKEN_START,
    tokenOtherToken: TOKEN_OTHER,
    reserveS: 1000n * 10n ** 18n,
    reserveO: 2000n * 10n ** 18n,
    depth: 1000n * 10n ** 18n,
    ...overrides,
  };
}

function v3Venue(overrides: Partial<ArbVenue> = {}): ArbVenue {
  return {
    dexId: "univ3",
    name: "Uniswap V3",
    isV3: true,
    pool: "0xdddddddddddddddddddddddddddddddddddddddd",
    factory: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    router: "0xffffffffffffffffffffffffffffffffffffffff",
    fee: 3000,
    token0: TOKEN_START,
    token1: TOKEN_OTHER,
    tokenStartToken: TOKEN_START,
    tokenOtherToken: TOKEN_OTHER,
    sqrtPriceX96: 1n << 96n,
    liquidity: 1000n * 10n ** 18n,
    depth: 1000n * 10n ** 18n,
    ...overrides,
  };
}

describe("v2AmountOut", () => {
  it("returns 0 on non-positive inputs", () => {
    expect(v2AmountOut(0n, 100n, 100n)).toBe(0n);
    expect(v2AmountOut(10n, 0n, 100n)).toBe(0n);
    expect(v2AmountOut(10n, 100n, 0n)).toBe(0n);
  });

  it("applies the 0.3% V2 fee", () => {
    // 100 * 997 * 1000 / (1000*1000 + 100*997) = 90.66... → 90
    expect(v2AmountOut(100n, 1000n, 1000n)).toBe(90n);
  });
});

describe("v3AmountOut", () => {
  const q96 = 1n << 96n;

  it("returns 0 on non-positive inputs", () => {
    expect(v3AmountOut(0n, 100n, 100n, true, 3000)).toBe(0n);
    expect(v3AmountOut(q96, 0n, 100n, true, 3000)).toBe(0n);
    expect(v3AmountOut(q96, 100n, 0n, true, 3000)).toBe(0n);
  });

  it("token1 in: output < input, respects fee", () => {
    const out = v3AmountOut(q96, 1000n, 100n, false, 3000);
    expect(out).toBeGreaterThan(0n);
    expect(out).toBeLessThan(100n);
  });

  it("token0 in: output < input", () => {
    const out = v3AmountOut(q96, 1000n, 100n, true, 3000);
    expect(out).toBeGreaterThan(0n);
    expect(out).toBeLessThan(100n);
  });

  it("clamps next price to current when in is huge", () => {
    const out = v3AmountOut(q96, 1n, 10n ** 20n, true, 3000);
    expect(out).toBeGreaterThanOrEqual(0n);
  });
});

describe("quote", () => {
  it("quotes a V2 venue via v2AmountOut", () => {
    const v = v2Venue({ reserveS: 1000n, reserveO: 2000n });
    expect(quote(v, TOKEN_START, TOKEN_OTHER, 100n)).toBe(
      v2AmountOut(100n, 1000n, 2000n)
    );
  });

  it("swaps reserve sides for tokenOther→tokenStart", () => {
    const v = v2Venue({ reserveS: 1000n, reserveO: 2000n });
    expect(quote(v, TOKEN_OTHER, TOKEN_START, 100n)).toBe(
      v2AmountOut(100n, 2000n, 1000n)
    );
  });

  it("quotes a V3 venue via v3AmountOut", () => {
    const v = v3Venue();
    const out = quote(v, TOKEN_START, TOKEN_OTHER, 100n);
    expect(out).toBe(v3AmountOut(v.sqrtPriceX96!, v.liquidity!, 100n, true, v.fee));
  });

  it("returns 0 on non-positive amount", () => {
    expect(quote(v2Venue(), TOKEN_START, TOKEN_OTHER, 0n)).toBe(0n);
  });
});

describe("roundTripGross", () => {
  it("computes round-trip minus flash fee", () => {
    const a = v2Venue({ pool: "0xa1", reserveS: 1000n, reserveO: 2000n });
    const b = v2Venue({ pool: "0xb1", reserveS: 2000n, reserveO: 1000n });
    const c = v3Venue({ pool: "0xc1", fee: 500 });
    const out = roundTripGross(a, b, c, TOKEN_START, TOKEN_OTHER, 100n);
    // Leg B quotes TOKEN_OTHER→TOKEN_START, so venue B uses reserveO as in.
    const legA = v2AmountOut(100n, 1000n, 2000n);
    const legB = v2AmountOut(legA, 1000n, 2000n);
    const flashFee = (100n * 500n) / 1_000_000n;
    expect(out).toBe(legB - 100n - flashFee);
  });
});

describe("arbScan", () => {
  const zeroAddr = "0x0000000000000000000000000000000000000000";

  it("rejects a chain with fewer than 2 DEX venues", async () => {
    const chain = { ...sepolia, id: 999999 } as never;
    const res = await arbScan(chain, TOKEN_START, TOKEN_OTHER, {
      client: {} as never,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain("fewer than 2 DEX venues");
  });

  it("builds a 3-venue result from V2+V3 pools", async () => {
    const v2Pool = "0x8888888888888888888888888888888888888888";
    const v3Pools = [
      "0x9999999999999999999999999999999999999999",
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "0xcccccccccccccccccccccccccccccccccccccccc",
    ];
    const client = {
      readContract: vi.fn(async ({ functionName, address, args }: { functionName: string; address: string; args: unknown[] }) => {
        if (functionName === "getPair") return v2Pool;
        if (functionName === "getPool") {
          const fee = args[2] as number;
          return v3Pools[[3000, 500, 100, 10000].indexOf(fee)]!;
        }
        if (functionName === "token0") return TOKEN_START;
        if (functionName === "token1") return TOKEN_OTHER;
        if (functionName === "getReserves") return [1000n, 2000n, 1] as const;
        if (functionName === "slot0") return [1n << 96n, 0, 0, 0, 0, 0, true] as const;
        if (functionName === "liquidity") return 2000n;
        return null;
      }),
    };
    const res = await arbScan(
      sepolia,
      TOKEN_START,
      TOKEN_OTHER,
      { client: client as never, gasPrice: 1000000000n, tokenStartPerNative: 1n }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.result;
    expect(r.venueA).toBeDefined();
    expect(r.venueB).toBeDefined();
    expect(r.venueC).toBeDefined();
    expect(new Set([r.venueA.pool, r.venueB.pool, r.venueC.pool]).size).toBe(3);
    expect(r.size).toBeGreaterThan(0n);
    expect(r.gross).toBeDefined();
    expect(r.net).toBeDefined();
    expect(r.gas).toBeGreaterThan(0n);
  });

  it("rejects when fewer than 2 live pools", async () => {
    const client = {
      readContract: vi.fn(async () => zeroAddr),
    };
    const res = await arbScan(sepolia, TOKEN_START, TOKEN_OTHER, {
      client: client as never,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain("fewer than 2 live pools");
  });

  it("surfaces no-distinct-flash-venue when all pools are the same", async () => {
    const client = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === "getPair") return pair;
        if (functionName === "token0") return TOKEN_START;
        if (functionName === "token1") return TOKEN_OTHER;
        if (functionName === "getReserves") return [1000n, 2000n, 1] as const;
        if (functionName === "getPool") return pair;
        if (functionName === "slot0") return [1n << 96n, 0, 0, 0, 0, 0, true] as const;
        if (functionName === "liquidity") return 2000n;
        return null;
      }),
    };
    const pair = "0x8888888888888888888888888888888888888888";
    const res = await arbScan(sepolia, TOKEN_START, TOKEN_OTHER, {
      client: client as never,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/no distinct flash venue/);
  });
});

describe("V3_FEE_TIERS", () => {
  it("is an ordered list of the 4 standard tiers", () => {
    expect([...V3_FEE_TIERS]).toEqual([3000, 500, 100, 10000]);
  });
});
